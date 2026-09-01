import type { DiagramDocument } from '../../../../shared/src/index';
export class DiagramApiError extends Error {
  constructor(message: string, readonly status: number, readonly details: Record<string, unknown> = {}) { super(message); this.name = 'DiagramApiError'; }
}
const json = async (response: Response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new DiagramApiError(body.message ?? 'Request failed', response.status, body); return body; };
export const diagramClient = {
  list: () => fetch('/api/diagrams').then(json), create: (name: string) => fetch('/api/diagrams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(json), get: (id: string) => fetch(`/api/diagrams/${id}`).then(json), save: (d: DiagramDocument) => fetch(`/api/diagrams/${d.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) }).then(json),
  dependencyCount: (diagramId: string, componentId: string) => fetch(`/api/diagrams/${diagramId}/components/${componentId}/dependencies`).then(json) as Promise<{ relationshipCount: number }>, removeComponent: (diagramId: string, componentId: string) => fetch(`/api/diagrams/${diagramId}/components/${componentId}`, { method: 'DELETE' }).then(json) as Promise<{ document: DiagramDocument; relationshipCount: number }>,
  trash: async (id: string) => { const response = await fetch(`/api/diagrams/${id}`, { method: 'DELETE' }); if (!response.ok) throw new Error((await response.json()).message ?? 'Could not move diagram to trash'); }, listTrash: () => fetch('/api/diagrams/trash').then(json) as Promise<DiagramDocument[]>, restore: (id: string) => fetch(`/api/diagrams/${id}/restore`, { method: 'POST' }).then(json) as Promise<DiagramDocument>
};
