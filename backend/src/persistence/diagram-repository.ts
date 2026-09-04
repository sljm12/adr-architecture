import { asc, eq } from 'drizzle-orm';
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
  create(document: DiagramDocument): MaybePromise<DiagramDocument>;
  replace(document: DiagramDocument): MaybePromise<DiagramDocument | undefined>;
  removeComponent(diagramId: string, componentId: string): MaybePromise<RemoveComponentResult | undefined>;
  trash(id: string): MaybePromise<DiagramDocument | undefined>;
  restore(id: string): MaybePromise<DiagramDocument | undefined>;
}

export type RemoveComponentResult =
  | { document: DiagramDocument; relationshipCount: number }
  | { conflict: true; relationshipCount: number };

const clone = (document: DiagramDocument) => structuredClone(document);

/** Isolated repository used by tests; production injects PostgresDiagramRepository. */
export class DiagramRepository implements DiagramRepositoryLike {
  private documents = new Map<string, DiagramDocument>();

  list() { return [...this.documents.values()].filter(d => d.status === 'active').map(clone); }
  listTrash() { return [...this.documents.values()].filter(d => d.status === 'trashed').map(clone); }
  get(id: string) { const document = this.documents.get(id); return document && clone(document); }
  create(document: DiagramDocument) { this.documents.set(document.id, clone(document)); return clone(document); }
  replace(document: DiagramDocument) { this.documents.set(document.id, clone(document)); return clone(document); }

  removeComponent(diagramId: string, componentId: string): RemoveComponentResult | undefined {
    const document = this.documents.get(diagramId);
    if (!document || document.status !== 'active' || !document.components.some(component => component.id === componentId)) return undefined;
    const dependentIds = new Set(document.relationships.filter(r => r.sourceComponentId === componentId || r.targetComponentId === componentId).map(r => r.id));
    if (dependentIds.size > 0) return { conflict: true, relationshipCount: dependentIds.size };
    const now = new Date().toISOString();
    const updated = { ...document, updatedAt: now, components: document.components.filter(c => c.id !== componentId) };
    this.documents.set(diagramId, clone(updated));
    return { document: clone(updated), relationshipCount: 0 };
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
}

type PostgresDatabase = NodePgDatabase<typeof schema>;

function validationError(path: (string | number)[], message: string): never {
  throw new z.ZodError([{ code: 'custom', path, message }]);
}

function validatePersistableDocument(document: DiagramDocument): void {
  diagramDocumentSchema.parse(document);
  assertDiagramInvariants(document);
  for (const component of document.components) {
    if (component.diagramId !== document.id) validationError(['components', component.id, 'diagramId'], 'Component must belong to the diagram');
  }
  for (const relationship of document.relationships) {
    if (relationship.diagramId !== document.id) validationError(['relationships', relationship.id, 'diagramId'], 'Relationship must belong to the diagram');
  }
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
): DiagramDocument {
  return {
    id: diagram.id,
    name: diagram.name,
    status: diagram.status,
    createdAt: iso(diagram.createdAt),
    updatedAt: iso(diagram.updatedAt),
    trashedAt: diagram.trashedAt ? iso(diagram.trashedAt) : null,
    components: componentRows.map(component => ({
      id: component.id, diagramId: component.diagramId, name: component.name,
      description: component.description, type: component.type,
      position: { x: component.x, y: component.y },
      createdAt: iso(component.createdAt), updatedAt: iso(component.updatedAt),
    })),
    relationships: relationshipRows.map(relationship => ({
      id: relationship.id, diagramId: relationship.diagramId,
      sourceComponentId: relationship.sourceComponentId,
      targetComponentId: relationship.targetComponentId,
      direction: relationship.direction, label: relationship.label,
      createdAt: iso(relationship.createdAt), updatedAt: iso(relationship.updatedAt),
    })),
  };
}

/** PostgreSQL/Drizzle repository used by the API server. */
export class PostgresDiagramRepository implements DiagramRepositoryLike {
  constructor(private readonly db: PostgresDatabase) {}

  async list(): Promise<DiagramDocument[]> {
    const rows = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.status, 'active')).orderBy(asc(schema.diagrams.updatedAt));
    return Promise.all(rows.map(row => this.load(row.id)) as Promise<DiagramDocument>[]);
  }

  async listTrash(): Promise<DiagramDocument[]> {
    const rows = await this.db.select().from(schema.diagrams).where(eq(schema.diagrams.status, 'trashed')).orderBy(asc(schema.diagrams.updatedAt));
    return Promise.all(rows.map(row => this.load(row.id)) as Promise<DiagramDocument>[]);
  }

  async get(id: string): Promise<DiagramDocument | undefined> { return this.load(id); }

  async create(document: DiagramDocument): Promise<DiagramDocument> {
    validatePersistableDocument(document);
    const now = new Date();
    await this.db.transaction(async tx => {
      await tx.insert(schema.diagrams).values({
        id: document.id, name: document.name.trim(), status: 'active',
        createdAt: dateValue(document.createdAt, 'createdAt'), updatedAt: now, trashedAt: null,
      });
      await this.insertChildren(tx, document, now, new Map(), new Map());
    });
    return (await this.get(document.id))!;
  }

  async replace(document: DiagramDocument): Promise<DiagramDocument | undefined> {
    validatePersistableDocument(document);
    const existing = await this.get(document.id);
    if (!existing || existing.status !== 'active') return undefined;
    const now = new Date();
    const existingComponents = new Map(existing.components.map(component => [component.id, component]));
    const existingRelationships = new Map(existing.relationships.map(relationship => [relationship.id, relationship]));
    await this.db.transaction(async tx => {
      await tx.update(schema.diagrams).set({ name: document.name.trim(), updatedAt: now }).where(eq(schema.diagrams.id, document.id));
      await tx.delete(schema.relationships).where(eq(schema.relationships.diagramId, document.id));
      await tx.delete(schema.components).where(eq(schema.components.diagramId, document.id));
      await this.insertChildren(tx, document, now, existingComponents, existingRelationships);
    });
    return (await this.get(document.id))!;
  }

  async removeComponent(diagramId: string, componentId: string): Promise<RemoveComponentResult | undefined> {
    const existing = await this.get(diagramId);
    if (!existing || existing.status !== 'active' || !existing.components.some(component => component.id === componentId)) return undefined;
    const relationshipCount = existing.relationships.filter(relationship => relationship.sourceComponentId === componentId || relationship.targetComponentId === componentId).length;
    if (relationshipCount > 0) return { conflict: true, relationshipCount };
    const now = new Date();
    await this.db.transaction(async tx => {
      await tx.delete(schema.components).where(eq(schema.components.id, componentId));
      await tx.update(schema.diagrams).set({ updatedAt: now }).where(eq(schema.diagrams.id, diagramId));
    });
    return { document: (await this.get(diagramId))!, relationshipCount: 0 };
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
    return mapDocument(diagram, componentRows, relationshipRows);
  }

  private async insertChildren(
    tx: any,
    document: DiagramDocument,
    now: Date,
    existingComponents: Map<string, DiagramDocument['components'][number]>,
    existingRelationships: Map<string, DiagramDocument['relationships'][number]>,
  ): Promise<void> {
    if (document.components.length > 0) {
      await tx.insert(schema.components).values(document.components.map(component => {
        const previous = existingComponents.get(component.id);
        return {
          id: component.id, diagramId: document.id, name: component.name.trim(),
          description: component.description, type: component.type,
          x: component.position.x, y: component.position.y,
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
          createdAt: previous ? dateValue(previous.createdAt, `relationships.${relationship.id}.createdAt`) : dateValue(relationship.createdAt, `relationships.${relationship.id}.createdAt`),
          updatedAt: now,
        };
      }));
    }
  }
}
