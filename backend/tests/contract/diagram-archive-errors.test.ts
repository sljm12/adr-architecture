import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { ArchiveService } from '../../src/services/archive-service';
import { ARCHIVE_MAX_BYTES } from '../../../shared/src/index';
import { archiveFixture, emptyArchiveFixture } from '../../../shared/tests/archive-fixtures';

afterEach(() => vi.restoreAllMocks());
describe('archive refusal boundary', () => {
  it('classifies pre-handler failures and strict envelopes without leaking input', async () => {
    const app = buildApp(new DiagramRepository(), new AdrRepository());
    try {
      for (const [payload, type, status, code] of [
        ['{"private-source":', 'application/json', 400, 'ARCHIVE_JSON_INVALID'],
        ['private-source', 'application/octet-stream', 415, 'ARCHIVE_MEDIA_TYPE'],
        [JSON.stringify({ archiveText: '{}', extra: 'private-source' }), 'application/json', 400, 'ARCHIVE_REQUEST_INVALID'],
        [JSON.stringify({ archiveText: '{"private-source":' }), 'application/json', 400, 'ARCHIVE_JSON_INVALID'],
        [JSON.stringify({ archiveText: JSON.stringify({ ...emptyArchiveFixture(), version: 99 }) }), 'application/json', 422, 'ARCHIVE_VERSION_UNSUPPORTED'],
        [JSON.stringify({ archiveText: JSON.stringify({ ...emptyArchiveFixture(), purpose: 'private-source' }) }), 'application/json', 422, 'ARCHIVE_INVALID'],
        [JSON.stringify({ archiveText: JSON.stringify({ ...emptyArchiveFixture(), 'private-source': true }) }), 'application/json', 422, 'ARCHIVE_INVALID'],
      ] as const) {
        const response = await app.inject({ method: 'POST', url: '/diagram-archives/preview', headers: { 'content-type': type }, payload });
        expect(response.statusCode).toBe(status); expect(response.json().code).toBe(code);
        expect(response.json().remedy).toBeTruthy(); expect(response.json().previewToken).toBeUndefined();
        expect(response.body).not.toContain('private-source'); expect(response.headers['cache-control']).toBe('no-store');
      }
      const huge = ' '.repeat(24 * 1024 * 1024);
      const exact = await app.inject({ method: 'POST', url: '/diagram-archives/preview', headers: { 'content-type': 'application/json' }, payload: huge.slice(2) + '{}' });
      expect(exact.statusCode).toBe(400); expect(exact.json().code).toBe('ARCHIVE_REQUEST_INVALID');
      const response = await app.inject({ method: 'POST', url: '/diagram-archives/preview', headers: { 'content-type': 'application/json' }, payload: huge + ' ' });
      expect(response.statusCode).toBe(413); expect(response.json().code).toBe('ARCHIVE_TOO_LARGE');
    } finally { await app.close(); }
  });
  it('accepts exactly 8 MiB and refuses the next UTF-8 byte without mutation', async () => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository(), app = buildApp(diagrams, adrs), graph = new GraphTransaction(diagrams, adrs);
    try {
      const text = JSON.stringify(emptyArchiveFixture()), exact = text + ' '.repeat(ARCHIVE_MAX_BYTES - Buffer.byteLength(text));
      expect((await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText: exact } })).statusCode).toBe(200);
      const response = await app.inject({ method: 'POST', url: '/diagram-archives/preview', payload: { archiveText: exact + ' ' } });
      expect(response.statusCode).toBe(413); expect(response.json().code).toBe('ARCHIVE_TOO_LARGE');
      expect((await graph.readArchiveSnapshot()).diagrams).toEqual([]);
    } finally { await app.close(); }
  });
  it('binds bytes, time, token, recovery digest and explicit choices before any mutation', async () => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository(), graph = new GraphTransaction(diagrams, adrs), service = new ArchiveService(diagrams, adrs);
    const fixture = archiveFixture(); await graph.applyArchiveRows(fixture.records);
    fixture.records.components[0].description = 'Incoming';
    const archiveText = JSON.stringify(fixture), preview = await service.preview(archiveText);
    const request = { archiveText, previewedAt: preview.previewedAt, previewToken: preview.previewToken, overrideExisting: true, recoverySaved: true, recoveryFileSha256: preview.recovery!.fileSha256 };
    const before = await graph.readArchiveSnapshot(), epoch = await diagrams.getConfirmationEpoch(fixture.selectedDiagramId);
    for (const patch of [{ archiveText: archiveText + '\n' }, { previewedAt: fixture.exportedAt }, { previewToken: '0'.repeat(64) }, { overrideExisting: false }, { recoverySaved: false }, { recoveryFileSha256: '0'.repeat(64) }]) {
      await expect(service.import({ ...request, ...patch })).rejects.toMatchObject({ code: patch.archiveText || patch.previewedAt || patch.previewToken ? 'ARCHIVE_PREVIEW_CHANGED' : 'ARCHIVE_CONFIRMATION_REQUIRED' });
      expect(await graph.readArchiveSnapshot()).toEqual(before); expect(await diagrams.getConfirmationEpoch(fixture.selectedDiagramId)).toBe(epoch);
    }
  });
  it('refuses oversized generated export and recovery and hides persistence failures', async () => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository(), graph = new GraphTransaction(diagrams, adrs), service = new ArchiveService(diagrams, adrs);
    const fixture = archiveFixture();
    // Many individually valid ADR fields exceed the transport cap as a complete hierarchy.
    fixture.records.adrs = Array.from({ length: 900 }, (_, i) => ({ ...fixture.records.adrs[0], id: `bbbbbbbb-0000-4000-8000-${i.toString(16).padStart(12, '0')}`, context: 'x'.repeat(10000) }));
    fixture.records.adrComponentLinks = []; fixture.records.adrRelationshipLinks = [];
    await graph.runCollection(async ({ adrs: scoped }) => { await diagrams.upsertArchiveRows('diagrams', [fixture.records.diagrams[0]]); await scoped!.upsertArchiveRows('adrs', fixture.records.adrs); });
    await expect(service.prepare(fixture.records.diagrams[0].id)).rejects.toMatchObject({ code: 'ARCHIVE_TOO_LARGE' });
    await expect(service.preview(JSON.stringify(emptyArchiveFixture()))).rejects.toMatchObject({ code: 'ARCHIVE_TOO_LARGE' });
    const app = buildApp(diagrams, adrs);
    try {
      vi.spyOn(diagrams, 'withArchiveSnapshot').mockRejectedValue(new Error('private-source SELECT password FROM secrets'));
      const response = await app.inject({ method: 'POST', url: `/diagrams/${fixture.selectedDiagramId}/archive` });
      expect(response.statusCode).toBe(500); expect(response.body).not.toMatch(/private-source|SELECT|password/);
      expect(response.json().code).toBe('ARCHIVE_FAILED');
    } finally { await app.close(); }
  });
});
