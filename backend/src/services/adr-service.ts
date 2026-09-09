import { assertAdrComponentOwnership, assertAdrRelationshipOwnership, assertAdrReplacement, adrComponentsWriteSchema, adrRelationshipsWriteSchema, adrWriteSchema, type AdrComponentsWritePayload, type AdrRelationshipsWritePayload, type AdrWritePayload, type ArchitectureDecisionRecord, type AdrSummary, type Component, type ComponentAdrSummary, type Relationship, type RelationshipAdrSummary } from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import type { DiagramRepositoryLike, MaybePromise } from '../persistence/diagram-repository';
import { ApiValidationError, DependencyConflictError } from '../api/errors';

export class AdrNotFoundError extends Error {}
export class AdrDiagramNotFoundError extends Error {}
export class AdrComponentNotFoundError extends Error {}
export class AdrRelationshipNotFoundError extends Error {}
export class AdrDependencyConflictError extends DependencyConflictError {}

export class AdrService {
  constructor(private readonly adrs: AdrRepositoryLike, private readonly diagrams: DiagramRepositoryLike) {}

  async list(diagramId: string): Promise<AdrSummary[]> { await this.diagram(diagramId); return this.adrs.list(diagramId); }
  async load(id: string): Promise<ArchitectureDecisionRecord> { const adr = await this.adrs.get(id); if (!adr) throw new AdrNotFoundError('ADR not found'); return adr; }

  async create(diagramId: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const diagram = await this.diagram(diagramId); const input = adrWriteSchema.parse(payload) as AdrWritePayload;
    await this.validateReplacement(input, diagramId);
    const created = await this.adrs.create(diagram.id, input);
    return this.linkOwnership(created);
  }

  async update(id: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const existing = await this.load(id); const input = adrWriteSchema.parse(payload) as AdrWritePayload;
    await this.validateReplacement(input, existing.diagramId, id);
    const updated = await this.adrs.update(id, input); if (!updated) throw new AdrNotFoundError('ADR not found'); return this.linkOwnership(updated);
  }

  async replaceLinks(id: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const adr = await this.load(id); const input = adrComponentsWriteSchema.parse(payload) as AdrComponentsWritePayload; const diagram = await this.diagram(adr.diagramId);
    await this.validateComponentLinks(adr, input.componentIds, diagram.components);
    const updated = await this.adrs.replaceLinks(id, input.componentIds); if (!updated) throw new AdrNotFoundError('ADR not found'); return updated;
  }

  async replaceRelationshipLinks(id: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const adr = await this.load(id); const input = adrRelationshipsWriteSchema.parse(payload) as AdrRelationshipsWritePayload; const diagram = await this.diagram(adr.diagramId);
    await this.validateRelationshipLinks(adr, input.relationshipIds, diagram.relationships);
    const updated = await this.adrs.replaceRelationshipLinks(id, input.relationshipIds); if (!updated) throw new AdrNotFoundError('ADR not found'); return updated;
  }

  async remove(id: string): Promise<void> { const result = await this.adrs.delete(id); if (!result) throw new AdrNotFoundError('ADR not found'); if (!result.deleted) throw new AdrDependencyConflictError(result.blockers, 'ADR cannot be deleted while it is referenced as a replacement'); }

  private async diagram(id: string) { const diagram = await this.diagrams.get(id); if (!diagram || diagram.status !== 'active') throw new AdrDiagramNotFoundError('Diagram not found'); return diagram; }
  private async validateComponentLinks(adr: ArchitectureDecisionRecord, componentIds: string[], components: Component[]) {
    try { assertAdrComponentOwnership({ ...adr, componentIds }, components); }
    catch (error) {
      const invalidId = componentIds.find(id => !components.some(component => component.id === id));
      const external = invalidId && this.diagrams.findComponent ? await this.diagrams.findComponent(invalidId) : undefined;
      const message = external && external.diagramId !== adr.diagramId ? `Component ${invalidId} belongs to a different diagram` : error instanceof Error ? error.message : 'Component link is invalid';
      throw new ApiValidationError({ componentIds: message });
    }
  }

  async componentSummaries(diagramId: string, componentId: string): Promise<ComponentAdrSummary[]> {
    const diagram = await this.diagram(diagramId);
    if (!diagram.components.some(component => component.id === componentId)) throw new AdrComponentNotFoundError('Component not found');
    const summaries = await this.adrs.listByComponent(diagramId, componentId);
    if (!summaries) throw new AdrComponentNotFoundError('Component not found');
    return summaries;
  }

  private async validateRelationshipLinks(adr: ArchitectureDecisionRecord, relationshipIds: string[], relationships: Relationship[]) {
    try { assertAdrRelationshipOwnership({ ...adr, relationshipIds }, relationships); }
    catch (error) {
      const invalidId = relationshipIds.find(id => !relationships.some(relationship => relationship.id === id));
      const external = invalidId && this.diagrams.findRelationship ? await this.diagrams.findRelationship(invalidId) : undefined;
      const message = external && external.diagramId !== adr.diagramId ? `Relationship ${invalidId} belongs to a different diagram` : error instanceof Error ? error.message : 'Relationship link is invalid';
      throw new ApiValidationError({ relationshipIds: message });
    }
  }
  async relationshipSummaries(diagramId: string, relationshipId: string): Promise<RelationshipAdrSummary[]> {
    const diagram = await this.diagram(diagramId);
    if (!diagram.relationships.some(relationship => relationship.id === relationshipId)) throw new AdrRelationshipNotFoundError('Relationship not found');
    const summaries = await this.adrs.listByRelationship(diagramId, relationshipId);
    if (!summaries) throw new AdrRelationshipNotFoundError('Relationship not found');
    return summaries;
  }
  private async validateReplacement(input: AdrWritePayload, diagramId: string, currentId?: string) {
    if (!input.replacementAdrId) return;
    try {
      if (input.replacementAdrId === currentId) throw new Error('An ADR cannot replace itself');
      const replacement = await this.adrs.get(input.replacementAdrId);
      assertAdrReplacement({ id: currentId ?? crypto.randomUUID(), diagramId, ...input, componentIds: [], relationshipIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null }, replacement);
    } catch (error) {
      throw new ApiValidationError({ replacementAdrId: error instanceof Error ? error.message : 'Replacement ADR is invalid' });
    }
  }
  private async linkOwnership(adr: ArchitectureDecisionRecord) { const diagram = await this.diagram(adr.diagramId); assertAdrComponentOwnership(adr, diagram.components); assertAdrRelationshipOwnership(adr, diagram.relationships); return adr; }
}
