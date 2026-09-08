import { assertAdrComponentOwnership, assertAdrReplacement, adrComponentsWriteSchema, adrWriteSchema, type AdrComponentsWritePayload, type AdrWritePayload, type ArchitectureDecisionRecord, type AdrSummary, type Component } from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import type { DiagramRepositoryLike, MaybePromise } from '../persistence/diagram-repository';
import { ApiValidationError, DependencyConflictError } from '../api/errors';

export class AdrNotFoundError extends Error {}
export class AdrDiagramNotFoundError extends Error {}
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
  private async validateReplacement(input: AdrWritePayload, diagramId: string, currentId?: string) { if (!input.replacementAdrId) return; if (input.replacementAdrId === currentId) throw new Error('An ADR cannot replace itself'); const replacement = await this.adrs.get(input.replacementAdrId); assertAdrReplacement({ id: currentId ?? crypto.randomUUID(), diagramId, ...input, componentIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), alternativesOrConstraints: input.alternativesOrConstraints ?? null, replacementAdrId: input.replacementAdrId ?? null }, replacement); }
  private async linkOwnership(adr: ArchitectureDecisionRecord) { const diagram = await this.diagram(adr.diagramId); assertAdrComponentOwnership(adr, diagram.components); return adr; }
}
