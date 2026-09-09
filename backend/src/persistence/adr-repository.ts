import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AdrDependencyBlocker, AdrSummary, ArchitectureDecisionRecord, AdrWritePayload, ComponentAdrSummary, ComponentReference, RelationshipAdrSummary, RelationshipReference } from '../../../shared/src/index';
import { architectureDecisionRecordSchema, adrComponentsWriteSchema, adrRelationshipsWriteSchema, adrWriteSchema, assertAdrInvariants } from '../../../shared/src/index';
import * as schema from './schema';
import type { MaybePromise } from './diagram-repository';

export type AdrDeleteResult = { deleted: true } | { deleted: false; blockers: AdrDependencyBlocker[] };

export interface AdrRepositoryLike {
  list(diagramId: string): MaybePromise<AdrSummary[]>;
  get(id: string): MaybePromise<ArchitectureDecisionRecord | undefined>;
  create(diagramId: string, payload: AdrWritePayload): MaybePromise<ArchitectureDecisionRecord>;
  update(id: string, payload: AdrWritePayload): MaybePromise<ArchitectureDecisionRecord | undefined>;
  replaceLinks(id: string, componentIds: string[]): MaybePromise<ArchitectureDecisionRecord | undefined>;
  replaceRelationshipLinks(id: string, relationshipIds: string[]): MaybePromise<ArchitectureDecisionRecord | undefined>;
  listByComponent(diagramId: string, componentId: string): MaybePromise<ComponentAdrSummary[] | undefined>;
  listByRelationship(diagramId: string, relationshipId: string): MaybePromise<RelationshipAdrSummary[] | undefined>;
  delete(id: string): MaybePromise<AdrDeleteResult | undefined>;
  componentBlockers(componentId: string): MaybePromise<AdrDependencyBlocker[]>;
  relationshipBlockers(relationshipId: string): MaybePromise<AdrDependencyBlocker[]>;
}

const clone = <T>(value: T): T => structuredClone(value);
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

  registerDiagram(id: string): void { this.diagrams.add(id); }
  registerComponent(component: { id: string; diagramId: string; name: string }): void { this.diagrams.add(component.diagramId); this.components.set(component.id, { id: component.id, diagramId: component.diagramId, name: component.name }); }
  registerRelationship(relationship: { id: string; diagramId: string }): void { this.diagrams.add(relationship.diagramId); this.relationships.set(relationship.id, { id: relationship.id, diagramId: relationship.diagramId }); }
  registerAdr(adr: ArchitectureDecisionRecord): void { assertAdrInvariants(adr); this.records.set(adr.id, clone(adr)); this.diagrams.add(adr.diagramId); }

  list(diagramId: string) { return [...this.records.values()].filter(adr => adr.diagramId === diagramId).sort(byUpdatedAtThenId).map(summaryOf); }
  listByComponent(diagramId: string, componentId: string) {
    const component = this.components.get(componentId);
    if (component && component.diagramId !== diagramId) return undefined;
    return [...this.records.values()].filter(adr => adr.diagramId === diagramId && adr.componentIds.includes(componentId)).sort(byUpdatedAtThenId).map(componentSummaryOf);
  }
  listByRelationship(diagramId: string, relationshipId: string) {
    const relationship = this.relationships.get(relationshipId);
    if (relationship && relationship.diagramId !== diagramId) return undefined;
    return [...this.records.values()].filter(adr => adr.diagramId === diagramId && adr.relationshipIds.includes(relationshipId)).sort(byUpdatedAtThenId).map(relationshipSummaryOf);
  }
  get(id: string) { const value = this.records.get(id); return value && clone(value); }
  create(diagramId: string, payload: AdrWritePayload) { const input = cleanPayload(payload); const now = new Date().toISOString(); const adr: ArchitectureDecisionRecord = { id: crypto.randomUUID(), diagramId, ...input, alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null, componentIds: [], relationshipIds: [], createdAt: now, updatedAt: now }; assertAdrInvariants(adr); this.records.set(adr.id, clone(adr)); return clone(adr); }
  update(id: string, payload: AdrWritePayload) { const existing = this.records.get(id); if (!existing) return undefined; const input = cleanPayload(payload); const updated: ArchitectureDecisionRecord = { ...existing, ...input, alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null, updatedAt: new Date().toISOString() }; assertAdrInvariants(updated); this.records.set(id, clone(updated)); return clone(updated); }
  replaceLinks(id: string, componentIds: string[]) { const existing = this.records.get(id); if (!existing) return undefined; const normalized = adrComponentsWriteSchema.parse({ componentIds }).componentIds; const updated = { ...existing, componentIds: normalized, updatedAt: new Date().toISOString() }; assertAdrInvariants(updated); this.records.set(id, clone(updated)); return clone(updated); }
  replaceRelationshipLinks(id: string, relationshipIds: string[]) { const existing = this.records.get(id); if (!existing) return undefined; const normalized = adrRelationshipsWriteSchema.parse({ relationshipIds }).relationshipIds; const updated = { ...existing, relationshipIds: normalized, updatedAt: new Date().toISOString() }; assertAdrInvariants(updated); this.records.set(id, clone(updated)); return clone(updated); }
  delete(id: string): AdrDeleteResult | undefined { const existing = this.records.get(id); if (!existing) return undefined; const blockers = [...this.records.values()].filter(adr => adr.replacementAdrId === id).map(adr => ({ adrId: adr.id, title: adr.title, reason: 'This ADR is the replacement for the blocking ADR.' })); if (blockers.length) return { deleted: false, blockers }; this.records.delete(id); return { deleted: true }; }
  componentBlockers(componentId: string) { return [...this.records.values()].filter(adr => adr.componentIds.includes(componentId)).map(adr => ({ adrId: adr.id, title: adr.title, reason: 'This ADR is linked to the component.' })); }
  relationshipBlockers(relationshipId: string) { return [...this.records.values()].filter(adr => adr.relationshipIds.includes(relationshipId)).map(adr => ({ adrId: adr.id, title: adr.title, reason: 'This ADR is linked to the relationship.' })); }
}

type PostgresDatabase = NodePgDatabase<typeof schema>;
const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();
const mapAdr = (row: typeof schema.adrs.$inferSelect, componentIds: string[], relationshipIds: string[]): ArchitectureDecisionRecord => ({ id: row.id, diagramId: row.diagramId, title: row.title, context: row.context, decision: row.decision, consequences: row.consequences, alternativesOrConstraints: row.alternativesOrConstraints, status: row.status, replacementAdrId: row.replacementAdrId, componentIds, relationshipIds, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });

export class PostgresAdrRepository implements AdrRepositoryLike {
  constructor(private readonly db: PostgresDatabase) {}
  async list(diagramId: string): Promise<AdrSummary[]> { const rows = await this.db.select().from(schema.adrs).where(eq(schema.adrs.diagramId, diagramId)).orderBy(asc(schema.adrs.updatedAt), asc(schema.adrs.id)); return Promise.all(rows.map(async row => summaryOf(await this.loadRow(row)))); }
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
  async replaceLinks(id: string, componentIds: string[]) { const existing = await this.get(id); if (!existing) return undefined; const normalized = adrComponentsWriteSchema.parse({ componentIds }).componentIds; const now = new Date(); await this.db.transaction(async tx => { await tx.delete(schema.adrComponentLinks).where(eq(schema.adrComponentLinks.adrId, id)); if (normalized.length) await tx.insert(schema.adrComponentLinks).values(normalized.map(componentId => ({ adrId: id, componentId, createdAt: now }))); await tx.update(schema.adrs).set({ updatedAt: now }).where(eq(schema.adrs.id, id)); }); return (await this.get(id))!; }
  async replaceRelationshipLinks(id: string, relationshipIds: string[]) { const existing = await this.get(id); if (!existing) return undefined; const normalized = adrRelationshipsWriteSchema.parse({ relationshipIds }).relationshipIds; const now = new Date(); await this.db.transaction(async tx => { await tx.delete(schema.adrRelationshipLinks).where(eq(schema.adrRelationshipLinks.adrId, id)); if (normalized.length) await tx.insert(schema.adrRelationshipLinks).values(normalized.map(relationshipId => ({ adrId: id, relationshipId, createdAt: now }))); await tx.update(schema.adrs).set({ updatedAt: now }).where(eq(schema.adrs.id, id)); }); return (await this.get(id))!; }
  async delete(id: string) { const existing = await this.get(id); if (!existing) return undefined; const blockers = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title }).from(schema.adrs).where(eq(schema.adrs.replacementAdrId, id)); if (blockers.length) return { deleted: false as const, blockers: blockers.map(row => ({ adrId: row.id, title: row.title, reason: 'This ADR is the replacement for the blocking ADR.' })) }; await this.db.transaction(async tx => { await tx.delete(schema.adrComponentLinks).where(eq(schema.adrComponentLinks.adrId, id)); await tx.delete(schema.adrRelationshipLinks).where(eq(schema.adrRelationshipLinks.adrId, id)); await tx.delete(schema.adrs).where(eq(schema.adrs.id, id)); }); return { deleted: true as const }; }
  async componentBlockers(componentId: string) { const rows = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title }).from(schema.adrs).innerJoin(schema.adrComponentLinks, eq(schema.adrs.id, schema.adrComponentLinks.adrId)).where(eq(schema.adrComponentLinks.componentId, componentId)); return rows.map(row => ({ adrId: row.id, title: row.title, reason: 'This ADR is linked to the component.' })); }
  async relationshipBlockers(relationshipId: string) { const rows = await this.db.select({ id: schema.adrs.id, title: schema.adrs.title }).from(schema.adrs).innerJoin(schema.adrRelationshipLinks, eq(schema.adrs.id, schema.adrRelationshipLinks.adrId)).where(eq(schema.adrRelationshipLinks.relationshipId, relationshipId)); return rows.map(row => ({ adrId: row.id, title: row.title, reason: 'This ADR is linked to the relationship.' })); }
  private async loadRow(row: typeof schema.adrs.$inferSelect) { const links = await this.db.select({ componentId: schema.adrComponentLinks.componentId }).from(schema.adrComponentLinks).where(eq(schema.adrComponentLinks.adrId, row.id)).orderBy(asc(schema.adrComponentLinks.createdAt)); const relationshipLinks = await this.db.select({ relationshipId: schema.adrRelationshipLinks.relationshipId }).from(schema.adrRelationshipLinks).where(eq(schema.adrRelationshipLinks.adrId, row.id)).orderBy(asc(schema.adrRelationshipLinks.createdAt)); return mapAdr(row, links.map(link => link.componentId), relationshipLinks.map(link => link.relationshipId)); }
}

export type AdrRepositoryRecord = ComponentReference | RelationshipReference;
