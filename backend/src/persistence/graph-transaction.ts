import type { AdrRepositoryLike } from './adr-repository';
import type { DiagramRepositoryLike, MaybePromise } from './diagram-repository';

export interface GraphTransactionContext {
  diagrams: DiagramRepositoryLike;
  adrs?: AdrRepositoryLike;
}

/** Coordinates parent-first graph locks and gives both repositories the same transaction scope. */
export class GraphTransaction {
  constructor(private readonly diagrams: DiagramRepositoryLike, private readonly adrs?: AdrRepositoryLike) {}

  async run<T>(parentDiagramId: string, affectedChildDiagramIds: string[], action: (context: GraphTransactionContext) => MaybePromise<T>): Promise<T> {
    return await this.diagrams.withGraphTransaction(parentDiagramId, affectedChildDiagramIds, async (diagrams, transaction) => {
        const adrSnapshot = this.adrs?.snapshotGraph?.();
        const adrs = transaction === diagrams
          ? this.adrs
          : transaction !== undefined ? this.adrs?.withTransaction?.(transaction) : this.adrs;
        try { return await action({ diagrams, adrs }); }
        catch (error) { if (adrSnapshot !== undefined) this.adrs?.restoreGraphSnapshot?.(adrSnapshot); throw error; }
    });
  }
}
