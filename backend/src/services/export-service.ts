import { MermaidExportError, exportMermaid, type DiagramDocument } from '../../../shared/src/index';
import type { DiagramRepositoryLike, MaybePromise } from '../persistence/diagram-repository';
import { ContainerContextService, ContainerContextNotFoundError } from './container-context';

export class ExportService {
  constructor(private readonly repository: DiagramRepositoryLike) {}

  async exportMermaid(diagramId: string): Promise<{ source: string; filename: string }> {
    let document: DiagramDocument;
    try { document = await new ContainerContextService(this.repository).resolveDocument(diagramId); }
    catch (error) { if (error instanceof ContainerContextNotFoundError) throw new ExportNotFoundError(); throw error; }
    return { source: exportMermaid(document), filename: `${fileStem(document.name)}.mmd` };
  }
}

export class ExportNotFoundError extends Error {
  constructor() { super('Diagram not found'); this.name = 'ExportNotFoundError'; }
}
export { MermaidExportError };

function fileStem(name: string): string {
  const normalized = name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return normalized || 'architecture-diagram';
}
