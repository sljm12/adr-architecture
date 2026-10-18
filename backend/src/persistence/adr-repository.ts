import { and, asc, count, eq, inArray, notInArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AdrDependencyBlocker, AdrSummary, ArchitectureDecisionRecord, AdrWritePayload, ComponentAdrCount, ComponentAdrSummary, ComponentReference, RelationshipAdrSummary, RelationshipReference } from '../../../shared/src/index';
import { adrComponentsWriteSchema, adrRelationshipsWriteSchema, adrWriteSchema, assertAdrInvariants } from '../../../shared/src/index';
import * as schema from './schema';
import { deletionBlocker, type MaybePromise, type DeletionScope, type DeletionBlocker } from './diagram-repository';
import { archiveTimestamp, sortArchiveRows, readArchiveTable, upsertArchiveTable, removeArchiveTable, normalizeArchiveRows, type AdrArchiveCollection } from './archive-repository';
import type { ArchiveRecords } from '../../../shared/src/index';

export type AdrDeleteResult = { deleted: true } | { deleted: false; blockers: AdrDependencyBlocker[] };

export interface AdrRepositoryLike {
  registerArchiveReferences?(records: ArchiveRecords): void;
  readArchiveRows(diagramIds?: string[]): MaybePromise<Pick<ArchiveRecords, AdrArchiveCollection>>;
  upsertArchiveRows<C extends AdrArchiveCollection>(collection: C, rows: ArchiveRecords[C]): MaybePromise<void>;
  removeArchiveRows(collection: AdrArchiveCollection, identities: string[][]): MaybePromise<void>;
  deletionBlockers(scope: DeletionScope): MaybePromise<DeletionBlocker[]>;
  purgeOwned(diagramIds: string[]): MaybePromise<void>;
  list(diagramId: string): MaybePromise<AdrSummary[]>;
  listFull(diagramId: string): MaybePromise<ArchitectureDecisionRecord[]>;
  get(id: string): MaybePromise<ArchitectureDecisionRecord | undefined>;
  create(diagramId: string, payload: AdrWritePayload): MaybePromise<ArchitectureDecisionRecord>;
  update(id: string, payload: AdrWritePayload): MaybePromise<ArchitectureDecisionRecord | undefined>;
  replaceLinks(id: string, componentIds: string[]): MaybePromise<ArchitectureDecisionRecord | undefined>;
  replaceRelationshipLinks(id: string, relationshipIds: string[]): MaybePromise<ArchitectureDecisionRecord | undefined>;
  listByComponent(diagramId: string, componentId: string): MaybePromise<ComponentAdrSummary[] | undefined>;
  componentAdrCounts(diagramId: string): MaybePromise<ComponentAdrCount[]>;
  listByRelationship(diagramId: string, relationshipId: string): MaybePromise<RelationshipAdrSummary[] | undefined>;
  delete(id: string): MaybePromise<AdrDeleteResult | undefined>;
  componentBlockers(componentId: string): MaybePromise<AdrDependencyBlocker[]>;
  relationshipBlockers(relationshipId: string): MaybePromise<AdrDependencyBlocker[]>;
  withTransaction?(transaction: unknown): AdrRepositoryLike;
  snapshotGraph?(diagramIds?: string[]): unknown;
  restoreGraphSnapshot?(snapshot: unknown, diagramIds?: string[]): void;
}

const clone = <T>(value: T): T => structuredClone(value);
function adrDeletionBlockers(scope: DeletionScope, records: Pick<ArchitectureDecisionRecord, 'id' | 'diagramId' | 'componentIds' | 'relationshipIds' | 'replacementAdrId'>[]): DeletionBlocker[] {
  const diagrams = new Set(scope.diagramIds), components = new Set(scope.componentIds), relationships = new Set(scope.relationshipIds);
  const owned = new Set(records.filter(a => diagrams.has(a.diagramId)).map(a => a.id));
  const blockers: DeletionBlocker[] = [];
  for (const a of records) if (!diagrams.has(a.diagramId)) {
    if (a.componentIds.some(id => components.has(id))) blockers.push(deletionBlocker(a.diagramId, a.id, 'An ADR component link would be broken.'));
    if (a.relationshipIds.some(id => relationships.has(id))) blockers.push(deletionBlocker(a.diagramId, a.id, 'An ADR relationship link would be broken.'));
    if (a.replacementAdrId && owned.has(a.replacementAdrId)) blockers.push(deletionBlocker(a.diagramId, a.id, `Replacement ADR ${a.replacementAdrId} would be removed.`));
  }
  return blockers;
}
const cleanPayload = (payload: AdrWritePayload): AdrWritePayload => adrWriteSchema.parse(payload);
const summaryOf = (adr: ArchitectureDecisionRecord): AdrSummary => ({ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt, componentCount: adr.componentIds.length, relationshipCount: adr.relationshipIds.length });
const componentSummaryOf = (adr: ArchitectureDecisionRecord): ComponentAdrSummary => ({ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt });
const relationshipSummaryOf = (adr: ArchitectureDecisionRecord): RelationshipAdrSummary => ({ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt });
const byUpdatedAtThenId = <T extends { updatedAt: string; id: string }>(left: T, right: T) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id);

/** Deterministic repository used by unit/API tests and local development. */
export class AdrRepository implements AdrRepositoryLike {
  private readonly records = new Map<string, ArchitectureDecisionRecord>();
  private readonly diagrams = new Set<string>();
  private readonly components = new Map<string, { id: string; diagramId: string; name: string }>();
  private readonly relationships = new Map<string, { id: string; diagramId: string }>();
  private componentLinkTimes = new Map<string, string>();
  private relationshipLinkTimes = new Map<string, string>();

  readArchiveRows(diagramIds?: string[]): Pick<ArchiveRecords, AdrArchiveCollection> {
    const ids = diagramIds && new Set(diagramIds.map(id => id.toLowerCase()));
    const records = [...this.records.values()].filter(a => !ids || ids.has(a.diagramId.toLowerCase()));
    return {
      adrs: sortArchiveRows('adrs', records.map(({ componentIds: _c, relationshipIds: _r, ...a }) => ({ ...a, createdAt: archiveTimestamp(a.createdAt), updatedAt: archiveTimestamp(a.updatedAt) }))),
      adrComponentLinks: sortArchiveRows('adrComponentLinks', records.flatMap(a => a.componentIds.map(componentId => ({ adrId: a.id, componentId, createdAt: this.componentLinkTimes.get(`${a.id}/${componentId}`)! })))),
      adrRelationshipLinks: sortArchiveRows('adrRelationshipLinks', records.flatMap(a => a.relationshipIds.map(relationshipId => ({ adrId: a.id, relationshipId, createdAt: this.relationshipLinkTimes.get(`${a.id}/${relationshipId}`)! })))),
    };
  }
  upsertArchiveRows<C extends AdrArchiveCollection>(collection: C, rows: ArchiveRecords[C]) {
    rows = normalizeArchiveRows(collection,rows);
    if (collection === 'adrs') for (const a of rows as ArchiveRecords['adrs']) {
      const previous = this.records.get(a.id);
      this.records.set(a.id, { ...a, componentIds: previous?.componentIds ?? [], relationshipIds: previous?.relationshipIds ?? [] }); this.diagrams.add(a.diagramId);
    }
    else for (const link of rows as ArchiveRecords['adrComponentLinks'] | ArchiveRecords['adrRelationshipLinks']) {
      const a = this.records.get(link.adrId); if (!a) throw new Error('Archive link requires its ADR');
      if ('componentId' in link) { if (!a.componentIds.includes(link.componentId)) a.componentIds.push(link.componentId); this.componentLinkTimes.set(`${a.id}/${link.componentId}`, link.createdAt); }
      else { if (!a.relationshipIds.includes(link.relationshipId)) a.relationshipIds.push(link.relationshipId); this.relationshipLinkTimes.set(`${a.id}/${link.relationshipId}`, link.createdAt); }
    }
  }
  removeArchiveRows(collection: AdrArchiveCollection, identities: string[][]) {
    for (const [id, endpoint] of identities.map(identity => identity.map(value => value.toLowerCase()))) {
      const a = this.records.get(id); if (!a) continue;
      if (collection === 'adrs') { this.clearLinkTimes(a); this.records.delete(id); }
      else if (collection === 'adrComponentLinks') { a.componentIds = a.componentIds.filter(c => c !== endpoint); this.componentLinkTimes.delete(`${id}/${endpoint}`); }
      else { a.relationshipIds = a.relationshipIds.filter(r => r !== endpoint); this.relationshipLinkTimes.delete(`${id}/${endpoint}`); }
    }
  }
  private clearLinkTimes(a: ArchitectureDecisionRecord) {
    for (const id of a.componentIds) this.componentLinkTimes.delete(`${a.id}/${id}`);
    for (const id of a.relationshipIds) this.relationshipLinkTimes.delete(`${a.id}/${id}`);
  }
  private syncLinkTimes(a: ArchitectureDecisionRecord) {
    const previous = this.records.get(a.id);
    for (const id of previous?.componentIds ?? []) if (!a.componentIds.includes(id)) this.componentLinkTimes.delete(`${a.id}/${id}`);
    for (const id of previous?.relationshipIds ?? []) if (!a.relationshipIds.includes(id)) this.relationshipLinkTimes.delete(`${a.id}/${id}`);
    for (const id of a.componentIds) if (!this.componentLinkTimes.has(`${a.id}/${id}`)) this.componentLinkTimes.set(`${a.id}/${id}`, archiveTimestamp(a.updatedAt));
    for (const id of a.relationshipIds) if (!this.relationshipLinkTimes.has(`${a.id}/${id}`)) this.relationshipLinkTimes.set(`${a.id}/${id}`, archiveTimestamp(a.updatedAt));
  }

  deletionBlockers(scope: DeletionScope) { return adrDeletionBlockers(scope, [...this.records.values()]); }
  purgeOwned(diagramIds: string[]) {
    const ids = new Set(diagramIds);
    for (const [id, adr] of this.records) if (ids.has(adr.diagramId)) { this.clearLinkTimes(adr); this.records.delete(id); }
    for (const [id, component] of this.components) if (ids.has(component.diagramId)) this.components.delete(id);
    for (const [id, relationship] of this.relationships) if (ids.has(relationship.diagramId)) this.relationships.delete(id);
    for (const id of ids) this.diagrams.delete(id);
  }

  registerDiagram(id: string): void { this.diagrams.add(id); }
  registerArchiveReferences(records: ArchiveRecords): void {
    this.diagrams.clear(); this.components.clear(); this.relationships.clear();
    for (const diagram of records.diagrams) this.registerDiagram(diagram.id);
    for (const component of records.components) this.registerComponent(component);
    for (const relationship of records.relationships) this.registerRelationship(relationship);
  }
  registerComponent(component: { id: string; diagramId: string; name: string }): void { this.diagrams.add(component.diagramId); this.components.set(component.id, { id: component.id, diagramId: component.diagramId, name: component.name }); }
  registerRelationship(relationship: { id: string; diagramId: string }): void { this.diagrams.add(relationship.diagramId); this.relationships.set(relationship.id, { id: relationship.id, diagramId: relationship.diagramId }); }
  registerAdr(adr: ArchitectureDecisionRecord): void { assertAdrInvariants(adr); this.syncLinkTimes(adr); this.records.set(adr.id, clone(adr)); this.diagrams.add(adr.diagramId); }
  withTransaction() { return this; }
  snapshotGraph(diagramIds?: string[]) { return { diagramIds, records:new Map([...this.records].map(([id, adr]) => [id, clone(adr)])), diagrams:new Set(this.diagrams), components:new Map(this.components), relationships:new Map(this.relationships), componentLinkTimes: new Map(this.componentLinkTimes), relationshipLinkTimes: new Map(this.relationshipLinkTimes) }; }
  restoreGraphSnapshot(snapshot: unknown, diagramIds?: string[]) {
    const state = snapshot as ReturnType<AdrRepository['snapshotGraph']>;
    const affected = state.diagramIds ? new Set([...state.diagramIds, ...(diagramIds ?? [])]) : undefined;
    const affectedAdrs = new Set([...this.records.values(),...state.records.values()].filter(a => !affected || affected.has(a.diagramId)).map(a => a.id));
    for (const [target, source] of [[this.componentLinkTimes,state.componentLinkTimes],[this.relationshipLinkTimes,state.relationshipLinkTimes]]) {
      for (const key of target.keys()) if (affectedAdrs.has(key.split('/')[0])) target.delete(key);
      for (const [key, value] of source) if (affectedAdrs.has(key.split('/')[0])) target.set(key,value);
    }
    const restore = <T extends { diagramId:string }>(target: Map<string,T>, source: Map<string,T>) => {
      for (const [id, item] of target) if (!affected || affected.has(item.diagramId)) target.delete(id);
      for (const [id, item] of source) if (!affected || affected.has(item.diagramId)) target.set(id, clone(item));
    };
    restore(this.records, state.records); restore(this.components, state.components); restore(this.relationships, state.relationships);
    for (const id of this.diagrams) if (!affected || affected.has(id)) this.diagrams.delete(id);
    for (const id of state.diagrams) if (!affected || affected.has(id)) this.diagrams.add(id);
  }

  list(diagramId: string) { return [...this.records.values()].filter(adr => adr.diagramId === diagramId).sort(byUpdatedAtThenId).map(summaryOf); }
  listFull(diagramId: string) { return [...this.records.values()].filter(adr => adr.diagramId === diagramId).sort(byUpdatedAtThenId).map(clone); }
  listByComponent(diagramId: string, componentId: string) {
    const component = this.components.get(componentId);
    if (component && component.diagramId !== diagramId) return undefined;
    return [...this.records.values()].filter(adr => adr.diagramId === diagramId && adr.componentIds.includes(componentId)).sort(byUpdatedAtThenId).map(componentSummaryOf);
  }
  componentAdrCounts(diagramId: string): ComponentAdrCount[] {
    const counts = new Map<string, number>();
    for (const adr of this.records.values()) {
      if (adr.diagramId !== diagramId) continue;
      for (const componentId of adr.componentIds) counts.set(componentId, (counts.get(componentId) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([componentId, count]) => ({ componentId, count }));
  }
  listByRelationship(diagramId: string, relationshipId: string) {
    const relationship = this.relationships.get(relationshipId);
    if (relationship && relationship.diagramId !== diagramId) return undefined;
    return [...this.records.values()].filter(adr => adr.diagramId === diagramId && adr.relationshipIds.includes(relationshipId)).sort(byUpdatedAtThenId).map(relationshipSummaryOf);
  }
  get(id: string) { const value = this.records.get(id); return value && clone(value); }
  create(diagramId: string, payload: AdrWritePayload) { const input = cleanPayload(payload); const now = new Date().toISOString(); const adr: ArchitectureDecisionRecord = { id: crypto.randomUUID(), diagramId, ...input, alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null, componentIds: [], relationshipIds: [], createdAt: now, updatedAt: now }; assertAdrInvariants(adr); this.records.set(adr.id, clone(adr)); return clone(adr); }
  update(id: string, payload: AdrWritePayload) { const existing = this.records.get(id); if (!existing) return undefined; const input = cleanPayload(payload); const updated: ArchitectureDecisionRecord = { ...existing, ...input, alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null, updatedAt: new Date().toISOString() }; assertAdrInvariants(updated); this.records.set(id, clone(updated)); return clone(updated); }
  replaceLinks(id: string, componentIds: string[]) { const existing = this.records.get(id); if (!existing) return undefined; const normalized = adrComponentsWriteSchema.parse({ componentIds }).componentIds; const updated = { ...existing, componentIds: normalized, updatedAt: new Date().toISOString() }; assertAdrInvariants(updated); this.syncLinkTimes(updated); this.records.set(id, clone(updated)); return clone(updated); }
  replaceRelationshipLinks(id: string, relationshipIds: string[]) { const existing = this.records.get(id); if (!existing) return undefined; const normalized = adrRelationshipsWriteSchema.parse({ relationshipIds }).relationshipIds; const updated = { ...existing, relationshipIds: normalized, updatedAt: new Date().toISOString() }; assertAdrInvariants(updated); this.syncLinkTimes(updated); this.records.set(id, clone(updated)); return clone(updated); }
  delete(id: string): AdrDeleteResult | undefined { const existing = this.records.get(id); if (!existing) return undefined; const blockers = [...this.records.values()].filter(adr => adr.replacementAdrId === id).map(adr => ({ adrId: adr.id, title: adr.title, reason: 'This ADR is the replacement for the blocking ADR.' })); if (blockers.length) return { deleted: false, blockers }; this.clearLinkTimes(existing); this.records.delete(id); return { deleted: true }; }
  componentBlockers(componentId: string) { return [...this.records.values()].filter(adr => adr.componentIds.includes(componentId)).map(adr => ({ adrId: adr.id, title: adr.title, reason: 'This ADR is linked to the component.' })); }
  relationshipBlockers(relationshipId: string) { return [...this.records.values()].filter(adr => adr.relationshipIds.includes(relationshipId)).map(adr => ({ adrId: adr.id, title: adr.title, reason: 'This ADR is linked to the relationship.' })); }
}

type PostgresDatabase = NodePgDatabase<typeof schema>;
type PostgresTransaction = Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0];
type PostgresExecutor = PostgresDatabase | PostgresTransaction;
const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();
const mapAdr = (row: typeof schema.adrs.$inferSelect, componentIds: string[], relationshipIds: string[]): ArchitectureDecisionRecord => ({ id: row.id, diagramId: row.diagramId, title: row.title, context: row.context, decision: row.decision, consequences: row.consequences, alternativesOrConstraints: row.alternativesOrConstraints, status: row.status, replacementAdrId: row.replacementAdrId, componentIds, relationshipIds, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });

export class PostgresAdrRepository implements AdrRepositoryLike {
  constructor(private readonly db: PostgresExecutor, private readonly inTransaction = false) {}
  async readArchiveRows(diagramIds?: string[]): Promise<Pick<ArchiveRecords, AdrArchiveCollection>> {
    if (!this.inTransaction) return this.db.transaction(tx => new PostgresAdrRepository(tx,true).readArchiveRows(diagramIds), { isolationLevel:'repeatable read', accessMode:'read only' });
    return { adrs: await readArchiveTable(this.db,'adrs',diagramIds), adrComponentLinks: await readArchiveTable(this.db,'adrComponentLinks',diagramIds), adrRelationshipLinks: await readArchiveTable(this.db,'adrRelationshipLinks',diagramIds) };
  }
  async upsertArchiveRows<C extends AdrArchiveCollection>(collection: C, rows: ArchiveRecords[C]) { if (!this.inTransaction) throw new Error('Raw writes require a supplied transaction'); await upsertArchiveTable(this.db,collection,rows); }
  async removeArchiveRows(collection: AdrArchiveCollection, identities: string[][]) { if (!this.inTransaction) throw new Error('Raw removal requires a supplied transaction'); await removeArchiveTable(this.db,collection,identities); }
  async deletionBlockers(scope: DeletionScope): Promise<DeletionBlocker[]> {
    const rows = await this.db.select().from(schema.adrs);
    const componentLinks = await this.db.select().from(schema.adrComponentLinks);
    const relationshipLinks = await this.db.select().from(schema.adrRelationshipLinks);
    const componentIds = new Map<string, string[]>(), relationshipIds = new Map<string, string[]>();
    for (const link of componentLinks) { const ids = componentIds.get(link.adrId) ?? []; ids.push(link.componentId); componentIds.set(link.adrId, ids); }
    for (const link of relationshipLinks) { const ids = relationshipIds.get(link.adrId) ?? []; ids.push(link.relationshipId); relationshipIds.set(link.adrId, ids); }
    return adrDeletionBlockers(scope, rows.map(a => ({ ...a, componentIds: componentIds.get(a.id) ?? [], relationshipIds: relationshipIds.get(a.id) ?? [] })));
  }
  async purgeOwned(diagramIds: string[]): Promise<void> {
    if (!this.inTransaction) throw new Error('Purge requires a graph transaction');
    if (!diagramIds.length) return;
    const rows = await this.db.select({ id: schema.adrs.id }).from(schema.adrs).where(inArray(schema.adrs.diagramId, diagramIds));
    if (rows.length) {
      const ids = rows.map(a => a.id);
      await this.db.delete(schema.adrComponentLinks).where(inArray(schema.adrComponentLinks.adrId, ids));
      await this.db.delete(schema.adrRelationshipLinks).where(inArray(schema.adrRelationshipLinks.adrId, ids));
      await this.db.delete(schema.adrs).where(inArray(schema.adrs.id, ids));
    }
  }
  withTransaction(transaction: unknown) { return new PostgresAdrRepository(transaction as PostgresTransaction, true); }
  async list(diagramId: string): Promise<AdrSummary[]> { const rows = await this.db.select().from(schema.adrs).where(eq(schema.adrs.diagramId, diagramId)).orderBy(asc(schema.adrs.updatedAt), asc(schema.adrs.id)); return Promise.all(rows.map(async row => summaryOf(await this.loadRow(row)))); }
  async listFull(diagramId: string): Promise<ArchitectureDecisionRecord[]> {
    const rows = await this.db.select().from(schema.adrs).where(eq(schema.adrs.diagramId, diagramId)).orderBy(asc(schema.adrs.updatedAt), asc(schema.adrs.id));
    if (!rows.length) return [];
    const ids = rows.map(row => row.id);
    const [componentLinks, relationshipLinks] = await Promise.all([
      this.db.select({ adrId: schema.adrComponentLinks.adrId, componentId: schema.adrComponentLinks.componentId })
        .from(schema.adrComponentLinks).where(inArray(schema.adrComponentLinks.adrId, ids))
        .orderBy(asc(schema.adrComponentLinks.createdAt), asc(schema.adrComponentLinks.componentId)),
      this.db.select({ adrId: schema.adrRelationshipLinks.adrId, relationshipId: schema.adrRelationshipLinks.relationshipId })
        .from(schema.adrRelationshipLinks).where(inArray(schema.adrRelationshipLinks.adrId, ids))
        .orderBy(asc(schema.adrRelationshipLinks.createdAt), asc(schema.adrRelationshipLinks.relationshipId)),
    ]);
    const componentsByAdr = new Map<string, string[]>();
    const relationshipsByAdr = new Map<string, string[]>();
    for (const link of componentLinks) componentsByAdr.set(link.adrId, [...(componentsByAdr.get(link.adrId) ?? []), link.componentId]);
    for (const link of relationshipLinks) relationshipsByAdr.set(link.adrId, [...(relationshipsByAdr.get(link.adrId) ?? []), link.relationshipId]);
    return rows.map(row => mapAdr(row, componentsByAdr.get(row.id) ?? [], relationshipsByAdr.get(row.id) ?? []));
  }
  async listByComponent(diagramId: string, componentId: string): Promise<ComponentAdrSummary[] | undefined> {
    const [component] = await this.db.select({ id: schema.components.id }).from(schema.components).where(and(eq(schema.components.id, componentId), eq(schema.components.diagramId, diagramId))).limit(1);
    if (!component) return undefined;
    const rows = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title, status: schema.adrs.status, updatedAt: schema.adrs.updatedAt })
      .from(schema.adrs)
      .innerJoin(schema.adrComponentLinks, eq(schema.adrs.id, schema.adrComponentLinks.adrId))
      .where(and(eq(schema.adrs.diagramId, diagramId), eq(schema.adrComponentLinks.componentId, componentId)))
      .orderBy(asc(schema.adrs.updatedAt), asc(schema.adrs.id));
    return rows.map(row => ({ id: row.id, title: row.title, status: row.status, updatedAt: iso(row.updatedAt) }));
  }
  async componentAdrCounts(diagramId: string): Promise<ComponentAdrCount[]> {
    const rows = await this.db.select({ componentId: schema.adrComponentLinks.componentId, count: count() })
      .from(schema.adrComponentLinks)
      .innerJoin(schema.adrs, eq(schema.adrs.id, schema.adrComponentLinks.adrId))
      .where(eq(schema.adrs.diagramId, diagramId))
      .groupBy(schema.adrComponentLinks.componentId)
      .orderBy(asc(schema.adrComponentLinks.componentId));
    return rows.map(row => ({ componentId: row.componentId, count: Number(row.count) }));
  }
  async listByRelationship(diagramId: string, relationshipId: string): Promise<RelationshipAdrSummary[] | undefined> {
    const [relationship] = await this.db.select({ id: schema.relationships.id }).from(schema.relationships).where(and(eq(schema.relationships.id, relationshipId), eq(schema.relationships.diagramId, diagramId))).limit(1);
    if (!relationship) return undefined;
    const rows = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title, status: schema.adrs.status, updatedAt: schema.adrs.updatedAt })
      .from(schema.adrs)
      .innerJoin(schema.adrRelationshipLinks, eq(schema.adrs.id, schema.adrRelationshipLinks.adrId))
      .where(and(eq(schema.adrs.diagramId, diagramId), eq(schema.adrRelationshipLinks.relationshipId, relationshipId)))
      .orderBy(asc(schema.adrs.updatedAt), asc(schema.adrs.id));
    return rows.map(row => ({ id: row.id, title: row.title, status: row.status, updatedAt: iso(row.updatedAt) }));
  }
  async get(id: string) { const [row] = await this.db.select().from(schema.adrs).where(eq(schema.adrs.id, id)).limit(1); return row ? this.loadRow(row) : undefined; }
  async create(diagramId: string, payload: AdrWritePayload) { const input = cleanPayload(payload); const now = new Date(); const id = crypto.randomUUID(); await this.db.insert(schema.adrs).values({ id, diagramId, title: input.title, context: input.context, decision: input.decision, consequences: input.consequences, alternativesOrConstraints: input.alternativesOrConstraints ?? null, status: input.status, replacementAdrId: input.replacementAdrId ?? null, createdAt: now, updatedAt: now }); return (await this.get(id))!; }
  async update(id: string, payload: AdrWritePayload) { const existing = await this.get(id); if (!existing) return undefined; const input = cleanPayload(payload); const now = new Date(); await this.db.update(schema.adrs).set({ title: input.title, context: input.context, decision: input.decision, consequences: input.consequences, alternativesOrConstraints: input.alternativesOrConstraints ?? null, status: input.status, replacementAdrId: input.replacementAdrId ?? null, updatedAt: now }).where(eq(schema.adrs.id, id)); return (await this.get(id))!; }
  async replaceLinks(id: string, componentIds: string[]) { const existing = await this.get(id); if (!existing) return undefined; const normalized = adrComponentsWriteSchema.parse({ componentIds }).componentIds; const now = new Date(); const write = async (tx: NodePgDatabase<typeof schema>) => { await tx.delete(schema.adrComponentLinks).where(normalized.length ? and(eq(schema.adrComponentLinks.adrId, id), notInArray(schema.adrComponentLinks.componentId, normalized)) : eq(schema.adrComponentLinks.adrId, id)); if (normalized.length) await tx.insert(schema.adrComponentLinks).values(normalized.map(componentId => ({ adrId: id, componentId, createdAt: now }))).onConflictDoNothing(); await tx.update(schema.adrs).set({ updatedAt: now }).where(eq(schema.adrs.id, id)); }; if (this.inTransaction) await write(this.db); else await this.db.transaction(write); return (await this.get(id))!; }
  async replaceRelationshipLinks(id: string, relationshipIds: string[]) { const existing = await this.get(id); if (!existing) return undefined; const normalized = adrRelationshipsWriteSchema.parse({ relationshipIds }).relationshipIds; const now = new Date(); const write = async (tx: NodePgDatabase<typeof schema>) => { await tx.delete(schema.adrRelationshipLinks).where(normalized.length ? and(eq(schema.adrRelationshipLinks.adrId, id), notInArray(schema.adrRelationshipLinks.relationshipId, normalized)) : eq(schema.adrRelationshipLinks.adrId, id)); if (normalized.length) await tx.insert(schema.adrRelationshipLinks).values(normalized.map(relationshipId => ({ adrId: id, relationshipId, createdAt: now }))).onConflictDoNothing(); await tx.update(schema.adrs).set({ updatedAt: now }).where(eq(schema.adrs.id, id)); }; if (this.inTransaction) await write(this.db); else await this.db.transaction(write); return (await this.get(id))!; }
  async delete(id: string) { const existing = await this.get(id); if (!existing) return undefined; const blockers = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title }).from(schema.adrs).where(eq(schema.adrs.replacementAdrId, id)); if (blockers.length) return { deleted: false as const, blockers: blockers.map(row => ({ adrId: row.id, title: row.title, reason: 'This ADR is the replacement for the blocking ADR.' })) }; const remove = async (tx: NodePgDatabase<typeof schema>) => { await tx.delete(schema.adrComponentLinks).where(eq(schema.adrComponentLinks.adrId, id)); await tx.delete(schema.adrRelationshipLinks).where(eq(schema.adrRelationshipLinks.adrId, id)); await tx.delete(schema.adrs).where(eq(schema.adrs.id, id)); }; if (this.inTransaction) await remove(this.db); else await this.db.transaction(remove); return { deleted: true as const }; }
  async componentBlockers(componentId: string) { const rows = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title }).from(schema.adrs).innerJoin(schema.adrComponentLinks, eq(schema.adrs.id, schema.adrComponentLinks.adrId)).where(eq(schema.adrComponentLinks.componentId, componentId)); return rows.map(row => ({ adrId: row.id, title: row.title, reason: 'This ADR is linked to the component.' })); }
  async relationshipBlockers(relationshipId: string) { const rows = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title }).from(schema.adrs).innerJoin(schema.adrRelationshipLinks, eq(schema.adrs.id, schema.adrRelationshipLinks.adrId)).where(eq(schema.adrRelationshipLinks.relationshipId, relationshipId)); return rows.map(row => ({ adrId: row.id, title: row.title, reason: 'This ADR is linked to the relationship.' })); }
  private async loadRow(row: typeof schema.adrs.$inferSelect) { const links = await this.db.select({ componentId: schema.adrComponentLinks.componentId }).from(schema.adrComponentLinks).where(eq(schema.adrComponentLinks.adrId, row.id)).orderBy(asc(schema.adrComponentLinks.createdAt)); const relationshipLinks = await this.db.select({ relationshipId: schema.adrRelationshipLinks.relationshipId }).from(schema.adrRelationshipLinks).where(eq(schema.adrRelationshipLinks.adrId, row.id)).orderBy(asc(schema.adrRelationshipLinks.createdAt)); return mapAdr(row, links.map(link => link.componentId), relationshipLinks.map(link => link.relationshipId)); }
}

export type AdrRepositoryRecord = ComponentReference | RelationshipReference;
