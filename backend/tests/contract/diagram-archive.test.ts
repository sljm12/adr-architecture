import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { archiveImportPreviewSchema, archiveImportResultSchema, preparedArchiveSchema, parseArchive } from '../../../shared/src/index';
import { archiveFixture, archiveId, dependencyArchiveFixture, emptyArchiveFixture } from '../../../shared/tests/archive-fixtures';
import { ArchiveService } from '../../src/services/archive-service';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
function installation() {
  const diagrams = new DiagramRepository(), adrs = new AdrRepository(), graph = new GraphTransaction(diagrams, adrs);
  const app = buildApp(diagrams, adrs); apps.push(app);
  return { app, graph, diagrams, adrs };
}
const confirmation = (archiveText: string, preview: { previewedAt: string; previewToken: string }) => ({ archiveText, previewedAt: preview.previewedAt, previewToken: preview.previewToken, overrideExisting: false, recoverySaved: false, recoveryFileSha256: null });

describe('new-only diagram archive HTTP contract', () => {
  it('keeps all response fields aligned with the checked-in OpenAPI contract', async () => {
    const contract = JSON.parse(await readFile('specs/013-diagram-archive-transfer/contracts/openapi.json', 'utf8'));
    for (const [name, schema] of [['PreparedArchive', preparedArchiveSchema], ['ImportPreview', archiveImportPreviewSchema], ['ImportResult', archiveImportResultSchema]] as const) {
      expect(Object.keys(schema.shape).sort()).toEqual(contract.components.schemas[name].required.toSorted());
      expect(contract.components.schemas[name].additionalProperties).toBe(false);
    }
  });
  it('sorts deterministically, expands recovery dependencies and supports deduplicated recovery seeds', () => {
    const { diagrams, adrs } = installation(), service = new ArchiveService(diagrams, adrs), fixture = dependencyArchiveFixture();
    const records = parseArchive(JSON.stringify(fixture)).records;
    const first = service.prepareRows(records, [archiveId(2)], fixture.exportedAt);
    const reversed = structuredClone(records); for (const rows of Object.values(reversed)) rows.reverse();
    expect(service.prepareRows(reversed, [archiveId(2)], fixture.exportedAt)).toEqual(first);
    expect(first.scope.find(d => d.id === archiveId(5))?.reason).toBe('reference-dependency');
    const recovery = service.prepareRows(records, [archiveId(5), archiveId(3), archiveId(3)], fixture.exportedAt, 'a'.repeat(64));
    expect(parseArchive(recovery.archiveText).seedDiagramIds).toEqual([archiveId(3), archiveId(5)]);
    expect(recovery.scope).toHaveLength(5);
  });
  it('enforces archive and envelope limits locally while preserving ordinary route limits', async () => {
    const { app } = installation(), archiveText = JSON.stringify(emptyArchiveFixture()) + ' '.repeat(1024 * 1024);
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText } })).statusCode).toBe(200);
    const ordinary = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: ' '.repeat(1024 * 1024) } });
    expect(ordinary.statusCode).toBe(413); expect(ordinary.json().code).not.toBe('ARCHIVE_TOO_LARGE');
    for (const size of [8 * 1024 * 1024 + 1, 24 * 1024 * 1024]) {
      const response = await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText: ' '.repeat(size) } });
      expect(response.statusCode).toBe(413); expect(response.json().code).toBe('ARCHIVE_TOO_LARGE');
    }
  });
  it.each([2, 3])('prepares active/Trash child %s once with exact bytes and complete saved scope', async selected => {
    const { app, graph } = installation(); await graph.applyArchiveRows(parseArchive(JSON.stringify(archiveFixture())).records);
    const before = await graph.readArchiveSnapshot();
    const response = await app.inject({ method: 'POST', url: `/diagrams/${archiveId(selected)}/archive` });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    const prepared = preparedArchiveSchema.parse(response.json());
    expect(prepared.byteLength).toBe(Buffer.byteLength(prepared.archiveText));
    expect(prepared.fileSha256).toBe(createHash('sha256').update(prepared.archiveText).digest('hex'));
    expect(parseArchive(prepared.archiveText).records).toEqual(before);
    expect(prepared.scope.map(d => d.id)).toEqual(before.diagrams.map(d => d.id));
    expect(prepared.counts.diagrams).toBe(4); expect(prepared.counts.adrComponentLinks).toBe(1);
    expect(await graph.readArchiveSnapshot()).toEqual(before);
  });
  it('rejects invalid/missing selectors and strict envelopes through the archive error boundary', async () => {
    const { app } = installation();
    for (const [id, status] of [['bad', 400], [archiveId(999), 404]] as const) {
      const response = await app.inject({ method: 'POST', url: `/diagrams/${id}/archive` });
      expect(response.statusCode).toBe(status); expect(response.json().remedy).toBeTruthy();
    }
    for (const payload of [{}, { archiveText: '{}', extra: true }]) expect((await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload })).json().code).toBe('ARCHIVE_REQUEST_INVALID');
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/preview', headers: { 'content-type': 'application/json' }, payload: '{' })).json().code).toBe('ARCHIVE_JSON_INVALID');
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/preview', headers: { 'content-type': 'application/xml' }, payload: '<xml/>' })).json().code).toBe('ARCHIVE_MEDIA_TYPE');
  });
  it.each([archiveFixture, emptyArchiveFixture])('previews without mutation then explicitly commits every raw field', async fixture => {
    const { app, graph, diagrams } = installation(), archiveText = JSON.stringify(fixture());
    const before = await graph.readArchiveSnapshot();
    const response = await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText } });
    expect(response.statusCode).toBe(200);
    const preview = archiveImportPreviewSchema.parse(response.json());
    expect(preview.requiresOverride).toBe(false); expect(preview.requiresRecovery).toBe(false); expect(preview.recovery).toBeNull();
    expect(preview.totals.added).toBe(Object.values(fixture().records).reduce((sum, rows) => sum + rows.length, 0));
    expect(await graph.readArchiveSnapshot()).toEqual(before);
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: { archiveText } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: { ...confirmation(archiveText, preview), overrideExisting: true } })).statusCode).toBe(409);
    const result = await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: confirmation(archiveText, preview) });
    expect(result.statusCode).toBe(200); expect(archiveImportResultSchema.parse(result.json()).committed).toBe(true);
    expect(await graph.readArchiveSnapshot()).toEqual(fixture().records);
    for (const id of fixture().includedDiagramIds) expect(await diagrams.getConfirmationEpoch(id)).toBe('1');
    const again = await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText } });
    expect(again.statusCode).toBe(409); expect(again.json().code).toBe('ARCHIVE_CONFIRMATION_REQUIRED');
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: confirmation(archiveText, preview) })).statusCode).toBe(409);
  });
  it('binds exact bytes and local tombstones while allowing unrelated saved changes', async () => {
    const { app, graph, diagrams } = installation(), archiveText = JSON.stringify(emptyArchiveFixture());
    const preview = (await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText } })).json();
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: confirmation(archiveText + '\n', preview) })).json().code).toBe('ARCHIVE_PREVIEW_CHANGED');
    await diagrams.withCollectionTransaction(d => d.advanceConfirmationEpochs([archiveId(1)]));
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: confirmation(archiveText, preview) })).json().code).toBe('ARCHIVE_PREVIEW_CHANGED');
    expect((await graph.readArchiveSnapshot()).diagrams).toEqual([]);
    const fresh = (await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText } })).json();
    const other = emptyArchiveFixture(); other.records.diagrams[0].id = archiveId(999);
    await graph.applyArchiveRows(parseArchive(JSON.stringify({ ...other, selectedDiagramId: archiveId(999), seedDiagramIds: [archiveId(999)], includedDiagramIds: [archiveId(999)] })).records);
    expect((await app.inject({ method: 'POST', url: '/diagram-archives/import', payload: confirmation(archiveText, fresh) })).statusCode).toBe(200);
  });
});
