import type { HtmlExportInput } from '../../../shared/src/index';
import { buildHtmlPackage, containerContextSchema, validateExportDiagram } from '../../../shared/src/index';
import { adrClient } from './adr-client';
import { DiagramApiError, diagramClient } from './diagram-client';

export async function resolveContainerExportInput(input: HtmlExportInput): Promise<HtmlExportInput> {
  const captured = structuredClone(input);
  if (captured.diagram.kind !== 'container') return captured;
  const context = containerContextSchema.parse(await diagramClient.containerContext(captured.diagram.id));
  const scope = captured.diagram.scope;
  if (!scope || context.scope.parentDiagramId !== scope.parentDiagramId || context.scope.softwareSystemId !== scope.softwareSystemId) throw new Error('Export source context did not match the captured container scope. Refresh source details and retry.');
  const sources = new Map(context.sources.map(source => [source.id, source]));
  captured.diagram.scope = context.scope;
  captured.diagram.name = context.scope.softwareSystemName;
  captured.diagram.components = captured.diagram.components.map(component => {
    if (component.role !== 'external') return component;
    const source = sources.get(component.sourceComponentId!);
    if (!source) throw new Error(`External participant ${component.id} has no eligible source. Repair its parent reference and retry export.`);
    return { ...component, name: source.name, description: source.description, type: source.type };
  });
  captured.diagram = validateExportDiagram(captured.diagram);
  return captured;
}

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
    const [captured, adrs] = await Promise.all([resolveContainerExportInput(input), adrClient.listFull(input.diagram.id)]);
    const files = buildHtmlPackage({ ...captured, adrs });
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const [path, contents] of Object.entries(files)) zip.file(path, contents);
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    downloadBlob(blob, safeDiagramFilename(captured.diagram.name));
  },
};
