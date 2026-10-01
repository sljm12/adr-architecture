import {
  adrListPathSchema,
  assertAdrComponentOwnership,
  assertAdrRelationshipOwnership,
  assertAdrReplacement,
  adrComponentsWriteSchema,
  adrRelationshipsWriteSchema,
  adrWriteSchema,
  type AdrComponentsWritePayload,
  type AdrRelationshipsWritePayload,
  type AdrWritePayload,
  type ArchitectureDecisionRecord,
  type AdrSummary,
  type Component,
  type ComponentAdrSummary,
  type Relationship,
  type RelationshipAdrSummary,
} from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import { GraphTransaction } from '../persistence/graph-transaction';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { ApiConflictError, ApiValidationError, DependencyConflictError } from '../api/errors';

export class AdrNotFoundError extends Error {}
export class AdrDiagramNotFoundError extends Error {}
export class AdrComponentNotFoundError extends Error {}
export class AdrRelationshipNotFoundError extends Error {}
export class AdrDependencyConflictError extends DependencyConflictError {}

export class AdrService {
  private readonly graph: GraphTransaction;

  constructor(private readonly adrs: AdrRepositoryLike, private readonly diagrams: DiagramRepositoryLike) {
    this.graph = new GraphTransaction(diagrams, adrs);
  }

  async list(diagramId: string): Promise<AdrSummary[]> { await this.diagram(diagramId); return this.adrs.list(diagramId); }
  async listFull(diagramId: string): Promise<ArchitectureDecisionRecord[]> { const { diagramId: validId } = adrListPathSchema.parse({ diagramId }); await this.diagram(validId); return this.adrs.listFull(validId); }
  async componentAdrCounts(diagramId: string) { await this.diagram(diagramId); return this.adrs.componentAdrCounts(diagramId); }
  async load(id: string): Promise<ArchitectureDecisionRecord> { const adr = await this.adrs.get(id); if (!adr) throw new AdrNotFoundError('ADR not found'); return adr; }

  async create(diagramId: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const input = adrWriteSchema.parse(payload) as AdrWritePayload;
    return this.graphWrite(diagramId, async (adrs, diagrams, diagram) => {
      await this.validateReplacement(input, diagramId, undefined, adrs);
      const created = await adrs.create(diagram.id, input);
      return this.linkOwnership(created, diagrams);
    });
  }

  async update(id: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const input = adrWriteSchema.parse(payload) as AdrWritePayload;
    const current = await this.load(id);
    return this.graphWrite(current.diagramId, async (adrs, diagrams) => {
      const existing = await adrs.get(id);
      if (!existing || existing.diagramId !== current.diagramId) throw new AdrNotFoundError('ADR not found');
      await this.validateReplacement(input, existing.diagramId, id, adrs);
      const updated = await adrs.update(id, input);
      if (!updated) throw new AdrNotFoundError('ADR not found');
      return this.linkOwnership(updated, diagrams);
    });
  }

  async replaceLinks(id: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const input = adrComponentsWriteSchema.parse(payload) as AdrComponentsWritePayload;
    const current = await this.load(id);
    return this.graphWrite(current.diagramId, async (adrs, diagrams, diagram) => {
      const adr = await adrs.get(id);
      if (!adr || adr.diagramId !== diagram.id) throw new AdrNotFoundError('ADR not found');
      await this.validateComponentLinks(adr, input.componentIds, diagram.components, diagrams);
      const updated = await adrs.replaceLinks(id, input.componentIds);
      if (!updated) throw new AdrNotFoundError('ADR not found');
      return updated;
    });
  }

  async replaceRelationshipLinks(id: string, payload: unknown): Promise<ArchitectureDecisionRecord> {
    const input = adrRelationshipsWriteSchema.parse(payload) as AdrRelationshipsWritePayload;
    const current = await this.load(id);
    return this.graphWrite(current.diagramId, async (adrs, diagrams, diagram) => {
      const adr = await adrs.get(id);
      if (!adr || adr.diagramId !== diagram.id) throw new AdrNotFoundError('ADR not found');
      await this.validateRelationshipLinks(adr, input.relationshipIds, diagram.relationships, diagrams);
      const updated = await adrs.replaceRelationshipLinks(id, input.relationshipIds);
      if (!updated) throw new AdrNotFoundError('ADR not found');
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    await this.graphWrite(current.diagramId, async adrs => {
      const existing = await adrs.get(id);
      if (!existing || existing.diagramId !== current.diagramId) throw new AdrNotFoundError('ADR not found');
      const result = await adrs.delete(id);
      if (!result) throw new AdrNotFoundError('ADR not found');
      if (!result.deleted) throw new AdrDependencyConflictError(result.blockers, 'ADR cannot be deleted while it is referenced as a replacement');
    });
  }

  private async graphWrite<T>(diagramId: string, action: (adrs: AdrRepositoryLike, diagrams: DiagramRepositoryLike, diagram: Awaited<ReturnType<DiagramRepositoryLike['get']>> & {}) => Promise<T>): Promise<T> {
    const initial = await this.diagram(diagramId);
    const isChild = initial.kind === 'container';
    const parentDiagramId = isChild ? initial.scope?.parentDiagramId : initial.id;
    if (!parentDiagramId) throw new ApiConflictError('Container diagram has no valid parent reference', 'DIAGRAM_REFERENCE_BROKEN');
    return this.graph.run(parentDiagramId, isChild ? [initial.id] : [], async context => {
      const adrs = context.adrs ?? this.adrs;
      const parent = await context.diagrams.get(parentDiagramId);
      if (!parent || parent.kind !== 'general') throw new AdrDiagramNotFoundError('Diagram not found');
      if (parent.status !== 'active') throw new ApiConflictError('The parent diagram is inactive. Restore it before changing decisions.', 'PARENT_INACTIVE');
      const diagram = await context.diagrams.get(diagramId);
      if (!diagram || diagram.status !== 'active') throw new AdrDiagramNotFoundError('Diagram not found');
      if (isChild && (diagram.kind !== 'container' || diagram.scope?.parentDiagramId !== parent.id)) {
        throw new ApiConflictError('Container ownership no longer matches its active parent', 'DIAGRAM_REFERENCE_BROKEN');
      }
      return action(adrs, context.diagrams, diagram);
    });
  }

  private async diagram(id: string) {
    const diagram = await this.diagrams.get(id);
    if (!diagram || diagram.status !== 'active') throw new AdrDiagramNotFoundError('Diagram not found');
    if (diagram.kind === 'container') {
      const parent = diagram.scope?.parentDiagramId ? await this.diagrams.get(diagram.scope.parentDiagramId) : undefined;
      if (!parent || parent.kind !== 'general') throw new ApiConflictError('Container source graph is broken', 'DIAGRAM_REFERENCE_BROKEN');
      if (parent.status !== 'active') throw new ApiConflictError('The parent diagram is inactive. Restore it before accessing decisions.', 'PARENT_INACTIVE');
    }
    return diagram;
  }

  private async validateComponentLinks(adr: ArchitectureDecisionRecord, componentIds: string[], components: Component[], diagrams: DiagramRepositoryLike) {
    try { assertAdrComponentOwnership({ ...adr, componentIds }, components); }
    catch (error) {
      const invalidId = componentIds.find(id => !components.some(component => component.id === id));
      const external = invalidId && diagrams.findComponent ? await diagrams.findComponent(invalidId) : undefined;
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

  private async validateRelationshipLinks(adr: ArchitectureDecisionRecord, relationshipIds: string[], relationships: Relationship[], diagrams: DiagramRepositoryLike) {
    try { assertAdrRelationshipOwnership({ ...adr, relationshipIds }, relationships); }
    catch (error) {
      const invalidId = relationshipIds.find(id => !relationships.some(relationship => relationship.id === id));
      const external = invalidId && diagrams.findRelationship ? await diagrams.findRelationship(invalidId) : undefined;
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

  private async validateReplacement(input: AdrWritePayload, diagramId: string, currentId: string | undefined, adrs: AdrRepositoryLike) {
    if (!input.replacementAdrId) return;
    try {
      if (input.replacementAdrId === currentId) throw new Error('An ADR cannot replace itself');
      const replacement = await adrs.get(input.replacementAdrId);
      assertAdrReplacement({ id: currentId ?? crypto.randomUUID(), diagramId, ...input, componentIds: [], relationshipIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null }, replacement);
    } catch (error) {
      throw new ApiValidationError({ replacementAdrId: error instanceof Error ? error.message : 'Replacement ADR is invalid' });
    }
  }

  private async linkOwnership(adr: ArchitectureDecisionRecord, diagrams: DiagramRepositoryLike) {
    const diagram = await diagrams.get(adr.diagramId);
    if (!diagram || diagram.status !== 'active') throw new AdrDiagramNotFoundError('Diagram not found');
    assertAdrComponentOwnership(adr, diagram.components);
    assertAdrRelationshipOwnership(adr, diagram.relationships);
    return adr;
  }
}
