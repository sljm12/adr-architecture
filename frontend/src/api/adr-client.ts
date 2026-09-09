import type { AdrComponentsWritePayload, AdrRelationshipsWritePayload, AdrSummary, ArchitectureDecisionRecord, AdrWritePayload, ComponentAdrSummary, RelationshipAdrSummary } from '../../../shared/src/index';
import { componentAdrSummaryListSchema, relationshipAdrSummaryListSchema } from '../../../shared/src/index';
import { DiagramApiError } from './diagram-client';

export class AdrApiError extends DiagramApiError { constructor(message: string, status: number, details: Record<string, unknown> = {}) { super(message, status, details); this.name = 'AdrApiError'; } }
const json = async (response: Response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new AdrApiError(body.message ?? 'ADR request failed', response.status, body); return body; };

export const adrClient = {
  list: (diagramId: string) => fetch(`/api/diagrams/${diagramId}/adrs`).then(json) as Promise<AdrSummary[]>,
  get: (id: string) => fetch(`/api/adrs/${id}`).then(json) as Promise<ArchitectureDecisionRecord>,
  create: (diagramId: string, payload: AdrWritePayload) => fetch(`/api/diagrams/${diagramId}/adrs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(json) as Promise<ArchitectureDecisionRecord>,
  update: (id: string, payload: AdrWritePayload) => fetch(`/api/adrs/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(json) as Promise<ArchitectureDecisionRecord>,
  replaceLinks: (id: string, payload: AdrComponentsWritePayload) => fetch(`/api/adrs/${id}/components`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(json) as Promise<ArchitectureDecisionRecord>,
  replaceRelationshipLinks: (id: string, payload: AdrRelationshipsWritePayload) => fetch(`/api/adrs/${id}/relationships`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(json) as Promise<ArchitectureDecisionRecord>,
  componentSummaries: async (diagramId: string, componentId: string): Promise<ComponentAdrSummary[]> => componentAdrSummaryListSchema.parse(await fetch(`/api/diagrams/${diagramId}/components/${componentId}/adrs`).then(json)),
  relationshipSummaries: async (diagramId: string, relationshipId: string): Promise<RelationshipAdrSummary[]> => relationshipAdrSummaryListSchema.parse(await fetch(`/api/diagrams/${diagramId}/relationships/${relationshipId}/adrs`).then(json)),
  remove: async (id: string) => { const response = await fetch(`/api/adrs/${id}`, { method: 'DELETE' }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new AdrApiError(body.message ?? 'Could not delete ADR', response.status, body); } },
};
