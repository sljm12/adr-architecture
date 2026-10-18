import { describe, expect, it } from 'vitest';
import { archiveFixture, archiveId } from '../../shared/tests/archive-fixtures';
import { DiagramRepository } from '../src/persistence/diagram-repository';
import { AdrRepository } from '../src/persistence/adr-repository';
import { GraphTransaction } from '../src/persistence/graph-transaction';

async function setup() {
  const diagrams = new DiagramRepository(), adrs = new AdrRepository(), graph = new GraphTransaction(diagrams, adrs);
  const records = archiveFixture().records;
  await graph.runCollection(async ({ diagrams, adrs }) => {
    for (const collection of ['diagrams','components','relationships','systemGroups','systemGroupMembers'] as const) await diagrams.upsertArchiveRows(collection, records[collection]);
    for (const collection of ['adrs','adrComponentLinks','adrRelationshipLinks'] as const) await adrs!.upsertArchiveRows(collection, records[collection]);
  });
  return { diagrams, adrs, graph, records };
}
describe('memory archive parity', () => {
  it('retains all raw values instead of hydrated names and maintains ordinary membership/link timestamps', async () => {
    const { diagrams, adrs, graph, records } = await setup();
    expect(await graph.readArchiveSnapshot()).toEqual(records);
    const document = diagrams.get(archiveId(1))!; await diagrams.replace(document);
    await adrs.replaceLinks(archiveId(60), [archiveId(11),archiveId(12)]);
    await adrs.replaceRelationshipLinks(archiveId(61), [archiveId(41)]);
    const rows = await graph.readArchiveSnapshot();
    expect(rows.systemGroupMembers).toEqual(records.systemGroupMembers);
    expect(rows.adrComponentLinks[0]).toEqual(records.adrComponentLinks[0]);
    expect(rows.adrComponentLinks[1].createdAt).toMatch(/\.\d{6}Z$/);
    expect(rows.adrRelationshipLinks).toEqual(records.adrRelationshipLinks);
  });
  it('rolls back removals, additions, sidecars, registrations and epochs before queued writers', async () => {
    const { diagrams, adrs, graph, records } = await setup(); const registration = adrs.snapshotGraph();
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const failing = graph.runCollection(async ({ diagrams, adrs }) => {
      await adrs!.removeArchiveRows('adrComponentLinks', [[archiveId(60), archiveId(11)]]);
      await diagrams.removeArchiveRows('components', [[archiveId(13)]]);
      await diagrams.upsertArchiveRows('diagrams', [{ ...records.diagrams[0], id: archiveId(99) }]);
      await diagrams.advanceConfirmationEpochs([archiveId(1),archiveId(99)]);
      entered(); await gate; throw new Error('rollback');
    });
    await started;
    const queued = graph.runCollection(async () => { expect(await graph.readArchiveRows({ diagrams, adrs })).toEqual(records); });
    release(); await expect(failing).rejects.toThrow('rollback'); await queued;
    expect(adrs.snapshotGraph()).toEqual(registration); expect(await diagrams.getConfirmationEpoch(archiveId(99))).toBe('0');
  });
  it('keeps epoch tombstones across purge and UUID reintroduction and skips identical applies', async () => {
    const { diagrams, graph, records } = await setup();
    await graph.runCollection(async ({ diagrams, adrs }) => {
      await diagrams.advanceConfirmationEpochs([archiveId(1)]);
      await adrs!.purgeOwned(records.diagrams.map(d => d.id)); await diagrams.purge([archiveId(3),archiveId(4),archiveId(2),archiveId(1)]);
      await diagrams.upsertArchiveRows('diagrams', [records.diagrams[0]]);
    });
    expect(await diagrams.getConfirmationEpoch(archiveId(1))).toBe('1');
  });
  it('applies mixed-case identities once, preserves ADR cycles and rolls back a final epoch failure', async () => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository(), graph = new GraphTransaction(diagrams,adrs);
    const records = archiveFixture().records;
    records.adrs[1].replacementAdrId = records.adrs[2].id;
    const mixed = JSON.parse(JSON.stringify(records).replaceAll('aaaaaaaa','AAAAAAAA'));
    expect(await graph.applyArchiveRows(mixed)).toEqual(records.diagrams.map(d => d.id).sort());
    expect(await graph.readArchiveSnapshot()).toEqual(records);
    expect(await graph.applyArchiveRows(records)).toEqual([]);
    const snapshot = adrs.snapshotGraph(), before = await graph.readArchiveSnapshot();
    const original = diagrams.advanceConfirmationEpochs;
    diagrams.advanceConfirmationEpochs = () => { throw new Error('epoch failure'); };
    records.components[0].name = 'changed';
    await expect(graph.applyArchiveRows(records)).rejects.toThrow('epoch failure');
    diagrams.advanceConfirmationEpochs = original;
    expect(await graph.readArchiveSnapshot()).toEqual(before); expect(adrs.snapshotGraph()).toEqual(snapshot);
    expect(await diagrams.getConfirmationEpoch(archiveId(1))).toBe('1');
  });
});
