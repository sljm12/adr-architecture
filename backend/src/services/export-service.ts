import { MermaidExportError, exportMermaid } from '../../../shared/src/index';
import { DiagramRepository } from '../persistence/diagram-repository';

export class ExportService {
  constructor(private readonly repository: DiagramRepository) {}
  exportMermaid(diagramId: string) { const document = this.repository.get(diagramId); if (!document) throw new ExportNotFoundError(); return { source: exportMermaid(document), filename: `${fileStem(document.name)}.mmd` }; }
}
export class ExportNotFoundError extends Error { constructor() { super('Diagram not found'); this.name = 'ExportNotFoundError'; } }
export { MermaidExportError };
function fileStem(name: string): string { const normalized = name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, ''); return normalized || 'architecture-diagram'; }
