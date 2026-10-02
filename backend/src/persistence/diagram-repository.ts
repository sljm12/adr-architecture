import { asc, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import type { DiagramDocument } from '../../../shared/src/index';
import { assertDiagramInvariants, diagramDocumentSchema } from '../../../shared/src/index';
import * as schema from './schema';

export type MaybePromise<T> = T | Promise<T>;

export interface DiagramRepositoryLike {
  list(): MaybePromise<DiagramDocument[]>;
  listTrash(): MaybePromise<DiagramDocument[]>;
  get(id: string): MaybePromise<DiagramDocument | undefined>;
  findContainerForOwner(ownerComponentId: string): MaybePromise<DiagramDocument | undefined>;
  findChildren(parentDiagramId: string): MaybePromise<DiagramDocument[]>;
  withGraphTransaction<T>(parentDiagramId: string, childDiagramIds: string[], action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T>;
  findComponent(id: string): MaybePromise<{ id: string; diagramId: string; name: string; description: string | null; type: string | null; role: string; sourceComponentId: string | null } | undefined>;
  findRelationship(id: string): MaybePromise<{ id: string; diagramId: string } | undefined>;
  create(document: DiagramDocument): MaybePromise<DiagramDocument>;
  replace(document: DiagramDocument): MaybePromise<DiagramDocument | undefined>;
  removeComponent(diagramId: string, componentId: string): MaybePromise<RemoveComponentResult | undefined>;
  removeRelationship(diagramId: string, relationshipId: string): MaybePromise<RemoveRelationshipResult | undefined>;
  trash(id: string): MaybePromise<DiagramDocument | undefined>;
  restore(id: string): MaybePromise<DiagramDocument | undefined>;
}

export type RemoveComponentResult =
  | { document: DiagramDocument; relationshipCount: number }
  | { conflict: true; relationshipCount: number; groupIds: string[] };
export type RemoveRelationshipResult =
  | { document: DiagramDocument }
  | { conflict: true };

const clone = (document: DiagramDocument) => structuredClone(document);
const groupsOf = (document: DiagramDocument) => document.groups ?? [];
const normalizedGroups = (document: DiagramDocument) => groupsOf(document).map(group => ({
  ...group,
  name: group.name.trim(),
  memberComponentIds: [...group.memberComponentIds],
}));

/** Isolated repository used by tests; production injects PostgresDiagramRepository. */
export class DiagramRepository implements DiagramRepositoryLike {
  private documents = new Map<string, DiagramDocument>();
  private transactionTail: Promise<void> = Promise.resolve();

  list() { return [...this.documents.values()].filter(d => d.status === 'active').map(d => this.resolve(d)); }
  listTrash() { return [...this.documents.values()].filter(d => d.status === 'trashed').map(d => this.resolve(d)); }
  get(id: string) { const document = this.documents.get(id); return document && this.resolve(document); }
  findContainerForOwner(ownerComponentId: string) { const child = [...this.documents.values()].find(document => document.kind === 'container' && document.scope?.softwareSystemId === ownerComponentId); return child && this.resolve(child); }
  findChildren(parentDiagramId: string) { return [...this.documents.values()].filter(document => document.kind === 'container' && document.scope?.parentDiagramId === parentDiagramId).map(document => this.resolve(document)); }
  async withGraphTransaction<T>(_parentDiagramId: string, _childDiagramIds: string[], action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    const prior = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>(resolve => { release = resolve; });
    await prior;
    const snapshot = new Map([...this.documents].map(([id, document]) => [id, clone(document)]));
    try { return await action(this, this); }
    catch (error) { this.documents = snapshot; throw error; }
    finally { release(); }
  }
  findComponent(id: string) { for (const document of this.documents.values()) { const component = document.components.find(item => item.id === id); if (component) return { id: component.id, diagramId: component.diagramId, name: component.name, description:component.description, type:component.type, role:component.role ?? 'element', sourceComponentId:component.sourceComponentId ?? null }; } return undefined; }
  findRelationship(id: string) { for (const document of this.documents.values()) { const relationship = document.relationships.find(item => item.id === id); if (relationship) return { id: relationship.id, diagramId: relationship.diagramId }; } return undefined; }
  create(input: DiagramDocument) {
    const document = diagramDocumentSchema.parse(input) as DiagramDocument;
    assertDiagramInvariants(document);
    if (document.kind === 'container' && this.findContainerForOwner(document.scope!.softwareSystemId)) throw new Error('diagrams_owner_component_unique');
    const normalized = { ...document, groups: normalizedGroups(document) };
    this.documents.set(document.id, clone(normalized));
    return clone(normalized);
  }
  replace(document: DiagramDocument) {
    document = diagramDocumentSchema.parse(document) as DiagramDocument;
    assertDiagramInvariants(document);
    const previous = this.documents.get(document.id);
    if (!previous || previous.status !== 'active') return undefined;
    const updatedAt = new Date().toISOString();
    const updated = {
      ...document,
      createdAt: previous.createdAt,
      updatedAt,
      components: document.components.map(component => {
        const prior = previous?.components.find(item => item.id === component.id);
        return { ...component, createdAt: prior?.createdAt ?? component.createdAt, updatedAt };
      }),
      relationships: document.relationships.map(relationship => {
        const prior = previous?.relationships.find(item => item.id === relationship.id);
        return { ...relationship, label: relationship.label?.trim() || null, createdAt: prior?.createdAt ?? relationship.createdAt, updatedAt };
      }),
      groups: normalizedGroups(document).map(group => {
        const prior = groupsOf(previous).find(item => item.id === group.id);
        return { ...group, name: group.name.trim(), memberComponentIds: [...group.memberComponentIds], createdAt: prior?.createdAt ?? group.createdAt, updatedAt };
      }),
    };
    this.documents.set(document.id, clone(updated));
    return clone(updated);
  }

  removeComponent(diagramId: string, componentId: string): RemoveComponentResult | undefined {
    const document = this.documents.get(diagramId);
    if (!document || document.status !== 'active' || !document.components.some(component => component.id === componentId)) return undefined;
    const dependentIds = new Set(document.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId).map(r => r.id));
    const groupIds = groupsOf(document).filter(group => group.memberComponentIds.includes(componentId)).map(group => group.id);
    if (dependentIds.size > 0 || groupIds.length > 0) return { conflict: true, relationshipCount: dependentIds.size, groupIds };
    const now = new Date().toISOString();
    const updated = { ...document, updatedAt: now, components: document.components.filter(c => c.id !== componentId) };
    this.documents.set(diagramId, clone(updated));
    return { document: clone(updated), relationshipCount: 0 };
  }

  removeRelationship(diagramId: string, relationshipId: string): RemoveRelationshipResult | undefined {
    const document = this.documents.get(diagramId);
    if (!document || document.status !== 'active' || !document.relationships.some(relationship => relationship.id === relationshipId)) return undefined;
    const now = new Date().toISOString();
    const updated = { ...document, updatedAt: now, relationships: document.relationships.filter(relationship => relationship.id !== relationshipId) };
    this.documents.set(diagramId, clone(updated));
    return { document: clone(updated) };
  }

  trash(id: string) {
    const document = this.documents.get(id);
    if (!document || document.status === 'trashed') return undefined;
    const now = new Date().toISOString();
    const updated = { ...document, status: 'trashed' as const, trashedAt: now, updatedAt: now };
    this.documents.set(id, clone(updated));
    return clone(updated);
  }

  restore(id: string) {
    const document = this.documents.get(id);
    if (!document || document.status !== 'trashed') return undefined;
    const updated = { ...document, status: 'active' as const, trashedAt: null, updatedAt: new Date().toISOString() };
    this.documents.set(id, clone(updated));
    return clone(updated);
  }

  private resolve(document: DiagramDocument): DiagramDocument {
    const resolved = clone(document);
    if (resolved.kind !== 'container' || !resolved.scope) return resolved;
    const parent = this.documents.get(resolved.scope.parentDiagramId);
    const owner = parent?.components.find(component => component.id === resolved.scope!.softwareSystemId);
    if (parent && owner) {
      resolved.scope = { ...resolved.scope, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
      resolved.components = resolved.components.map(component => {
        if (component.role !== 'external' || !component.sourceComponentId) return component;
        const source = parent.components.find(candidate => candidate.id === component.sourceComponentId);
        return source ? { ...component, name: source.name, description: source.description, type: source.type } : component;
      });
    }
    return resolved;
  }
}

type PostgresDatabase = NodePgDatabase<typeof schema>;
type PostgresTransaction = Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0];
type PostgresExecutor = PostgresDatabase | PostgresTransaction;

function validationError(path: (string | number)[], message: string): never {
  throw new z.ZodError([{ code: 'custom', path, message }]);
}

function validatePersistableDocument(input: DiagramDocument): DiagramDocument {
  const document = diagramDocumentSchema.parse(input) as DiagramDocument;
  assertDiagramInvariants(document);
  for (const component of document.components) {
    if (component.diagramId !== document.id) validationError(['components', component.id, 'diagramId'], 'Component must belong to the diagram');
  }
  for (const relationship of document.relationships) {
    if (relationship.diagramId !== document.id) validationError(['relationships', relationship.id, 'diagramId'], 'Relationship must belong to the diagram');
  }
  return document;
}

function dateValue(value: string, path: string): Date {
  const result = new Date(value);
  if (Number.isNaN(result.valueOf())) validationError([path], 'Must be a valid timestamp');
  return result;
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapDocument(
  diagram: typeof schema.diagrams.$inferSelect,
  componentRows: (typeof schema.components.$inferSelect)[],
  relationshipRows: (typeof schema.relationships.$inferSelect)[],
  groupRows: (typeof schema.systemGroups.$inferSelect)[] = [],
  memberRows: (typeof schema.systemGroupMembers.$inferSelect)[] = [],
  scope: DiagramDocument['scope'] = null,
  sourceComponents: Map<string, (typeof schema.components.$inferSelect)> = new Map(),
): DiagramDocument {
  const membersByGroup = new Map<string, string[]>();
  for (const member of memberRows) {
    const members = membersByGroup.get(member.groupId) ?? [];
    members.push(member.componentId);
    membersByGroup.set(member.groupId, members);
  }
  return {
    id: diagram.id,
    name: diagram.name,
    status: diagram.status,
    createdAt: iso(diagram.createdAt),
    updatedAt: iso(diagram.updatedAt),
    trashedAt: diagram.trashedAt ? iso(diagram.trashedAt) : null,
    kind: diagram.kind as NonNullable<DiagramDocument['kind']>,
    scope,
    boundary: diagram.kind === 'container' ? { position: { x: diagram.scopeX!, y: diagram.scopeY! }, size: { width: diagram.scopeWidth!, height: diagram.scopeHeight! } } : null,
    components: componentRows.map(component => ({
      id: component.id, diagramId: component.diagramId,
      name: component.role === 'external' && component.sourceComponentId ? sourceComponents.get(component.sourceComponentId)?.name ?? component.name : component.name,
      description: component.role === 'external' && component.sourceComponentId ? sourceComponents.get(component.sourceComponentId)?.description ?? component.description : component.description,
      type: component.role === 'external' && component.sourceComponentId ? sourceComponents.get(component.sourceComponentId)?.type ?? component.type : component.type,
      role: component.role as NonNullable<DiagramDocument['components'][number]['role']>,
      containerType: component.containerType as DiagramDocument['components'][number]['containerType'],
      technology: component.technology,
      sourceComponentId: component.sourceComponentId,
      position: { x: component.x, y: component.y },
      size: { width: component.width, height: component.height },
      createdAt: iso(component.createdAt), updatedAt: iso(component.updatedAt),
    })),
    relationships: relationshipRows.map(relationship => ({
      id: relationship.id, diagramId: relationship.diagramId,
      sourceComponentId: relationship.sourceComponentId,
      targetComponentId: relationship.targetComponentId,
      direction: relationship.direction, label: relationship.label,
      protocol: relationship.protocol,
      createdAt: iso(relationship.createdAt), updatedAt: iso(relationship.updatedAt),
    })),
    groups: groupRows.map(group => ({
      id: group.id, diagramId: group.diagramId, name: group.name,
      memberComponentIds: [...(membersByGroup.get(group.id) ?? [])],
      position: { x: group.x, y: group.y }, size: { width: group.width, height: group.height },
      createdAt: iso(group.createdAt), updatedAt: iso(group.updatedAt),
    })),
  };
}

/** PostgreSQL/Drizzle repository used by the API server. */
export class PostgresDiagramRepository implements DiagramRepositoryLike {
  constructor(private readonly db: PostgresExecutor, private readonly inTransaction = false) {}

  async list(): Promise<DiagramDocument[]> {
    const rows = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.status, 'active')).orderBy(asc(schema.diagrams.updatedAt));
    return Promise.all(rows.map(row => this.load(row.id)) as Promise<DiagramDocument>[]);
  }

  async listTrash(): Promise<DiagramDocument[]> {
    const rows = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.status, 'trashed')).orderBy(asc(schema.diagrams.updatedAt));
    return Promise.all(rows.map(row => this.load(row.id)) as Promise<DiagramDocument>[]);
  }

  async get(id: string): Promise<DiagramDocument | undefined> { return this.load(id); }

  async findContainerForOwner(ownerComponentId: string): Promise<DiagramDocument | undefined> {
    const [diagram] = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.ownerComponentId, ownerComponentId)).limit(1);
    return diagram ? this.load(diagram.id) : undefined;
  }

  async withGraphTransaction<T>(parentDiagramId: string, childDiagramIds: string[], action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    if (this.inTransaction) return await action(this, this.db);
    return this.db.transaction(async (transaction: PostgresTransaction) => {
      await transaction.select({ id:schema.diagrams.id }).from(schema.diagrams).where(eq(schema.diagrams.id, parentDiagramId)).for('update');
      const ordered = [...new Set(childDiagramIds)].filter(id => id !== parentDiagramId).sort();
      for (const id of ordered) await transaction.select({ id:schema.diagrams.id }).from(schema.diagrams).where(eq(schema.diagrams.id, id)).for('update');
      const scoped = new PostgresDiagramRepository(transaction, true);
      return action(scoped, transaction);
    });
  }

  async findComponent(id: string) { const [component] = await this.db.select({ id: schema.components.id, diagramId: schema.components.diagramId, name: schema.components.name, description:schema.components.description, type:schema.components.type, role:schema.components.role, sourceComponentId:schema.components.sourceComponentId }).from(schema.components).where(eq(schema.components.id, id)).limit(1); return component; }
  async findRelationship(id: string) { const [relationship] = await this.db.select({ id: schema.relationships.id, diagramId: schema.relationships.diagramId }).from(schema.relationships).where(eq(schema.relationships.id, id)).limit(1); return relationship; }
  async findChildren(parentDiagramId: string): Promise<DiagramDocument[]> {
    const rows = await this.db.select({ id:schema.diagrams.id }).from(schema.diagrams).where(eq(schema.diagrams.parentDiagramId, parentDiagramId)).orderBy(asc(schema.diagrams.id));
    const documents = await Promise.all(rows.map(row => this.load(row.id)));
    return documents.filter((document): document is DiagramDocument => Boolean(document));
  }

  async create(document: DiagramDocument): Promise<DiagramDocument> {
    document = validatePersistableDocument(document);
    const now = new Date();
    const insert = async (tx: any) => {
      await tx.insert(schema.diagrams).values({
        id: document.id, name: document.name.trim(), status: 'active',
        createdAt: dateValue(document.createdAt, 'createdAt'), updatedAt: now, trashedAt: null,
        kind: document.kind ?? 'general',
        parentDiagramId: document.scope?.parentDiagramId ?? null,
        ownerComponentId: document.scope?.softwareSystemId ?? null,
        scopeX: document.boundary?.position.x ?? null,
        scopeY: document.boundary?.position.y ?? null,
        scopeWidth: document.boundary?.size.width ?? null,
        scopeHeight: document.boundary?.size.height ?? null,
      });
      await this.insertChildren(tx, document, now, new Map(), new Map());
    };
    if (this.inTransaction) await insert(this.db); else await this.db.transaction(insert);
    return (await this.get(document.id))!;
  }

  async replace(document: DiagramDocument): Promise<DiagramDocument | undefined> {
    document = validatePersistableDocument(document);
    const existing = await this.get(document.id);
    if (!existing || existing.status !== 'active') return undefined;
    const now = new Date();
    const existingComponents = new Map(existing.components.map(component => [component.id, component]));
    const existingRelationships = new Map(existing.relationships.map(relationship => [relationship.id, relationship]));
    const existingGroups = new Map((existing.groups ?? []).map(group => [group.id, group]));
    const replace = async (tx: any) => {
      await tx.update(schema.diagrams).set({
        name: document.name.trim(), updatedAt: now, kind: document.kind ?? 'general',
        parentDiagramId: document.scope?.parentDiagramId ?? null, ownerComponentId: document.scope?.softwareSystemId ?? null,
        scopeX: document.boundary?.position.x ?? null, scopeY: document.boundary?.position.y ?? null,
        scopeWidth: document.boundary?.size.width ?? null, scopeHeight: document.boundary?.size.height ?? null,
      }).where(eq(schema.diagrams.id, document.id));
      await this.replaceChildren(tx, document, now, existingComponents, existingRelationships, existingGroups);
    };
    if (this.inTransaction) await replace(this.db); else await this.db.transaction(replace);
    return (await this.get(document.id))!;
  }

  async removeComponent(diagramId: string, componentId: string): Promise<RemoveComponentResult | undefined> {
    const existing = await this.get(diagramId);
    if (!existing || existing.status !== 'active' || !existing.components.some(component => component.id === componentId)) return undefined;
    const relationshipCount = existing.relationships.filter(relationship => relationship.sourceComponentId === componentId || relationship.targetComponentId === componentId).length;
    const groupIds = (existing.groups ?? []).filter(group => group.memberComponentIds.includes(componentId)).map(group => group.id);
    if (relationshipCount > 0 || groupIds.length > 0) return { conflict: true, relationshipCount, groupIds };
    const now = new Date();
    const remove = async (tx: any) => {
      await tx.delete(schema.components).where(eq(schema.components.id, componentId));
      await tx.update(schema.diagrams).set({ updatedAt: now }).where(eq(schema.diagrams.id, diagramId));
    };
    if (this.inTransaction) await remove(this.db); else await this.db.transaction(remove);
    return { document: (await this.get(diagramId))!, relationshipCount: 0 };
  }

  async removeRelationship(diagramId: string, relationshipId: string): Promise<RemoveRelationshipResult | undefined> {
    const existing = await this.get(diagramId);
    if (!existing || existing.status !== 'active' || !existing.relationships.some(relationship => relationship.id === relationshipId)) return undefined;
    const now = new Date();
    const remove = async (tx: any) => {
      await tx.delete(schema.relationships).where(eq(schema.relationships.id, relationshipId));
      await tx.update(schema.diagrams).set({ updatedAt: now }).where(eq(schema.diagrams.id, diagramId));
    };
    if (this.inTransaction) await remove(this.db); else await this.db.transaction(remove);
    return { document: (await this.get(diagramId))! };
  }

  async trash(id: string): Promise<DiagramDocument | undefined> {
    const existing = await this.get(id);
    if (!existing || existing.status === 'trashed') return undefined;
    const now = new Date();
    await this.db.update(schema.diagrams).set({ status: 'trashed', trashedAt: now, updatedAt: now }).where(eq(schema.diagrams.id, id));
    return (await this.get(id))!;
  }

  async restore(id: string): Promise<DiagramDocument | undefined> {
    const existing = await this.get(id);
    if (!existing || existing.status !== 'trashed') return undefined;
    await this.db.update(schema.diagrams).set({ status: 'active', trashedAt: null, updatedAt: new Date() }).where(eq(schema.diagrams.id, id));
    return (await this.get(id))!;
  }

  private async load(id: string): Promise<DiagramDocument | undefined> {
    const [diagram] = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.id, id)).limit(1);
    if (!diagram) return undefined;
    const componentRows = await this.db.select().from(schema.components).where(eq(schema.components.diagramId, id)).orderBy(asc(schema.components.createdAt), asc(schema.components.id));
    const relationshipRows = await this.db.select().from(schema.relationships).where(eq(schema.relationships.diagramId, id)).orderBy(asc(schema.relationships.createdAt), asc(schema.relationships.id));
    const groupRows = await this.db.select().from(schema.systemGroups).where(eq(schema.systemGroups.diagramId, id)).orderBy(asc(schema.systemGroups.createdAt), asc(schema.systemGroups.id));
    const memberRows = await Promise.all(groupRows.map(group => this.db.select().from(schema.systemGroupMembers).where(eq(schema.systemGroupMembers.groupId, group.id)).orderBy(asc(schema.systemGroupMembers.createdAt), asc(schema.systemGroupMembers.componentId))));
    let scope: DiagramDocument['scope'] = null;
    if (diagram.kind === 'container' && diagram.parentDiagramId && diagram.ownerComponentId) {
      const [[parent], [owner]] = await Promise.all([
        this.db.select().from(schema.diagrams).where(eq(schema.diagrams.id, diagram.parentDiagramId)).limit(1),
        this.db.select().from(schema.components).where(eq(schema.components.id, diagram.ownerComponentId)).limit(1),
      ]);
      if (parent && owner) scope = { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
    }
    const sourceIds = componentRows.flatMap(component => component.sourceComponentId ? [component.sourceComponentId] : []);
    const sourceRows = sourceIds.length ? await this.db.select().from(schema.components).where(inArray(schema.components.id, sourceIds)) : [];
    return mapDocument(diagram, componentRows, relationshipRows, groupRows, memberRows.flat(), scope, new Map(sourceRows.map(component => [component.id, component])));
  }

  private async insertChildren(
    tx: any,
    document: DiagramDocument,
    now: Date,
    existingComponents: Map<string, DiagramDocument['components'][number]>,
    existingRelationships: Map<string, DiagramDocument['relationships'][number]>,
    existingGroups: Map<string, NonNullable<DiagramDocument['groups']>[number]> = new Map(),
  ): Promise<void> {
    if (document.components.length > 0) {
      await tx.insert(schema.components).values(document.components.map(component => {
        const previous = existingComponents.get(component.id);
        return {
          id: component.id, diagramId: document.id, name: component.name.trim(),
          description: component.description, type: component.type,
          role: component.role ?? 'element', containerType: component.containerType ?? null, technology: component.technology ?? null, sourceComponentId: component.sourceComponentId ?? null,
          x: component.position.x, y: component.position.y, width: component.size.width, height: component.size.height,
          createdAt: previous ? dateValue(previous.createdAt, `components.${component.id}.createdAt`) : dateValue(component.createdAt, `components.${component.id}.createdAt`),
          updatedAt: now,
        };
      }));
    }
    if (document.relationships.length > 0) {
      await tx.insert(schema.relationships).values(document.relationships.map(relationship => {
        const previous = existingRelationships.get(relationship.id);
        return {
          id: relationship.id, diagramId: document.id,
          sourceComponentId: relationship.sourceComponentId,
          targetComponentId: relationship.targetComponentId,
          direction: relationship.direction, label: relationship.label?.trim() || null,
          protocol: relationship.protocol?.trim() || null,
          createdAt: previous ? dateValue(previous.createdAt, `relationships.${relationship.id}.createdAt`) : dateValue(relationship.createdAt, `relationships.${relationship.id}.createdAt`),
          updatedAt: now,
        };
      }));
    }
    const groups = document.groups ?? [];
    if (groups.length > 0) {
      await tx.insert(schema.systemGroups).values(groups.map(group => {
        const previous = existingGroups.get(group.id);
        return {
          id: group.id, diagramId: document.id, name: group.name.trim(), x: group.position.x, y: group.position.y,
          width: group.size.width, height: group.size.height,
          createdAt: previous ? dateValue(previous.createdAt, `groups.${group.id}.createdAt`) : dateValue(group.createdAt, `groups.${group.id}.createdAt`), updatedAt: now,
        };
      }));
      await tx.insert(schema.systemGroupMembers).values(groups.flatMap(group => group.memberComponentIds.map(componentId => ({ groupId: group.id, componentId, createdAt: now }))));
    }
  }

  private async replaceChildren(
    tx: any,
    document: DiagramDocument,
    now: Date,
    existingComponents: Map<string, DiagramDocument['components'][number]>,
    existingRelationships: Map<string, DiagramDocument['relationships'][number]>,
    existingGroups: Map<string, NonNullable<DiagramDocument['groups']>[number]>,
  ): Promise<void> {
    const componentIds = new Set(document.components.map(component => component.id));
    const relationshipIds = new Set(document.relationships.map(relationship => relationship.id));
    const groupIds = new Set((document.groups ?? []).map(group => group.id));
    for (const id of existingRelationships.keys()) {
      if (!relationshipIds.has(id)) await tx.delete(schema.relationships).where(eq(schema.relationships.id, id));
    }
    for (const id of existingGroups.keys()) {
      await tx.delete(schema.systemGroupMembers).where(eq(schema.systemGroupMembers.groupId, id));
      if (!groupIds.has(id)) await tx.delete(schema.systemGroups).where(eq(schema.systemGroups.id, id));
    }
    for (const id of existingComponents.keys()) {
      if (!componentIds.has(id)) await tx.delete(schema.components).where(eq(schema.components.id, id));
    }
    for (const component of document.components) {
      const previous = existingComponents.get(component.id);
      const values = {
        diagramId: document.id, name: component.name.trim(), description: component.description, type: component.type,
        role: component.role ?? 'element', containerType: component.containerType ?? null, technology: component.technology ?? null, sourceComponentId: component.sourceComponentId ?? null,
        x: component.position.x, y: component.position.y, width: component.size.width, height: component.size.height, updatedAt: now,
      };
      if (previous) await tx.update(schema.components).set(values).where(eq(schema.components.id, component.id));
      else await tx.insert(schema.components).values({ id: component.id, ...values, createdAt: dateValue(component.createdAt, `components.${component.id}.createdAt`) });
    }
    for (const relationship of document.relationships) {
      const previous = existingRelationships.get(relationship.id);
      const values = {
        diagramId: document.id, sourceComponentId: relationship.sourceComponentId, targetComponentId: relationship.targetComponentId,
        direction: relationship.direction, label: relationship.label?.trim() || null, updatedAt: now,
        protocol: relationship.protocol?.trim() || null,
      };
      if (previous) await tx.update(schema.relationships).set(values).where(eq(schema.relationships.id, relationship.id));
      else await tx.insert(schema.relationships).values({ id: relationship.id, ...values, createdAt: dateValue(relationship.createdAt, `relationships.${relationship.id}.createdAt`) });
    }
    const groups = document.groups ?? [];
    for (const group of groups) {
      const previous = existingGroups.get(group.id);
      const values = { diagramId: document.id, name: group.name.trim(), x: group.position.x, y: group.position.y, width: group.size.width, height: group.size.height, updatedAt: now };
      if (previous) await tx.update(schema.systemGroups).set(values).where(eq(schema.systemGroups.id, group.id));
      else await tx.insert(schema.systemGroups).values({ id: group.id, ...values, createdAt: dateValue(group.createdAt, `groups.${group.id}.createdAt`) });
      if (group.memberComponentIds.length > 0) await tx.insert(schema.systemGroupMembers).values(group.memberComponentIds.map(componentId => ({ groupId: group.id, componentId, createdAt: now })));
    }
  }
}
