import type { AdrRepositoryLike } from './adr-repository';
import type { DiagramRepositoryLike, MaybePromise } from './diagram-repository';
import { graphRoot } from './diagram-repository';

export interface GraphTransactionContext {
  diagrams: DiagramRepositoryLike;
  adrs?: AdrRepositoryLike;
  rootDiagramId: string;
}

/** Coordinates parent-first graph locks and gives both repositories the same transaction scope. */
export class GraphTransaction {
  constructor(private readonly diagrams: DiagramRepositoryLike, private readonly adrs?: AdrRepositoryLike) {}

  async run<T>(parentDiagramId: string, affectedChildDiagramIds: string[], action: (context: GraphTransactionContext) => MaybePromise<T>): Promise<T> {
    return await this.diagrams.withGraphTransaction(parentDiagramId, affectedChildDiagramIds, async (diagrams, transaction) => {
        const rootDiagramId = (await graphRoot(diagrams, parentDiagramId)).id;
        const ids = [rootDiagramId, ...(await diagrams.findDescendants(rootDiagramId)).map(member => member.id)];
        const adrSnapshot = this.adrs?.snapshotGraph?.(ids);
        const adrs = transaction === diagrams
          ? this.adrs
          : transaction !== undefined ? this.adrs?.withTransaction?.(transaction) : this.adrs;
        try { return await action({ diagrams, adrs, rootDiagramId }); }
        catch (error) {
          if (adrSnapshot !== undefined) this.adrs?.restoreGraphSnapshot?.(adrSnapshot, [...ids, ...(diagrams.transactionDiagramIds?.(rootDiagramId) ?? [])]);
          throw error;
        }
    });
  }
}
