import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import type { DiagramDocument, ComponentScope, DiagramKind, DeletionError } from '../../../shared/src/index';
import { assertDiagramInvariants, diagramDocumentSchema, getDiagramName, getDiagramOwnerId, getComponentScope } from '../../../shared/src/index';
import { ApiConflictError } from '../api/errors';
import * as schema from './schema';
import { archiveTimestamp, archiveGeometry, sortArchiveRows, readArchiveTable, upsertArchiveTable, removeArchiveTable, archiveRowIdentity, archiveFields, normalizeArchiveRows, type DiagramArchiveCollection } from './archive-repository';
import { canonicalArchiveScalar, ARCHIVE_MAX_REVISION, type ArchiveRecords, type ArchiveDiagram } from '../../../shared/src/index';

export type MaybePromise<T> = T | Promise<T>;
export interface TrashProvenance { trashBatchId: string | null; trashRootDiagramId: string | null }
export interface ChildMembership { id: string; status: 'active' | 'trashed'; parentDiagramId: string | null; ownerComponentId: string | null; createdAt: string; updatedAt: string }
export interface GraphMembership extends ChildMembership { kind: DiagramKind }
export interface DeletionScope { diagramIds: string[]; componentIds: string[]; relationshipIds: string[] }
export type DeletionBlocker = NonNullable<DeletionError['blockers']>[number];
export const deletionBlocker = (diagramId: string, artifactId: string, reason: string): DeletionBlocker => ({ diagramId, artifactId, reason, nextAction: `Resolve this reference in diagram ${diagramId}, artifact ${artifactId}, then request a new deletion preview.` });

export interface DiagramRepositoryLike {
  readArchiveRows(diagramIds?: string[]): MaybePromise<Pick<ArchiveRecords, DiagramArchiveCollection>>;
  upsertArchiveRows<C extends DiagramArchiveCollection>(collection: C, rows: ArchiveRecords[C]): MaybePromise<void>;
  removeArchiveRows(collection: DiagramArchiveCollection, identities: string[][]): MaybePromise<void>;
  getConfirmationEpoch(id: string): MaybePromise<string>;
  advanceConfirmationEpochs(ids: string[]): MaybePromise<void>;
  withArchiveSnapshot<T>(action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T>;
  deferArchiveSources(): MaybePromise<void>;
  checkArchiveSources(): MaybePromise<void>;
  deletionBlockers(scope: DeletionScope): MaybePromise<DeletionBlocker[]>;
  /** Transaction-scoped removal; IDs must be validated and ordered deepest-first. */
  purge(diagramIds: string[]): MaybePromise<void>;
  getDeletionRevision(id: string): MaybePromise<string | undefined>;
  incrementDeletionRevision(id: string): MaybePromise<void>;
  transactionDiagramIds?(rootId: string): string[];
  listAll(): MaybePromise<DiagramDocument[]>;
  list(): MaybePromise<DiagramDocument[]>;
  listTrash(): MaybePromise<DiagramDocument[]>;
  get(id: string): MaybePromise<DiagramDocument | undefined>;
  findContainerForOwner(ownerComponentId: string): MaybePromise<DiagramDocument | undefined>;
  findChildren(parentDiagramId: string): MaybePromise<DiagramDocument[]>;
  /** Raw discovery retains expected IDs even when their document cannot hydrate. */
  findChildMembership(parentDiagramId: string): MaybePromise<ChildMembership[]>;
  getGraphMembership(id: string): MaybePromise<GraphMembership | undefined>;
  findAncestors(id: string): MaybePromise<GraphMembership[]>;
  findDescendants(id: string): MaybePromise<GraphMembership[]>;
  withGraphTransaction<T>(parentDiagramId: string, childDiagramIds: string[], action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T>;
  withCollectionTransaction<T>(action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T>;
  findComponent(id: string): MaybePromise<{ id: string; diagramId: string; name: string; description: string | null; type: string | null; role: string; sourceComponentId: string | null } | undefined>;
  findRelationship(id: string): MaybePromise<{ id: string; diagramId: string } | undefined>;
  create(document: DiagramDocument): MaybePromise<DiagramDocument>;
  replace(document: DiagramDocument): MaybePromise<DiagramDocument | undefined>;
  removeComponent(diagramId: string, componentId: string): MaybePromise<RemoveComponentResult | undefined>;
  removeRelationship(diagramId: string, relationshipId: string): MaybePromise<RemoveRelationshipResult | undefined>;
  getTrashProvenance(id: string): MaybePromise<TrashProvenance>;
  trash(id: string, provenance?: TrashProvenance): MaybePromise<DiagramDocument | undefined>;
  restore(id: string): MaybePromise<DiagramDocument | undefined>;
}

export type RemoveComponentResult =
  | { document: DiagramDocument; relationshipCount: number }
  | { conflict: true; relationshipCount: number; groupIds: string[] };
export type RemoveRelationshipResult =
  | { document: DiagramDocument }
  | { conflict: true };

const clone = (document: DiagramDocument) => structuredClone(document);
function diagramDeletionBlockers(scope: DeletionScope,
  diagrams: { id: string; parentDiagramId: string | null; ownerComponentId: string | null; trashRootDiagramId: string | null }[],
  components: { id: string; diagramId: string; sourceComponentId?: string | null }[],
  relationships: { id: string; diagramId: string; sourceComponentId: string; targetComponentId: string }[],
  groups: { id: string; diagramId: string }[], members: { groupId: string; componentId: string }[],
): DeletionBlocker[] {
  const ids = new Set(scope.diagramIds), componentIds = new Set(scope.componentIds);
  const blockers: DeletionBlocker[] = [];
  for (const d of diagrams) if (!ids.has(d.id)) {
    if (d.parentDiagramId && ids.has(d.parentDiagramId)) blockers.push(deletionBlocker(d.id, d.id, `Parent diagram ${d.parentDiagramId} would be removed.`));
    if (d.ownerComponentId && componentIds.has(d.ownerComponentId)) blockers.push(deletionBlocker(d.id, d.id, `Owner component ${d.ownerComponentId} would be removed.`));
    if (d.trashRootDiagramId && ids.has(d.trashRootDiagramId)) blockers.push(deletionBlocker(d.id, d.id, `Trash root ${d.trashRootDiagramId} would be removed.`));
  }
  for (const c of components) if (!ids.has(c.diagramId) && c.sourceComponentId && componentIds.has(c.sourceComponentId)) blockers.push(deletionBlocker(c.diagramId, c.id, `Source component ${c.sourceComponentId} would be removed.`));
  for (const r of relationships) if (!ids.has(r.diagramId) && (componentIds.has(r.sourceComponentId) || componentIds.has(r.targetComponentId))) blockers.push(deletionBlocker(r.diagramId, r.id, 'A relationship endpoint would be removed.'));
  const groupsById = new Map(groups.map(g => [g.id, g]));
  for (const m of members) { const g = groupsById.get(m.groupId); if (g && !ids.has(g.diagramId) && componentIds.has(m.componentId)) blockers.push(deletionBlocker(g.diagramId, g.id, `Group member ${m.componentId} would be removed.`)); }
  return blockers;
}
/** Raw bounded discovery works even after the graph root has been removed. */
function memoryGraphIds(documents: Iterable<DiagramDocument>, seeds: Set<string>): string[] {
  const ids = new Set(seeds); const all = [...documents];
  for (let depth = 0; depth < 3; depth++) for (const document of all) if (document.scope && ids.has(document.scope.parentDiagramId)) ids.add(document.id);
  return [...ids];
}
const groupsOf = (document: DiagramDocument) => document.groups ?? [];
const normalizedGroups = (document: DiagramDocument) => groupsOf(document).map(group => ({
  ...group,
  name: group.name.trim(),
  memberComponentIds: [...group.memberComponentIds],
}));

const brokenGraph = (message: string): never => { throw new ApiConflictError(`${message} Repair the diagram's parent/owner references.`, 'DIAGRAM_REFERENCE_BROKEN'); };
/** A C4 hierarchy has exactly three permitted levels; never follows arbitrary chains. */
export async function graphAncestors(repository: DiagramRepositoryLike, id: string): Promise<GraphMembership[]> {
  let member = await repository.getGraphMembership(id);
  if (!member) return brokenGraph('Diagram graph entry is missing.');
  const ancestors: GraphMembership[] = []; const seen = new Set([id]);
  for (let depth = 0; member.parentDiagramId; depth++) {
    if (depth >= 2 || seen.has(member.parentDiagramId)) return brokenGraph('Diagram hierarchy is cyclic or exceeds Component depth.');
    const parent = await repository.getGraphMembership(member.parentDiagramId);
    if (!parent || (member.kind === 'component' ? parent.kind !== 'container' : member.kind === 'container' ? parent.kind !== 'general' : true)) return brokenGraph('Diagram ancestry has a missing or wrong-level parent.');
    seen.add(parent.id); ancestors.push(parent); member = parent;
  }
  if (member.kind !== 'general') return brokenGraph('Diagram hierarchy has no System Context root.');
  return ancestors;
}
export async function graphRoot(repository: DiagramRepositoryLike, id: string): Promise<GraphMembership> {
  const ancestors = await graphAncestors(repository, id);
  return ancestors.at(-1) ?? (await repository.getGraphMembership(id))!;
}
export async function graphDescendants(repository: DiagramRepositoryLike, id: string): Promise<GraphMembership[]> {
  const root = await repository.getGraphMembership(id);
  if (!root) return brokenGraph('Diagram graph entry is missing.');
  const result: GraphMembership[] = []; const seen = new Set([id]); let parents = [root];
  for (let depth = 0; depth < 3; depth++) {
    const next: GraphMembership[] = [];
    for (const parent of parents) for (const child of await repository.findChildMembership(parent.id)) {
      const member = await repository.getGraphMembership(child.id);
      if (!member || seen.has(child.id) || (parent.kind === 'general' ? member.kind !== 'container' : parent.kind === 'container' ? member.kind !== 'component' : true)) return brokenGraph('Diagram descendants have a duplicate, cyclic or wrong-level reference.');
      seen.add(child.id); next.push(member);
    }
    next.sort((a, b) => a.id.localeCompare(b.id)); result.push(...next); parents = next;
    if (!parents.length) break;
    if (depth === 2) return brokenGraph('Diagram hierarchy exceeds Component depth.');
  }
  return result;
}

function componentScope(parentId: string, owner: Pick<DiagramDocument['components'][number], 'id' | 'name' | 'description' | 'technology'> & { containerType?: string | null }, contextId: string, system: Pick<DiagramDocument['components'][number], 'id' | 'name'>): ComponentScope {
  return { parentDiagramId: parentId, containerId: owner.id, parentDiagramName: system.name, containerName: owner.name, containerDescription: owner.description, containerTechnology: owner.technology ?? '', containerType: owner.containerType as ComponentScope['containerType'], systemContextDiagramId: contextId, softwareSystemId: system.id, softwareSystemName: system.name };
}

/** Isolated repository used by tests; production injects PostgresDiagramRepository. */
export class DiagramRepository implements DiagramRepositoryLike {
  private documents = new Map<string, DiagramDocument>();
  private revisions = new Map<string, bigint>();
  private provenance = new Map<string, TrashProvenance>();
  private membershipTimes = new Map<string, string>();
  private epochs = new Map<string, bigint>();
  private writerTail?: Promise<void>;
  private readonly writerScope = new AsyncLocalStorage<{ active: boolean; collection: boolean }>();
  private transactionMembers = new Map<string, Set<string>>();
  transactionDiagramIds(rootId: string) { return [...(this.transactionMembers.get(rootId) ?? [])]; }

  getConfirmationEpoch(id: string) { return (this.epochs.get(id.toLowerCase()) ?? 0n).toString(); }
  advanceConfirmationEpochs(ids: string[]) {
    if (!this.writerScope.getStore()?.collection) throw new Error('Epoch writes require collection coordination');
    for (const id of new Set(ids.map(id => id.toLowerCase()))) {
      const next = BigInt(this.getConfirmationEpoch(id)) + 1n;
      if (next > ARCHIVE_MAX_REVISION) throw new Error('Confirmation epoch overflow');
      this.epochs.set(id, next);
    }
  }
  deferArchiveSources() {}
  checkArchiveSources() {}
  withArchiveSnapshot<T>(action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> { return this.withCollectionTransaction(action); }
  readArchiveRows(diagramIds?: string[]): Pick<ArchiveRecords, DiagramArchiveCollection> {
    const ids = diagramIds && new Set(diagramIds.map(id => id.toLowerCase()));
    const documents = [...this.documents.values()].filter(d => !ids || ids.has(d.id.toLowerCase()));
    const diagrams: ArchiveDiagram[] = documents.map(d => ({ id: d.id, name: d.name, kind: d.kind ?? 'general', status: d.status, createdAt: archiveTimestamp(d.createdAt), updatedAt: archiveTimestamp(d.updatedAt), trashedAt: d.trashedAt && archiveTimestamp(d.trashedAt), parentDiagramId: d.scope?.parentDiagramId ?? null, ownerComponentId: getDiagramOwnerId(d), scopeX: d.boundary ? canonicalArchiveScalar(d.boundary.position.x) : null, scopeY: d.boundary ? canonicalArchiveScalar(d.boundary.position.y) : null, scopeWidth: d.boundary ? canonicalArchiveScalar(d.boundary.size.width) : null, scopeHeight: d.boundary ? canonicalArchiveScalar(d.boundary.size.height) : null, ...this.getTrashProvenance(d.id), deletionRevision: this.getDeletionRevision(d.id) ?? '0' }));
    return {
      diagrams: sortArchiveRows('diagrams', diagrams),
      components: sortArchiveRows('components', documents.flatMap(d => d.components.map(c => ({ id: c.id, diagramId: c.diagramId, name: c.name, description: c.description, type: c.type, role: c.role ?? 'element', containerType: c.containerType ?? null, technology: c.technology ?? null, sourceComponentId: c.sourceComponentId ?? null, ...archiveGeometry(c), createdAt: archiveTimestamp(c.createdAt), updatedAt: archiveTimestamp(c.updatedAt) })))),
      relationships: sortArchiveRows('relationships', documents.flatMap(d => d.relationships.map(r => ({ ...r, protocol: r.protocol ?? null, createdAt: archiveTimestamp(r.createdAt), updatedAt: archiveTimestamp(r.updatedAt) })))),
      systemGroups: sortArchiveRows('systemGroups', documents.flatMap(d => d.groups.map(g => ({ id: g.id, diagramId: g.diagramId, name: g.name, ...archiveGeometry(g), createdAt: archiveTimestamp(g.createdAt), updatedAt: archiveTimestamp(g.updatedAt) })))),
      systemGroupMembers: sortArchiveRows('systemGroupMembers', documents.flatMap(d => d.groups.flatMap(g => g.memberComponentIds.map(componentId => ({ groupId: g.id, componentId, createdAt: this.membershipTimes.get(`${g.id}/${componentId}`)! }))))),
    };
  }
  private syncMembershipTimes(document: DiagramDocument, timestamp: string) {
    const old = this.documents.get(document.id);
    const pairs = new Set(document.groups.flatMap(g => g.memberComponentIds.map(id => `${g.id}/${id}`)));
    for (const group of old?.groups ?? []) for (const id of group.memberComponentIds) if (!pairs.has(`${group.id}/${id}`)) this.membershipTimes.delete(`${group.id}/${id}`);
    for (const key of pairs) if (!this.membershipTimes.has(key)) this.membershipTimes.set(key, archiveTimestamp(timestamp));
  }
  upsertArchiveRows<C extends DiagramArchiveCollection>(collection: C, incoming: ArchiveRecords[C]) {
    if (!this.writerScope.getStore()?.collection) throw new Error('Raw writes require collection coordination');
    const rows = this.readArchiveRows();
    const merged = new Map(rows[collection].map(row => [archiveRowIdentity(collection,row).join('/'), row]));
    const affected = new Set<string>();
    for (const row of normalizeArchiveRows(collection,incoming)) {
      const key = archiveRowIdentity(collection,row).join('/'), previous = merged.get(key);
      if (previous && archiveFields[collection].every(field => (previous as unknown as Record<string,unknown>)[field] === (row as unknown as Record<string,unknown>)[field])) continue;
      affected.add('diagramId' in row ? row.diagramId : 'groupId' in row ? rows.systemGroups.find(g => g.id === row.groupId)!.diagramId : row.id);
      merged.set(key, row);
    }
    (rows[collection] as unknown[]) = [...merged.values()];
    this.setArchiveRows(rows,affected);
  }
  removeArchiveRows(collection: DiagramArchiveCollection, identities: string[][]) {
    if (!this.writerScope.getStore()?.collection || collection === 'diagrams') throw new Error('Raw removal requires collection coordination and cannot remove diagrams');
    const rows = this.readArchiveRows(), removed = new Set(identities.map(id => id.map(v => v.toLowerCase()).join('/')));
    const affected = new Set(rows[collection].filter(row => removed.has(archiveRowIdentity(collection,row).join('/'))).map(row => 'diagramId' in row ? row.diagramId : rows.systemGroups.find(g => g.id === row.groupId)!.diagramId));
    (rows[collection] as unknown[]) = rows[collection].filter(row => !removed.has(archiveRowIdentity(collection,row).join('/')));
    this.setArchiveRows(rows,affected);
  }
  private setArchiveRows(rows: Pick<ArchiveRecords, DiagramArchiveCollection>, affected: Set<string>) {
    const layout = (r: { x: string; y: string; width: string; height: string }) => ({ position: { x: Number(r.x), y: Number(r.y) }, size: { width: Number(r.width), height: Number(r.height) } });
    this.membershipTimes = new Map(rows.systemGroupMembers.map(m => [`${m.groupId}/${m.componentId}`, m.createdAt]));
    for (const d of rows.diagrams.filter(d => affected.has(d.id))) {
      const scope = d.parentDiagramId && d.ownerComponentId ? d.kind === 'component' ? { parentDiagramId: d.parentDiagramId, containerId: d.ownerComponentId } as ComponentScope : { parentDiagramId: d.parentDiagramId, softwareSystemId: d.ownerComponentId, parentDiagramName: '', softwareSystemName: '', softwareSystemDescription: null } : null;
      this.documents.set(d.id, { id: d.id, name: d.name, kind: d.kind, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt, trashedAt: d.trashedAt, scope, boundary: d.kind === 'general' ? null : { position: { x: Number(d.scopeX), y: Number(d.scopeY) }, size: { width: Number(d.scopeWidth), height: Number(d.scopeHeight) } }, components: rows.components.filter(c => c.diagramId === d.id).map(c => ({ ...c, ...layout(c) })), relationships: rows.relationships.filter(r => r.diagramId === d.id), groups: rows.systemGroups.filter(g => g.diagramId === d.id).map(g => ({ ...g, ...layout(g), memberComponentIds: rows.systemGroupMembers.filter(m => m.groupId === g.id).map(m => m.componentId) })) });
      this.revisions.set(d.id, BigInt(d.deletionRevision));
      this.provenance.set(d.id, { trashBatchId: d.trashBatchId, trashRootDiagramId: d.trashRootDiagramId });
    }
  }

  private async coordinateWrite<T>(action: () => MaybePromise<T>, collection = false): Promise<T> {
    if (this.writerScope.getStore()?.active) return action();
    const prior = this.writerTail;
    let release!: () => void;
    const tail = new Promise<void>(resolve => { release = resolve; });
    this.writerTail = tail;
    await prior;
    const scope = { active: true, collection };
    try { return await this.writerScope.run(scope, action); }
    finally { scope.active = false; release(); if (this.writerTail === tail) this.writerTail = undefined; }
  }

  async withCollectionTransaction<T>(action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    if (this.writerScope.getStore()?.active) {
      if (!this.writerScope.getStore()!.collection) throw new Error('Collection coordination must start before graph locks');
      return action(this, this);
    }
    return this.coordinateWrite(async () => {
      const documents = new Map([...this.documents].map(([id, d]) => [id, clone(d)]));
      const provenance = new Map([...this.provenance].map(([id, p]) => [id, { ...p }]));
      const revisions = new Map(this.revisions);
      const membershipTimes = new Map(this.membershipTimes), epochs = new Map(this.epochs);
      try { return await action(this, this); }
      catch (error) { this.documents = documents; this.provenance = provenance; this.revisions = revisions; this.membershipTimes = membershipTimes; this.epochs = epochs; throw error; }
    }, true);
  }

  deletionBlockers(scope: DeletionScope) {
    const documents = [...this.documents.values()];
    return diagramDeletionBlockers(scope,
      documents.map(d => ({ id: d.id, parentDiagramId: d.scope?.parentDiagramId ?? null, ownerComponentId: getDiagramOwnerId(d), trashRootDiagramId: this.getTrashProvenance(d.id).trashRootDiagramId })),
      documents.flatMap(d => d.components), documents.flatMap(d => d.relationships), documents.flatMap(d => d.groups),
      documents.flatMap(d => d.groups.flatMap(g => g.memberComponentIds.map(componentId => ({ groupId: g.id, componentId })))),
    );
  }
  purge(diagramIds: string[]) {
    for (const id of diagramIds) { const d = this.documents.get(id); for (const g of d?.groups ?? []) for (const c of g.memberComponentIds) this.membershipTimes.delete(`${g.id}/${c}`); this.documents.delete(id); this.provenance.delete(id); this.revisions.delete(id); }
  }

  getDeletionRevision(id: string) { return this.revisions.get(id)?.toString(); }
  incrementDeletionRevision(id: string) {
    const revision = this.revisions.get(id);
    if (revision === undefined || !this.documents.has(id)) throw new Error('Diagram revision not found');
    this.revisions.set(id, revision + 1n);
  }

  listAll() { return [...this.documents.values()].map(d => this.resolve(d)); }

  list() { return [...this.documents.values()].filter(d => d.status === 'active').map(d => this.resolve(d)); }
  listTrash() { return [...this.documents.values()].filter(d => d.status === 'trashed').map(d => this.resolve(d)); }
  get(id: string) { const document = this.documents.get(id); return document && this.resolve(document); }
  findContainerForOwner(ownerComponentId: string) { const child = [...this.documents.values()].find(document => getDiagramOwnerId(document) === ownerComponentId); return child && this.resolve(child); }
  findChildren(parentDiagramId: string) { return [...this.documents.values()].filter(document => document.scope?.parentDiagramId === parentDiagramId).map(document => this.resolve(document)); }
  getGraphMembership(id: string): GraphMembership | undefined {
    const document = this.documents.get(id);
    return document && { id, kind: document.kind ?? 'general', status: document.status, parentDiagramId: document.scope?.parentDiagramId ?? null, ownerComponentId: getDiagramOwnerId(document), createdAt: document.createdAt, updatedAt: document.updatedAt };
  }
  findAncestors(id: string) { return graphAncestors(this, id); }
  findDescendants(id: string) { return graphDescendants(this, id); }
  findChildMembership(parentDiagramId: string): ChildMembership[] {
    return [...this.documents.values()].filter(document => document.scope?.parentDiagramId === parentDiagramId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(document => this.getGraphMembership(document.id)!);
  }
  async withGraphTransaction<T>(_parentDiagramId: string, _childDiagramIds: string[], action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    if (this.writerScope.getStore()?.active) return action(this, this);
    return this.coordinateWrite(async () => {
      const root = await graphRoot(this, _parentDiagramId);
      try {
        if ((await graphRoot(this, _parentDiagramId)).id !== root.id) return brokenGraph('Diagram ancestry changed during coordination.');
        const ids = new Set([root.id, ...(await this.findDescendants(root.id)).map(member => member.id)]);
        for (const id of _childDiagramIds) if (!ids.has(id) && this.documents.has(id)) return brokenGraph('Affected diagram belongs to a different Context root.');
        const snapshot = new Map([...this.documents].filter(([id]) => ids.has(id)).map(([id, document]) => [id, clone(document)]));
        const provenanceSnapshot = new Map([...this.provenance].filter(([id]) => ids.has(id)).map(([id, value]) => [id, { ...value }]));
        const revisionSnapshot = new Map([...this.revisions].filter(([id]) => ids.has(id)));
        const membershipSnapshot = new Map(this.membershipTimes);
        this.transactionMembers.set(root.id, ids);
        try { return await action(this, this); }
        catch (error) {
          const currentIds = new Set([...ids, ...memoryGraphIds(this.documents.values(), ids)]);
          for (const id of currentIds) { this.documents.delete(id); this.provenance.delete(id); this.revisions.delete(id); }
          for (const [id, document] of snapshot) this.documents.set(id, document);
          for (const [id, value] of provenanceSnapshot) this.provenance.set(id, value);
          for (const [id, value] of revisionSnapshot) this.revisions.set(id, value);
          this.membershipTimes = membershipSnapshot;
          throw error;
        }
      }
      finally { this.transactionMembers.delete(root.id); }
    });
  }
  findComponent(id: string) { for (const document of this.documents.values()) { const component = document.components.find(item => item.id === id); if (component) return { id: component.id, diagramId: component.diagramId, name: component.name, description:component.description, type:component.type, role:component.role ?? 'element', sourceComponentId:component.sourceComponentId ?? null }; } return undefined; }
  findRelationship(id: string) { for (const document of this.documents.values()) { const relationship = document.relationships.find(item => item.id === id); if (relationship) return { id: relationship.id, diagramId: relationship.diagramId }; } return undefined; }
  create(input: DiagramDocument): MaybePromise<DiagramDocument> {
    // Idle fixture creation remains synchronous; creation during coordination must wait.
    if (this.writerTail && !this.writerScope.getStore()?.active) return this.coordinateWrite(() => this.create(input));
    const document = diagramDocumentSchema.parse(input) as DiagramDocument;
    assertDiagramInvariants(document);
    if (document.scope && this.findContainerForOwner(getDiagramOwnerId(document)!)) throw new Error('diagrams_owner_component_unique');
    const normalized = { ...document, groups: normalizedGroups(document) };
    this.syncMembershipTimes(normalized, document.createdAt);
    this.documents.set(document.id, clone(normalized));
    this.revisions.set(document.id, 0n);
    for (const members of this.transactionMembers.values()) if (document.scope && members.has(document.scope.parentDiagramId)) members.add(document.id);
    return this.resolve(normalized);
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
    this.syncMembershipTimes(updated, updatedAt);
    this.documents.set(document.id, clone(updated));
    this.incrementDeletionRevision(document.id);
    return this.resolve(updated);
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
    this.incrementDeletionRevision(diagramId);
    return { document: this.resolve(updated), relationshipCount: 0 };
  }

  removeRelationship(diagramId: string, relationshipId: string): RemoveRelationshipResult | undefined {
    const document = this.documents.get(diagramId);
    if (!document || document.status !== 'active' || !document.relationships.some(relationship => relationship.id === relationshipId)) return undefined;
    const now = new Date().toISOString();
    const updated = { ...document, updatedAt: now, relationships: document.relationships.filter(relationship => relationship.id !== relationshipId) };
    this.documents.set(diagramId, clone(updated));
    this.incrementDeletionRevision(diagramId);
    return { document: this.resolve(updated) };
  }

  getTrashProvenance(id: string): TrashProvenance { return { ...(this.provenance.get(id) ?? { trashBatchId: null, trashRootDiagramId: null }) }; }
  trash(id: string, provenance: TrashProvenance = { trashBatchId: crypto.randomUUID(), trashRootDiagramId: id }) {
    const document = this.documents.get(id);
    if (!document || document.status === 'trashed') return undefined;
    const now = new Date().toISOString();
    const updated = { ...document, status: 'trashed' as const, trashedAt: now, updatedAt: now };
    this.documents.set(id, clone(updated));
    this.provenance.set(id, { ...provenance });
    this.incrementDeletionRevision(id);
    return this.resolve(updated);
  }

  restore(id: string) {
    const document = this.documents.get(id);
    if (!document || document.status !== 'trashed') return undefined;
    const updated = { ...document, status: 'active' as const, trashedAt: null, updatedAt: new Date().toISOString() };
    this.documents.set(id, clone(updated));
    this.provenance.delete(id);
    this.incrementDeletionRevision(id);
    return this.resolve(updated);
  }

  private resolve(document: DiagramDocument): DiagramDocument {
    const resolved = clone(document);
    if (!resolved.scope) return resolved;
    if (resolved.kind === 'component') {
      const scope = getComponentScope(resolved);
      const parent = this.documents.get(resolved.scope.parentDiagramId);
      const context = parent?.scope && this.documents.get(parent.scope.parentDiagramId);
      const system = context?.components.find(c => c.id === parent?.scope?.softwareSystemId);
      const owner = parent?.components.find(c => c.id === scope?.containerId);
      if (scope && parent && owner && context && system) {
        resolved.scope = componentScope(parent.id, owner, context.id, system);
        resolved.name = owner.name;
        resolved.components = resolved.components.map(c => {
          if (c.role !== 'external') return c;
          const immediate = parent.components.find(source => source.id === c.sourceComponentId);
          const source = immediate?.role === 'external' ? context.components.find(source => source.id === immediate.sourceComponentId) : immediate;
          return source ? { ...c, name: source.name, description: source.description, type: source.type, containerType: source.containerType ?? null, technology: source.technology ?? null } : c;
        });
      }
      return resolved;
    }
    if (resolved.kind !== 'container') return resolved;
    const parent = this.documents.get(resolved.scope.parentDiagramId);
    const owner = parent?.components.find(component => component.id === resolved.scope!.softwareSystemId);
    if (parent && owner) {
      resolved.scope = { ...resolved.scope, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
      resolved.name = getDiagramName(resolved);
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
    name: getDiagramName({ name: diagram.name, kind: diagram.kind as DiagramDocument['kind'], scope }),
    status: diagram.status,
    createdAt: iso(diagram.createdAt),
    updatedAt: iso(diagram.updatedAt),
    trashedAt: diagram.trashedAt ? iso(diagram.trashedAt) : null,
    kind: diagram.kind as NonNullable<DiagramDocument['kind']>,
    scope,
    boundary: diagram.kind !== 'general' ? { position: { x: diagram.scopeX!, y: diagram.scopeY! }, size: { width: diagram.scopeWidth!, height: diagram.scopeHeight! } } : null,
    components: componentRows.map(component => ({
      id: component.id, diagramId: component.diagramId,
      name: component.role === 'external' && component.sourceComponentId ? sourceComponents.get(component.sourceComponentId)?.name ?? component.name : component.name,
      description: component.role === 'external' && component.sourceComponentId && sourceComponents.has(component.sourceComponentId) ? sourceComponents.get(component.sourceComponentId)!.description : component.description,
      type: component.role === 'external' && component.sourceComponentId ? sourceComponents.get(component.sourceComponentId)?.type ?? component.type : component.type,
      role: component.role as NonNullable<DiagramDocument['components'][number]['role']>,
      containerType: (component.role === 'external' && component.sourceComponentId && sourceComponents.has(component.sourceComponentId) ? sourceComponents.get(component.sourceComponentId)!.containerType : component.containerType) as DiagramDocument['components'][number]['containerType'],
      technology: component.role === 'external' && component.sourceComponentId && sourceComponents.has(component.sourceComponentId) ? sourceComponents.get(component.sourceComponentId)!.technology : component.technology,
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
  constructor(private readonly db: PostgresExecutor, private readonly inTransaction = false, private readonly collectionTransaction = false) {}

  async readArchiveRows(diagramIds?: string[]): Promise<Pick<ArchiveRecords, DiagramArchiveCollection>> {
    if (!this.inTransaction) return this.withArchiveSnapshot(repository => repository.readArchiveRows(diagramIds));
    return { diagrams: await readArchiveTable(this.db,'diagrams',diagramIds), components: await readArchiveTable(this.db,'components',diagramIds), relationships: await readArchiveTable(this.db,'relationships',diagramIds), systemGroups: await readArchiveTable(this.db,'systemGroups',diagramIds), systemGroupMembers: await readArchiveTable(this.db,'systemGroupMembers',diagramIds) };
  }
  async upsertArchiveRows<C extends DiagramArchiveCollection>(collection: C, rows: ArchiveRecords[C]) { if (!this.collectionTransaction) throw new Error('Raw writes require collection coordination'); await upsertArchiveTable(this.db,collection,rows); }
  async removeArchiveRows(collection: DiagramArchiveCollection, identities: string[][]) { if (!this.collectionTransaction) throw new Error('Raw removal requires collection coordination'); await removeArchiveTable(this.db,collection,identities); }
  async getConfirmationEpoch(id: string) { const result = await this.db.execute(sql`SELECT epoch::text FROM diagram_confirmation_epochs WHERE diagram_id = ${id}::uuid`); return result.rows[0]?.epoch as string ?? '0'; }
  async advanceConfirmationEpochs(ids: string[]) {
    if (!this.collectionTransaction) throw new Error('Epoch writes require collection coordination');
    for (const id of new Set(ids.map(id => id.toLowerCase()))) await this.db.execute(sql`INSERT INTO diagram_confirmation_epochs (diagram_id, epoch) VALUES (${id}::uuid, 1) ON CONFLICT (diagram_id) DO UPDATE SET epoch = diagram_confirmation_epochs.epoch + 1`);
  }
  async deferArchiveSources() { if (!this.collectionTransaction) throw new Error('Source deferral requires collection coordination'); await this.db.execute(sql`SET CONSTRAINTS components_diagram_source_unique DEFERRED`); }
  async checkArchiveSources() { if (!this.collectionTransaction) throw new Error('Constraint check requires collection coordination'); await this.db.execute(sql`SET CONSTRAINTS components_diagram_source_unique IMMEDIATE`); }
  async withArchiveSnapshot<T>(action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    if (this.inTransaction) return action(this,this.db);
    return this.db.transaction(async tx => action(new PostgresDiagramRepository(tx,true),tx), { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }

  async withCollectionTransaction<T>(action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    if (this.inTransaction) {
      if (!this.collectionTransaction) throw new Error('Collection coordination must start before graph locks');
      return action(this, this.db);
    }
    return this.db.transaction(async (transaction: PostgresTransaction) => {
      await transaction.execute(sql`LOCK TABLE diagrams IN SHARE ROW EXCLUSIVE MODE`);
      return action(new PostgresDiagramRepository(transaction, true, true), transaction);
    });
  }

  async deletionBlockers(scope: DeletionScope): Promise<DeletionBlocker[]> {
    const diagrams = await this.db.select({ id: schema.diagrams.id, parentDiagramId: schema.diagrams.parentDiagramId, ownerComponentId: schema.diagrams.ownerComponentId, trashRootDiagramId: schema.diagrams.trashRootDiagramId }).from(schema.diagrams);
    const components = await this.db.select({ id: schema.components.id, diagramId: schema.components.diagramId, sourceComponentId: schema.components.sourceComponentId }).from(schema.components);
    const relationships = await this.db.select({ id: schema.relationships.id, diagramId: schema.relationships.diagramId, sourceComponentId: schema.relationships.sourceComponentId, targetComponentId: schema.relationships.targetComponentId }).from(schema.relationships);
    const groups = await this.db.select({ id: schema.systemGroups.id, diagramId: schema.systemGroups.diagramId }).from(schema.systemGroups);
    const members = await this.db.select({ groupId: schema.systemGroupMembers.groupId, componentId: schema.systemGroupMembers.componentId }).from(schema.systemGroupMembers);
    return diagramDeletionBlockers(scope, diagrams, components, relationships, groups, members);
  }
  async purge(diagramIds: string[]): Promise<void> {
    if (!this.inTransaction) throw new Error('Purge requires a graph transaction');
    if (!diagramIds.length) return;
    await this.db.update(schema.diagrams).set({ trashRootDiagramId: null, trashBatchId: null }).where(inArray(schema.diagrams.id, diagramIds));
    const groups = await this.db.select({ id: schema.systemGroups.id }).from(schema.systemGroups).where(inArray(schema.systemGroups.diagramId, diagramIds));
    if (groups.length) await this.db.delete(schema.systemGroupMembers).where(inArray(schema.systemGroupMembers.groupId, groups.map(g => g.id)));
    await this.db.delete(schema.systemGroups).where(inArray(schema.systemGroups.diagramId, diagramIds));
    await this.db.delete(schema.relationships).where(inArray(schema.relationships.diagramId, diagramIds));
    for (const id of diagramIds) {
      await this.db.delete(schema.components).where(eq(schema.components.diagramId, id));
      await this.db.delete(schema.diagrams).where(eq(schema.diagrams.id, id));
    }
  }

  async list(): Promise<DiagramDocument[]> {
    return (await this.listAll()).filter(document => document.status === 'active');
  }

  async listTrash(): Promise<DiagramDocument[]> {
    return (await this.listAll()).filter(document => document.status === 'trashed');
  }

  /** One read snapshot and a fixed query count, regardless of child/occurrence count. */
  async listAll(): Promise<DiagramDocument[]> {
    if (!this.inTransaction) return this.db.transaction(tx => new PostgresDiagramRepository(tx, true).listAll(), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    const diagrams = await this.db.select().from(schema.diagrams).orderBy(asc(schema.diagrams.updatedAt), asc(schema.diagrams.id));
    const components = await this.db.select().from(schema.components).orderBy(asc(schema.components.createdAt), asc(schema.components.id));
    const relationships = await this.db.select().from(schema.relationships).orderBy(asc(schema.relationships.createdAt), asc(schema.relationships.id));
    const groups = await this.db.select().from(schema.systemGroups).orderBy(asc(schema.systemGroups.createdAt), asc(schema.systemGroups.id));
    const members = await this.db.select().from(schema.systemGroupMembers).orderBy(asc(schema.systemGroupMembers.createdAt), asc(schema.systemGroupMembers.componentId));
    const diagramsById = new Map(diagrams.map(d => [d.id, d]));
    const componentsById = new Map(components.map(c => [c.id, c]));
    const byDiagram = <T extends { diagramId: string }>(rows: T[]) => {
      const result = new Map<string, T[]>();
      for (const row of rows) { const batch = result.get(row.diagramId) ?? []; batch.push(row); result.set(row.diagramId, batch); }
      return result;
    };
    const componentsByDiagram = byDiagram(components), relationshipsByDiagram = byDiagram(relationships), groupsByDiagram = byDiagram(groups);
    const membersByGroup = new Map<string, typeof members>();
    for (const member of members) { const batch = membersByGroup.get(member.groupId) ?? []; batch.push(member); membersByGroup.set(member.groupId, batch); }
    return diagrams.map(diagram => {
      const parent = diagram.parentDiagramId ? diagramsById.get(diagram.parentDiagramId) : undefined;
      const owner = diagram.ownerComponentId ? componentsById.get(diagram.ownerComponentId) : undefined;
      const context = parent?.parentDiagramId ? diagramsById.get(parent.parentDiagramId) : undefined;
      const system = parent?.ownerComponentId ? componentsById.get(parent.ownerComponentId) : undefined;
      const scope = diagram.kind === 'container' && parent && owner ? { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description }
        : diagram.kind === 'component' && parent && owner && context && system ? componentScope(parent.id, owner, context.id, system) : null;
      const localGroups = groupsByDiagram.get(diagram.id) ?? [];
      let sources = componentsById;
      // Copy only this child's projections, rather than every component in the database.
      if (diagram.kind === 'component') sources = new Map((componentsByDiagram.get(diagram.id) ?? []).flatMap(component => {
        const source = component.sourceComponentId && componentsById.get(component.sourceComponentId);
        return source ? [[source.id, source] as const] : [];
      }));
      if (diagram.kind === 'component') for (const component of componentsByDiagram.get(diagram.id) ?? []) {
        const source = component.sourceComponentId && componentsById.get(component.sourceComponentId);
        if (source && source.role === 'external' && source.sourceComponentId) {
          const canonical = componentsById.get(source.sourceComponentId);
          if (canonical) sources.set(source.id, canonical);
        }
      }
      return mapDocument(diagram, componentsByDiagram.get(diagram.id) ?? [], relationshipsByDiagram.get(diagram.id) ?? [], localGroups, localGroups.flatMap(group => membersByGroup.get(group.id) ?? []), scope, sources);
    });
  }

  async get(id: string): Promise<DiagramDocument | undefined> { return this.load(id); }

  async getDeletionRevision(id: string): Promise<string | undefined> {
    const [row] = await this.db.select({ revision: schema.diagrams.deletionRevision }).from(schema.diagrams).where(eq(schema.diagrams.id, id));
    return row?.revision.toString();
  }
  async incrementDeletionRevision(id: string): Promise<void> {
    const rows = await this.db.update(schema.diagrams).set({ deletionRevision: sql`${schema.diagrams.deletionRevision} + 1` }).where(eq(schema.diagrams.id, id)).returning({ id: schema.diagrams.id });
    if (!rows.length) throw new Error('Diagram revision not found');
  }

  async findContainerForOwner(ownerComponentId: string): Promise<DiagramDocument | undefined> {
    const [diagram] = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.ownerComponentId, ownerComponentId)).limit(1);
    return diagram ? this.load(diagram.id) : undefined;
  }

  async withGraphTransaction<T>(parentDiagramId: string, childDiagramIds: string[], action: (repository: DiagramRepositoryLike, transaction?: unknown) => MaybePromise<T>): Promise<T> {
    if (this.inTransaction) return await action(this, this.db);
    return this.db.transaction(async (transaction: PostgresTransaction) => {
      // Acquire the collection writer barrier before any graph discovery or row lock.
      await transaction.execute(sql`LOCK TABLE diagrams IN ROW EXCLUSIVE MODE`);
      const scoped = new PostgresDiagramRepository(transaction, true);
      const root = await graphRoot(scoped, parentDiagramId);
      await transaction.select({ id:schema.diagrams.id }).from(schema.diagrams).where(eq(schema.diagrams.id, root.id)).for('update');
      // Rediscover only after the root lock: every compliant writer shares it.
      if ((await graphRoot(scoped, parentDiagramId)).id !== root.id) return brokenGraph('Diagram ancestry changed during coordination.');
      const members = await scoped.findDescendants(root.id);
      const membership = new Set([root.id, ...members.map(member => member.id)]);
      for (const id of childDiagramIds) if (!membership.has(id)) {
        // Creation callers may supply the not-yet-created child UUID.
        if (await scoped.getGraphMembership(id)) return brokenGraph('Affected diagram belongs to a different Context root.');
      }
      for (const member of members) await transaction.select({ id:schema.diagrams.id }).from(schema.diagrams).where(eq(schema.diagrams.id, member.id)).for('update');
      return action(scoped, transaction);
    });
  }
  async getGraphMembership(id: string): Promise<GraphMembership | undefined> {
    const [row] = await this.db.select({ id: schema.diagrams.id, kind: schema.diagrams.kind, status: schema.diagrams.status, parentDiagramId: schema.diagrams.parentDiagramId, ownerComponentId: schema.diagrams.ownerComponentId, createdAt: schema.diagrams.createdAt, updatedAt: schema.diagrams.updatedAt }).from(schema.diagrams).where(eq(schema.diagrams.id, id)).limit(1);
    return row && { ...row, kind: row.kind as DiagramKind, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }
  findAncestors(id: string) { return graphAncestors(this, id); }
  findDescendants(id: string) { return graphDescendants(this, id); }

  async findComponent(id: string) { const [component] = await this.db.select({ id: schema.components.id, diagramId: schema.components.diagramId, name: schema.components.name, description:schema.components.description, type:schema.components.type, role:schema.components.role, sourceComponentId:schema.components.sourceComponentId }).from(schema.components).where(eq(schema.components.id, id)).limit(1); return component; }
  async findRelationship(id: string) { const [relationship] = await this.db.select({ id: schema.relationships.id, diagramId: schema.relationships.diagramId }).from(schema.relationships).where(eq(schema.relationships.id, id)).limit(1); return relationship; }
  async findChildren(parentDiagramId: string): Promise<DiagramDocument[]> {
    const rows = await this.db.select({ id:schema.diagrams.id }).from(schema.diagrams).where(eq(schema.diagrams.parentDiagramId, parentDiagramId)).orderBy(asc(schema.diagrams.id));
    const documents = await Promise.all(rows.map(row => this.load(row.id)));
    return documents.filter((document): document is DiagramDocument => Boolean(document));
  }
  async findChildMembership(parentDiagramId: string): Promise<ChildMembership[]> {
    const rows = await this.db.select({ id: schema.diagrams.id, status: schema.diagrams.status, parentDiagramId: schema.diagrams.parentDiagramId, ownerComponentId: schema.diagrams.ownerComponentId, createdAt: schema.diagrams.createdAt, updatedAt: schema.diagrams.updatedAt })
      .from(schema.diagrams).where(eq(schema.diagrams.parentDiagramId, parentDiagramId)).orderBy(asc(schema.diagrams.id));
    return rows.map(row => ({ ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async create(document: DiagramDocument): Promise<DiagramDocument> {
    document = validatePersistableDocument(document);
    const now = new Date();
    const insert = async (tx: NodePgDatabase<typeof schema>) => {
      if (!this.inTransaction) await tx.execute(sql`LOCK TABLE diagrams IN ROW EXCLUSIVE MODE`);
      await tx.insert(schema.diagrams).values({
        id: document.id, name: document.name.trim(), status: 'active',
        createdAt: dateValue(document.createdAt, 'createdAt'), updatedAt: now, trashedAt: null,
        kind: document.kind ?? 'general',
        parentDiagramId: document.scope?.parentDiagramId ?? null,
        ownerComponentId: getDiagramOwnerId(document),
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
    const replace = async (tx: NodePgDatabase<typeof schema>) => {
      await tx.update(schema.diagrams).set({
        name: document.name.trim(), updatedAt: now, kind: document.kind ?? 'general',
        deletionRevision: sql`${schema.diagrams.deletionRevision} + 1`,
        parentDiagramId: document.scope?.parentDiagramId ?? null, ownerComponentId: getDiagramOwnerId(document),
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
    const remove = async (tx: NodePgDatabase<typeof schema>) => {
      await tx.delete(schema.components).where(eq(schema.components.id, componentId));
      await tx.update(schema.diagrams).set({ updatedAt: now, deletionRevision: sql`${schema.diagrams.deletionRevision} + 1` }).where(eq(schema.diagrams.id, diagramId));
    };
    if (this.inTransaction) await remove(this.db); else await this.db.transaction(remove);
    return { document: (await this.get(diagramId))!, relationshipCount: 0 };
  }

  async removeRelationship(diagramId: string, relationshipId: string): Promise<RemoveRelationshipResult | undefined> {
    const existing = await this.get(diagramId);
    if (!existing || existing.status !== 'active' || !existing.relationships.some(relationship => relationship.id === relationshipId)) return undefined;
    const now = new Date();
    const remove = async (tx: NodePgDatabase<typeof schema>) => {
      await tx.delete(schema.relationships).where(eq(schema.relationships.id, relationshipId));
      await tx.update(schema.diagrams).set({ updatedAt: now, deletionRevision: sql`${schema.diagrams.deletionRevision} + 1` }).where(eq(schema.diagrams.id, diagramId));
    };
    if (this.inTransaction) await remove(this.db); else await this.db.transaction(remove);
    return { document: (await this.get(diagramId))! };
  }

  async getTrashProvenance(id: string): Promise<TrashProvenance> {
    const [row] = await this.db.select({ trashBatchId: schema.diagrams.trashBatchId, trashRootDiagramId: schema.diagrams.trashRootDiagramId }).from(schema.diagrams).where(eq(schema.diagrams.id, id)).limit(1);
    return row ?? { trashBatchId: null, trashRootDiagramId: null };
  }
  async trash(id: string, provenance: TrashProvenance = { trashBatchId: crypto.randomUUID(), trashRootDiagramId: id }): Promise<DiagramDocument | undefined> {
    const existing = await this.get(id);
    if (!existing || existing.status === 'trashed') return undefined;
    const now = new Date();
    await this.db.update(schema.diagrams).set({ status: 'trashed', trashedAt: now, updatedAt: now, ...provenance, deletionRevision: sql`${schema.diagrams.deletionRevision} + 1` }).where(eq(schema.diagrams.id, id));
    return (await this.get(id))!;
  }

  async restore(id: string): Promise<DiagramDocument | undefined> {
    const existing = await this.get(id);
    if (!existing || existing.status !== 'trashed') return undefined;
    await this.db.update(schema.diagrams).set({ status: 'active', trashedAt: null, updatedAt: new Date(), trashBatchId: null, trashRootDiagramId: null, deletionRevision: sql`${schema.diagrams.deletionRevision} + 1` }).where(eq(schema.diagrams.id, id));
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
    if (diagram.kind !== 'general' && diagram.parentDiagramId && diagram.ownerComponentId) {
      const [[parent], [owner]] = await Promise.all([
        this.db.select().from(schema.diagrams).where(eq(schema.diagrams.id, diagram.parentDiagramId)).limit(1),
        this.db.select().from(schema.components).where(eq(schema.components.id, diagram.ownerComponentId)).limit(1),
      ]);
      if (diagram.kind === 'container' && parent && owner) scope = { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
      else if (diagram.kind === 'component' && parent?.parentDiagramId && parent.ownerComponentId && owner) {
        const [[context], [system]] = await Promise.all([
          this.db.select().from(schema.diagrams).where(eq(schema.diagrams.id, parent.parentDiagramId)).limit(1),
          this.db.select().from(schema.components).where(eq(schema.components.id, parent.ownerComponentId)).limit(1),
        ]);
        if (context && system) scope = componentScope(parent.id, { ...owner, containerType: owner.containerType as ComponentScope['containerType'] }, context.id, system);
      }
    }
    const sourceIds = componentRows.flatMap(component => component.sourceComponentId ? [component.sourceComponentId] : []);
    const sourceRows = sourceIds.length ? await this.db.select().from(schema.components).where(inArray(schema.components.id, sourceIds)) : [];
    const sources = new Map(sourceRows.map(component => [component.id, component]));
    if (diagram.kind === 'component') {
      const canonicalIds = sourceRows.flatMap(source => source.role === 'external' && source.sourceComponentId ? [source.sourceComponentId] : []);
      const canonicalRows = canonicalIds.length ? await this.db.select().from(schema.components).where(inArray(schema.components.id, canonicalIds)) : [];
      const canonicalById = new Map(canonicalRows.map(source => [source.id, source]));
      for (const source of sourceRows) { const canonical = source.sourceComponentId && canonicalById.get(source.sourceComponentId); if (canonical) sources.set(source.id, canonical); }
    }
    return mapDocument(diagram, componentRows, relationshipRows, groupRows, memberRows.flat(), scope, sources);
  }

  private async insertChildren(
    tx: NodePgDatabase<typeof schema>,
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
    tx: NodePgDatabase<typeof schema>,
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
      const retained = document.groups.find(g => g.id === id)?.memberComponentIds ?? [];
      await tx.delete(schema.systemGroupMembers).where(retained.length ? and(eq(schema.systemGroupMembers.groupId,id), notInArray(schema.systemGroupMembers.componentId,retained)) : eq(schema.systemGroupMembers.groupId,id));
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
      if (group.memberComponentIds.length > 0) await tx.insert(schema.systemGroupMembers).values(group.memberComponentIds.map(componentId => ({ groupId: group.id, componentId, createdAt: now }))).onConflictDoNothing();
    }
  }
}
