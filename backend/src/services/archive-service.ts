import { createHash } from 'node:crypto';
import {
  ARCHIVE_MAX_BYTES, ArchiveValidationError, archiveCollections, archiveImportPreviewSchema, archiveImportRequestSchema,
  archiveImportResultSchema, discoverArchiveScope, parseArchive, preparedArchiveSchema, validateArchiveGraph,
  type Archive, type ArchiveCollection, type ArchiveErrorBody, type ArchiveImportRequest, type ArchiveRecords,
  type ArchiveRow, type ArchiveScopeItem,
} from '../../../shared/src/index';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import { GraphTransaction, type CollectionTransactionContext } from '../persistence/graph-transaction';
import { archiveRowIdentity, normalizeArchiveRows, sortArchiveRows } from '../persistence/archive-repository';

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const now = () => new Date().toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
const emptyDelta = () => ({ added: 0, replaced: 0, removed: 0, unchanged: 0 });
export class ArchiveOperationError extends Error {
  constructor(readonly status: number, readonly code: ArchiveErrorBody['code'], message: string, readonly remedy: string) { super(message); }
}

function owner(collection: ArchiveCollection, row: ArchiveRow, records: ArchiveRecords): string {
  if ('diagramId' in row) return row.diagramId.toLowerCase();
  if ('id' in row) return row.id.toLowerCase();
  if ('groupId' in row) return records.systemGroups.find(g => g.id.toLowerCase() === row.groupId.toLowerCase())!.diagramId.toLowerCase();
  return records.adrs.find(a => a.id.toLowerCase() === row.adrId.toLowerCase())!.diagramId.toLowerCase();
}
function ordered(records: ArchiveRecords): ArchiveRecords {
  return Object.fromEntries(archiveCollections.map(c => [c, sortArchiveRows(c, normalizeArchiveRows(c, records[c]))])) as ArchiveRecords;
}
function scope(records: ArchiveRecords, seeds: string[], purpose: Archive['purpose'] = 'diagram'): ArchiveScopeItem[] {
  const seedRoots = new Set(seeds.map(id => {
    let diagram = records.diagrams.find(d => d.id.toLowerCase() === id.toLowerCase())!;
    while (diagram.parentDiagramId) diagram = records.diagrams.find(d => d.id.toLowerCase() === diagram.parentDiagramId!.toLowerCase())!;
    return diagram.id;
  }));
  return records.diagrams.map(d => {
    let root = d;
    while (root.parentDiagramId) root = records.diagrams.find(r => r.id === root.parentDiagramId)!;
    return { id: d.id, name: d.name, kind: d.kind, status: d.status, reason: seedRoots.has(root.id) ? purpose === 'recovery' ? 'recovery-seed' : 'selected-hierarchy' : 'reference-dependency' };
  });
}

export class ArchiveService {
  private readonly graph: GraphTransaction;
  constructor(diagrams: DiagramRepositoryLike, adrs: AdrRepositoryLike) { this.graph = new GraphTransaction(diagrams, adrs); }

  async prepare(selectedDiagramId: string) {
    const rows = await this.graph.readArchiveSnapshot();
    if (!rows.diagrams.some(d => d.id.toLowerCase() === selectedDiagramId.toLowerCase())) throw new ArchiveOperationError(404, 'ARCHIVE_NOT_FOUND', 'Saved diagram is unavailable.', 'Refresh the library and select a saved diagram.');
    return this.prepareRows(rows, [selectedDiagramId], now());
  }

  /** Union closure also supports the later recovery workflow without changing artifact values. */
  prepareRows(rows: ArchiveRecords, seedDiagramIds: string[], exportedAt: string, recoveryForFileSha256: string | null = null) {
    const included = discoverArchiveScope(rows, seedDiagramIds);
    const records = ordered(Object.fromEntries(archiveCollections.map(c => [c, rows[c].filter(row => included.has(owner(c, row, rows)))])) as ArchiveRecords);
    const seeds = [...new Set(seedDiagramIds.map(id => id.toLowerCase()))].sort();
    const archive: Archive = { format: 'adr-diagram-archive', version: 1, purpose: recoveryForFileSha256 ? 'recovery' : 'diagram', exportedAt, selectedDiagramId: seeds[0], seedDiagramIds: seeds, includedDiagramIds: records.diagrams.map(d => d.id), recoveryForFileSha256, records };
    const archiveText = JSON.stringify(archive);
    if (Buffer.byteLength(archiveText, 'utf8') > ARCHIVE_MAX_BYTES) throw new ArchiveOperationError(413, 'ARCHIVE_TOO_LARGE', 'The complete archive exceeds 8 MiB.', 'Reduce the saved hierarchy size before exporting.');
    parseArchive(archiveText);
    return preparedArchiveSchema.parse({ archiveText, fileSha256: sha256(archiveText), byteLength: Buffer.byteLength(archiveText, 'utf8'), scope: scope(records, seeds, archive.purpose), counts: Object.fromEntries(archiveCollections.map(c => [c, records[c].length])) });
  }

  async preview(archiveText: string) {
    const archive = parseArchive(archiveText), previewedAt = now();
    return this.graph.runCollection(context => this.review(archiveText, archive, previewedAt, context));
  }

  private async review(archiveText: string, archive: Archive, previewedAt: string, context: CollectionTransactionContext) {
    const incoming = ordered(archive.records), saved = ordered(await this.graph.readArchiveRows(context));
    const included = new Set(incoming.diagrams.map(d => d.id));
    const changed = new Set<string>();
    const changes = archiveCollections.flatMap(collection => {
      const existing = new Map(saved[collection].map(row => [archiveRowIdentity(collection, row).join('/'), row]));
      const identities = new Set(incoming[collection].map(row => archiveRowIdentity(collection, row).join('/')));
      const describe = (row: ArchiveRow, action: 'added' | 'replaced' | 'removed' | 'unchanged', collision: boolean, records: ArchiveRecords) => {
        const diagramId = owner(collection, row, records);
        if (action !== 'unchanged') changed.add(diagramId);
        return { collection, identity: archiveRowIdentity(collection, row), diagramId, name: 'name' in row ? row.name : 'title' in row ? row.title : null, action, collision };
      };
      return [...incoming[collection].map(row => {
        const identity = archiveRowIdentity(collection, row), prior = existing.get(identity.join('/'));
        if (prior && (owner(collection, prior, saved) !== owner(collection, row, incoming) || collection === 'diagrams' && ['kind', 'parentDiagramId', 'ownerComponentId'].some(key => (prior as unknown as Record<string, unknown>)[key] !== (row as unknown as Record<string, unknown>)[key]))) {
          throw new ArchiveOperationError(409, 'ARCHIVE_OWNERSHIP', `Incompatible ownership in ${collection}: ${identity.join('/')}.`, 'Use the original diagram kind, parent and owner; resolve the conflicting identity before reviewing again.');
        }
        return describe(row, !prior ? 'added' : JSON.stringify(prior) === JSON.stringify(row) ? 'unchanged' : 'replaced', Boolean(prior), incoming);
      }), ...saved[collection].filter(row => included.has(owner(collection, row, saved)) && !identities.has(archiveRowIdentity(collection, row).join('/'))).map(row => describe(row, 'removed', false, saved))];
    });
    const union = Object.fromEntries(archiveCollections.map(c => [c, [...saved[c].filter(row => !included.has(owner(c, row, saved))), ...incoming[c]]])) as ArchiveRecords;
    try { validateArchiveGraph(union); }
    catch (error) {
      if (error instanceof ArchiveValidationError) throw new ArchiveOperationError(409, 'ARCHIVE_DEPENDENCY', `The file conflicts with retained destination references at ${error.issues?.map(issue => issue.path).join(', ') ?? 'records'}.`, 'Keep the referenced owners, components, ADRs and Trash roots, or resolve the retained dependency before reviewing again.');
      throw error;
    }
    const recoverySeeds = saved.diagrams.filter(d => changed.has(d.id)).map(d => d.id);
    const recovery = recoverySeeds.length ? this.prepareRows(saved, recoverySeeds, previewedAt, sha256(archiveText)) : null;
    // Include retained reverse dependencies, but leave unrelated destination graphs out of consent.
    const relevant = new Set(included);
    if (recovery) for (const item of recovery.scope) relevant.add(item.id);
    for (const diagram of saved.diagrams) {
      if ([...discoverArchiveScope(saved, [diagram.id])].some(id => included.has(id))) relevant.add(diagram.id);
    }
    const relevantRows = Object.fromEntries(archiveCollections.map(c => [c, saved[c].filter(row => relevant.has(owner(c, row, saved)))]));
    const epochs: string[][] = [];
    for (const id of [...relevant].sort()) epochs.push([id, await context.diagrams.getConfirmationEpoch(id)]);
    const byCollection = Object.fromEntries(archiveCollections.map(c => [c, emptyDelta()]));
    const totals = emptyDelta();
    for (const change of changes) { byCollection[change.collection][change.action]++; totals[change.action]++; }
    const requiresOverride = changes.some(change => change.collision), requiresRecovery = Boolean(recovery);
    const previewToken = sha256(JSON.stringify({ fileSha256: sha256(archiveText), previewedAt, epochs, relevantRows, changes, recovery: recovery?.fileSha256 ?? null }));
    return archiveImportPreviewSchema.parse({ fileSha256: sha256(archiveText), previewedAt, previewToken, includedDiagrams: scope(incoming, archive.seedDiagramIds, archive.purpose), changes, totals, byCollection, requiresOverride, requiresRecovery, recovery });
  }

  async import(input: ArchiveImportRequest) {
    const request = archiveImportRequestSchema.parse(input), archive = parseArchive(request.archiveText);
    return this.graph.runCollection(async context => {
      const reviewed = await this.review(request.archiveText, archive, request.previewedAt, context);
      if (request.previewToken !== reviewed.previewToken) throw new ArchiveOperationError(409, 'ARCHIVE_PREVIEW_CHANGED', 'The reviewed file or destination changed.', 'Preview the exact file again before importing.');
      if (request.overrideExisting !== reviewed.requiresOverride || request.recoverySaved !== reviewed.requiresRecovery || request.recoveryFileSha256 !== (reviewed.recovery?.fileSha256 ?? null)) throw new ArchiveOperationError(409, 'ARCHIVE_CONFIRMATION_REQUIRED', 'Override or recovery confirmation does not match the reviewed changes.', 'Review the whole file, explicitly approve matching identities and save and acknowledge the exact recovery file when required.');
      const affectedDiagramIds = await new GraphTransaction(context.diagrams, context.adrs).applyArchiveRows(archive.records);
      return archiveImportResultSchema.parse({ committed: true, fileSha256: reviewed.fileSha256, affectedDiagramIds, includedDiagrams: reviewed.includedDiagrams, totals: reviewed.totals, byCollection: reviewed.byCollection });
    });
  }
}
