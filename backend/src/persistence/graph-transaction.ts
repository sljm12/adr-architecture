import type { AdrRepositoryLike } from './adr-repository';
import type { DiagramRepositoryLike, MaybePromise } from './diagram-repository';
import { graphRoot } from './diagram-repository';
import { archiveCollections, archiveRecordsSchema, validateArchiveGraph, type ArchiveRecords, type ArchiveCollection, type ArchiveRow } from '../../../shared/src/index';
import { archiveRowIdentity, normalizeArchiveRows } from './archive-repository';

export interface GraphTransactionContext {
  diagrams: DiagramRepositoryLike;
  adrs?: AdrRepositoryLike;
  rootDiagramId: string;
}
export type CollectionTransactionContext = Omit<GraphTransactionContext, 'rootDiagramId'>;

/** Coordinates parent-first graph locks and gives both repositories the same transaction scope. */
export class GraphTransaction {
  constructor(private readonly diagrams: DiagramRepositoryLike, private readonly adrs?: AdrRepositoryLike) {}

  async readArchiveRows({ diagrams, adrs }: CollectionTransactionContext, diagramIds?: string[]): Promise<ArchiveRecords> {
    return { ...await diagrams.readArchiveRows(diagramIds), ...await adrs?.readArchiveRows(diagramIds) ?? { adrs: [], adrComponentLinks: [], adrRelationshipLinks: [] } };
  }
  async readArchiveSnapshot(): Promise<ArchiveRecords> {
    return this.diagrams.withArchiveSnapshot(async (diagrams, transaction) => {
      const adrs = transaction !== undefined && transaction !== diagrams ? this.adrs?.withTransaction?.(transaction) : this.adrs;
      return structuredClone(await this.readArchiveRows({ diagrams, adrs }));
    });
  }

  /** Authoritative owned rows, one coordinated transaction; diagram and epoch tombstones survive. */
  async applyArchiveRows(input: ArchiveRecords): Promise<string[]> {
    const incoming = archiveRecordsSchema.parse(input);
    for (const collection of archiveCollections) (incoming[collection] as ArchiveRow[]) = normalizeArchiveRows(collection,incoming[collection]);
    validateArchiveGraph(incoming);
    return this.runCollection(async context => {
      const { diagrams, adrs } = context;
      if (!adrs) throw new Error('Archive apply requires paired ADR persistence');
      const saved = await this.readArchiveRows(context), included = new Set(incoming.diagrams.map(d => d.id.toLowerCase()));
      const owner = (collection: ArchiveCollection, row: ArchiveRow, records: ArchiveRecords): string => {
        if (collection === 'diagrams') return (row as ArchiveRecords['diagrams'][number]).id.toLowerCase();
        if ('diagramId' in row) return row.diagramId.toLowerCase();
        if ('groupId' in row) return records.systemGroups.find(g => g.id.toLowerCase() === row.groupId.toLowerCase())!.diagramId.toLowerCase();
        return records.adrs.find(a => a.id.toLowerCase() === (row as { adrId: string }).adrId.toLowerCase())!.diagramId.toLowerCase();
      };
      const same = (a: ArchiveRow, b: ArchiveRow) => Object.keys(a).every(key => {
        const av = (a as unknown as Record<string,unknown>)[key], bv = (b as unknown as Record<string,unknown>)[key];
        return typeof av === 'string' && (key === 'id' || key.endsWith('Id')) ? av.toLowerCase() === String(bv).toLowerCase() : av === bv;
      });
      const changed = new Set<string>(), removals = new Map<ArchiveCollection, string[][]>(), writes = {} as ArchiveRecords;
      const union = {} as ArchiveRecords;
      for (const collection of archiveCollections) {
        const existing = new Map(saved[collection].map(row => [archiveRowIdentity(collection,row).join('/'),row]));
        const next = new Set(incoming[collection].map(row => archiveRowIdentity(collection,row).join('/')));
        const removed = saved[collection].filter(row => included.has(owner(collection,row,saved)) && !next.has(archiveRowIdentity(collection,row).join('/')));
        if (collection === 'diagrams' && removed.length) throw new Error('Archive cannot remove diagrams');
        removals.set(collection,removed.map(row => archiveRowIdentity(collection,row)));
        (writes[collection] as ArchiveRow[]) = incoming[collection].filter(row => {
          const prior = existing.get(archiveRowIdentity(collection,row).join('/'));
          if (prior && (owner(collection,prior,saved) !== owner(collection,row,incoming) || collection === 'diagrams' && ['kind','parentDiagramId','ownerComponentId'].some(key => (prior as unknown as Record<string,unknown>)[key] !== (row as unknown as Record<string,unknown>)[key]))) throw new Error(`Archive ownership conflict in ${collection}`);
          if (prior && same(prior,row)) return false;
          changed.add(owner(collection,row,incoming)); return true;
        });
        for (const row of removed) changed.add(owner(collection,row,saved));
        (union[collection] as ArchiveRow[]) = [...saved[collection].filter(row => !included.has(owner(collection,row,saved))),...incoming[collection]];
      }
      validateArchiveGraph(union);
      if (!changed.size) return [];
      await diagrams.deferArchiveSources();
      // Immediate FKs require hierarchy owners first and replacement/root references in a second pass.
      for (const kind of ['general','container','component']) {
        const rows = writes.diagrams.filter(d => d.kind === kind);
        await diagrams.upsertArchiveRows('diagrams',rows.map(d => ({ ...d, trashRootDiagramId: null })));
        const ids = new Set(incoming.diagrams.filter(d => d.kind === kind).map(d => d.id));
        await diagrams.upsertArchiveRows('components',writes.components.filter(c => ids.has(c.diagramId)).sort((a,b) => Number(Boolean(a.sourceComponentId)) - Number(Boolean(b.sourceComponentId))));
      }
      await diagrams.upsertArchiveRows('diagrams',writes.diagrams);
      await diagrams.upsertArchiveRows('systemGroups',writes.systemGroups);
      await diagrams.upsertArchiveRows('relationships',writes.relationships);
      // Clear only changed/removed replacements before writing all ADR identities.
      const staged = saved.adrs.filter(a => included.has(a.diagramId.toLowerCase()) && (removals.get('adrs')!.some(([id]) => id === a.id.toLowerCase()) || writes.adrs.some(row => row.id.toLowerCase() === a.id.toLowerCase())));
      await adrs.upsertArchiveRows('adrs',staged.map(a => ({ ...a, replacementAdrId: null })));
      await adrs.upsertArchiveRows('adrs',writes.adrs.map(a => ({ ...a, replacementAdrId: null })));
      await adrs.upsertArchiveRows('adrs',writes.adrs);
      await diagrams.upsertArchiveRows('systemGroupMembers',writes.systemGroupMembers);
      await adrs.upsertArchiveRows('adrComponentLinks',writes.adrComponentLinks);
      await adrs.upsertArchiveRows('adrRelationshipLinks',writes.adrRelationshipLinks);
      for (const c of ['adrComponentLinks','adrRelationshipLinks'] as const) await adrs.removeArchiveRows(c,removals.get(c)!);
      await diagrams.removeArchiveRows('systemGroupMembers',removals.get('systemGroupMembers')!);
      await diagrams.removeArchiveRows('relationships',removals.get('relationships')!);
      await diagrams.removeArchiveRows('systemGroups',removals.get('systemGroups')!);
      await adrs.removeArchiveRows('adrs',removals.get('adrs')!);
      const obsolete = saved.components.filter(c => removals.get('components')!.some(([id]) => id === c.id.toLowerCase()));
      const depth = (diagramId: string) => ({ general: 0, container: 1, component: 2 })[saved.diagrams.find(d => d.id === diagramId)!.kind];
      for (const c of obsolete.sort((a,b) => depth(b.diagramId)-depth(a.diagramId) || Number(Boolean(b.sourceComponentId))-Number(Boolean(a.sourceComponentId)))) await diagrams.removeArchiveRows('components',[[c.id]]);
      await diagrams.checkArchiveSources();
      const result = await this.readArchiveRows(context); validateArchiveGraph(result);
      adrs.registerArchiveReferences?.(result);
      await diagrams.advanceConfirmationEpochs([...changed]);
      return [...changed].sort();
    });
  }

  async runCollection<T>(action: (context: CollectionTransactionContext) => MaybePromise<T>): Promise<T> {
    return this.diagrams.withCollectionTransaction(async (diagrams, transaction) => {
      const snapshot = this.adrs?.snapshotGraph?.();
      const adrs = transaction !== undefined && transaction !== diagrams ? this.adrs?.withTransaction?.(transaction) : this.adrs;
      try { return await action({ diagrams, adrs }); }
      catch (error) { if (snapshot !== undefined) this.adrs?.restoreGraphSnapshot?.(snapshot); throw error; }
    });
  }

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
