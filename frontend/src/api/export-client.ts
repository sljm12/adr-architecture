import type { HtmlExportInput } from '../../../shared/src/index';
import { buildHtmlPackage } from '../../../shared/src/index';
import { adrClient } from './adr-client';
import { DiagramApiError } from './diagram-client';

function safeDiagramFilename(name: string): string {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
  return `${slug || 'architecture-diagram'}.zip`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

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
  async downloadHtmlPackage(input: HtmlExportInput): Promise<void> {
    const adrs = await adrClient.listFull(input.diagram.id);
    const files = buildHtmlPackage({ ...input, adrs });
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const [path, contents] of Object.entries(files)) zip.file(path, contents);
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    downloadBlob(blob, safeDiagramFilename(input.diagram.name));
  },
};
