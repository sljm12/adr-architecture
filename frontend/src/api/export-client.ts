import { DiagramApiError } from './diagram-client';

export const exportClient = {
  async downloadMermaid(diagramId: string): Promise<void> {
    const response = await fetch(`/api/diagrams/${diagramId}/export/mermaid`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new DiagramApiError(body.message ?? 'Mermaid export failed', response.status, body);
    }
    const blob = await response.blob();
    const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ?? 'architecture-diagram.mmd';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
