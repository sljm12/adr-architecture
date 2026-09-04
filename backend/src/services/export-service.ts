import { MermaidExportError, exportMermaid, type DiagramDocument } from '../../../shared/src/index';
import type { DiagramRepositoryLike, MaybePromise } from '../persistence/diagram-repository';

export class ExportService {
  constructor(private readonly repository: DiagramRepositoryLike) {}

  exportMermaid(diagramId: string): MaybePromise<{ source: string; filename: string }> {
    const result = this.repository.get(diagramId);
    const resolve = (document: DiagramDocument | undefined) => {
      if (!document) throw new ExportNotFoundError();
      return { source: exportMermaid(document), filename: `${fileStem(document.name)}.mmd` };
    };
    return result instanceof Promise ? result.then(resolve) : resolve(result);
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
