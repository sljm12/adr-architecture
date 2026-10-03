import { containerAvailabilitySchema, containerContextSchema, diagramDocumentSchema, diagramSummaryListSchema, trashImpactSchema, restoreImpactSchema, type RestoreConfirmation, type RestoreImpact, type TrashImpact, type ContainerAvailability, type ContainerContext, type DiagramDocument, type DiagramSummary } from '../../../shared/src/index';
export class DiagramApiError extends Error { constructor(message: string, readonly status: number, readonly details: Record<string, unknown> = {}) { super(message); this.name = 'DiagramApiError'; } }
export function formatDiagramApiError(error: unknown): string {
  if (!(error instanceof DiagramApiError)) return error instanceof Error ? error.message : 'Request failed';
  const blockers = Array.isArray(error.details.diagramBlockers) ? error.details.diagramBlockers : [];
  const details = blockers.map((b: any) => `${b.name} (${b.status}; child ${b.diagramId}${b.componentId ? `; occurrence/component ${b.componentId}` : ''}${b.sourceComponentId ? `; source ${b.sourceComponentId}` : ''}): ${b.nextAction}`).join(' ');
  const adrBlockers = Array.isArray(error.details.blockers) ? error.details.blockers.map((b: any) => `${b.title} (${b.adrId}): ${b.reason}`).join(' ') : '';
  return [error.message, details, adrBlockers].filter(Boolean).join(' ');
}
export type ComponentRemovalResult = { document: DiagramDocument; relationshipCount: number };
export type ComponentRemovalConflict = { message: string; componentId: string; relationshipCount: number; groupIds: string[]; blockers?: unknown[] };
const json = async (response: Response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new DiagramApiError(body.message ?? 'Request failed', response.status, body); return body; };
const summaries = async (response: Response): Promise<DiagramSummary[]> => diagramSummaryListSchema.parse(await json(response));
export const diagramClient = {
  list: () => fetch('/api/diagrams').then(summaries), create: async (name: string) => diagramDocumentSchema.parse(await json(await fetch('/api/diagrams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }))) as DiagramDocument, get: async (id: string) => diagramDocumentSchema.parse(await json(await fetch(`/api/diagrams/${id}`))) as DiagramDocument, save: async (d: DiagramDocument) => diagramDocumentSchema.parse(await json(await fetch(`/api/diagrams/${d.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) }))) as DiagramDocument,
  containerAvailability: async (diagramId: string, componentId: string): Promise<ContainerAvailability> => containerAvailabilitySchema.parse(await json(await fetch(`/api/diagrams/${diagramId}/components/${componentId}/container-diagram`))),
  containerContext: async (diagramId: string): Promise<ContainerContext> => containerContextSchema.parse(await json(await fetch(`/api/diagrams/${diagramId}/container-context`))),
  createOrOpenContainerDiagram: async (diagramId: string, componentId: string): Promise<DiagramDocument> => diagramDocumentSchema.parse(await json(await fetch(`/api/diagrams/${diagramId}/components/${componentId}/container-diagram`, { method: 'POST' }))) as DiagramDocument,
  dependencyCount: (diagramId: string, componentId: string) => fetch(`/api/diagrams/${diagramId}/components/${componentId}/dependencies`).then(json) as Promise<{ relationshipCount: number; groupIds?: string[]; blockers?: unknown[]; diagramBlockers?: unknown[] }>,
  removeComponent: async (diagramId: string, componentId: string): Promise<ComponentRemovalResult> => { const body = await json(await fetch(`/api/diagrams/${diagramId}/components/${componentId}`, { method: 'DELETE' })); return { ...body, document: diagramDocumentSchema.parse(body.document) as DiagramDocument }; },
  removeRelationship: async (diagramId: string, relationshipId: string): Promise<{ document: DiagramDocument }> => { const body = await json(await fetch(`/api/diagrams/${diagramId}/relationships/${relationshipId}`, { method: 'DELETE' })); return { document: diagramDocumentSchema.parse(body.document) as DiagramDocument }; },
  trashImpact: async (id: string): Promise<TrashImpact> => trashImpactSchema.parse(await json(await fetch(`/api/diagrams/${id}/trash-impact`))),
  restoreImpact: async (id: string): Promise<RestoreImpact> => restoreImpactSchema.parse(await json(await fetch(`/api/diagrams/${id}/restore-impact`))),
  trash: async (id: string, confirmedDiagramIds?: string[]): Promise<void> => {
    const response = await fetch(`/api/diagrams/${id}`, { method: 'DELETE', ...(confirmedDiagramIds ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmedDiagramIds }) } : {}) });
    if (!response.ok) await json(response);
  },
  listTrash: () => fetch('/api/diagrams/trash').then(summaries),
  restore: async (id: string, confirmation?: RestoreConfirmation): Promise<DiagramDocument> => diagramDocumentSchema.parse(await json(await fetch(`/api/diagrams/${id}/restore`, { method: 'POST', ...(confirmation ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(confirmation) } : {}) }))) as DiagramDocument,
};
