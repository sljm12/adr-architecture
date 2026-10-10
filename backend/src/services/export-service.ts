import { MermaidExportError, exportMermaid, type DiagramDocument } from '../../../shared/src/index';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { ContainerContextService, ContainerContextNotFoundError } from './container-context';
import { ComponentContextService } from './component-context';
import { GraphTransaction } from '../persistence/graph-transaction';

export class ExportService {
  constructor(private readonly repository: DiagramRepositoryLike) {}

  async exportMermaid(diagramId: string): Promise<{ source: string; filename: string }> {
    const initial = await this.repository.get(diagramId);
    if (!initial || initial.status !== 'active') throw new ExportNotFoundError();
    let document: DiagramDocument;
    try {
      document = await new GraphTransaction(this.repository).run(diagramId, [], async ({ diagrams }) => {
        const saved = await diagrams.get(diagramId);
        if (!saved || saved.status !== 'active') throw new ContainerContextNotFoundError('Diagram not found');
        return saved.kind === 'component' ? new ComponentContextService(diagrams).hydrateAndValidateDocument(saved, diagrams)
          : new ContainerContextService(diagrams).hydrateDocument(saved, diagrams);
      });
    }
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
