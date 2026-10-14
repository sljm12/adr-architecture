import type * as Domain from '../../../shared/src/index';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramService } from '../../src/services/diagram-service';
import { collectionDeletionFixture } from '../component-recovery-fixture';
import { validateCollectionContract as validate } from './collection-deletion-contract';

const apps: ReturnType<typeof buildApp>[] = [];
const target = { kind: 'clear-trash' };
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function setup() {
  const fixture = await collectionDeletionFixture();
  const app = buildApp(fixture.repository, fixture.adrs); apps.push(app);
  const service = new DiagramService(fixture.repository, fixture.adrs);
  const preview = () => app.inject({ method: 'POST', url: '/diagrams/deletion-set-preview', payload: { target } });
  const execute = (impact: Domain.CollectionImpact, overrides = {}) => app.inject({ method: 'POST', url: '/diagrams/deletion-set', payload: { target, rootDiagramIds: impact.rootDiagramIds, confirmationToken: impact.confirmationToken, ...overrides } });
  return { ...fixture, app, service, preview, execute };
}

describe('clear Trash HTTP contract', () => {
  it('previews all batches once and purges only trashed entries with pre-action counts/statuses', async () => {
    const f = await setup();
    const p = await f.service.trashImpact(f.first.context); await f.service.trash(f.first.context, p.affectedDiagramIds);
    const before = await f.snapshot();
    const response = await f.preview(); expect(response.statusCode).toBe(200); validate('CollectionImpact', response.json());
    const impact = response.json();
    expect(impact.target).toEqual(target); expect(impact.mode).toBe('permanent'); expect(impact.rootDiagramIds).toEqual([]);
    const trashed = before.documents.filter(d => d.status === 'trashed').map(d => d.id).sort();
    expect(impact.affectedDiagrams.map((d: Domain.DiagramDocument) => d.id).sort()).toEqual(trashed); expect(impact.affectedCount).toBe(trashed.length);
    expect(impact.affectedDiagrams.every((d: Domain.DiagramDocument) => d.status === 'trashed')).toBe(true);
    expect(await f.snapshot()).toEqual(before);
    const result = await f.execute(impact); expect(result.statusCode).toBe(200); validate('CollectionResult', result.json());
    const { confirmationToken: _token, ...expected } = impact; expect(result.json()).toEqual(expected);
    for (const d of before.documents) {
      if (d.status === 'trashed') expect(await f.repository.get(d.id)).toBeUndefined();
      else expect(await f.repository.get(d.id)).toEqual(d);
    }
    for (const saved of before.saved.filter(s => !trashed.includes(s.id))) expect(await f.adrs.listFull(saved.id)).toEqual(saved.adrs);
  });

  it('returns a zero-item preview and accepts its unchanged confirmation as a no-op', async () => {
    const f = await setup();
    for (const id of [f.first.datastoreChild, f.second.datastoreChild]) {
      const p = await f.service.restoreImpact(id); await f.service.restore(id, { confirmedDiagramIds: p.affectedDiagramIds, confirmedTrashBatchId: p.trashBatchId });
    }
    const before = await f.snapshot();
    const response = await f.preview(); expect(response.statusCode).toBe(200); validate('CollectionImpact', response.json());
    expect(response.json()).toMatchObject({ target, mode: 'permanent', rootDiagramIds: [], affectedDiagrams: [], affectedCount: 0 });
    const result = await f.execute(response.json()); expect(result.statusCode).toBe(200); validate('CollectionResult', result.json());
    expect(result.json()).toEqual({ target, mode: 'permanent', rootDiagramIds: [], affectedDiagrams: [], affectedCount: 0 });
    expect(await f.snapshot()).toEqual(before);
  });

  it.each([
    { target: { kind: 'clear-trash', selector: { name: 'Anything' } } },
    { target: { kind: 'clear-trash', mode: 'permanent' } },
    { target: { kind: 'clear-trash', name: 'Anything' } },
    { target, mode: 'permanent' },
    { target, extra: true },
  ])('rejects unknown selectors/modes/fields: %j', async payload => {
    const f = await setup();
    const response = await f.app.inject({ method: 'POST', url: '/diagrams/deletion-set-preview', payload });
    expect(response.statusCode).toBe(400); validate('Error', response.json()); expect(response.json().code).toBe('DELETE_INVALID_REQUEST');
    expect(await f.snapshot()).toEqual(f.before);
  });

  it.each(['roots', 'token', 'target'] as const)('rejects %s tampering without deletion', async kind => {
    const f = await setup(); const response = await f.preview(); expect(response.statusCode).toBe(200);
    const overrides = kind === 'roots' ? { rootDiagramIds: [f.first.datastoreChild] } : kind === 'token' ? { confirmationToken: '0'.repeat(64) } : { target: { kind: 'all-matches', name: f.name, mode: 'permanent' }, rootDiagramIds: [f.first.context] };
    const result = await f.execute(response.json(), overrides);
    expect(result.statusCode).toBe(kind === 'roots' ? 400 : 409); validate('Error', result.json());
    expect(await f.snapshot()).toEqual(f.before);
  });

  it.each(['added', 'restored', 'content', 'provenance', 'ancestor'] as const)('rejects changed Trash %s before removal', async change => {
    const f = await setup(); const response = await f.preview(); expect(response.statusCode).toBe(200);
    if (change === 'added') await f.service.trash(f.first.unrelated);
    if (change === 'restored') { const p = await f.service.restoreImpact(f.first.datastoreChild); await f.service.restore(f.first.datastoreChild, { confirmedDiagramIds: p.affectedDiagramIds, confirmedTrashBatchId: p.trashBatchId }); }
    if (change === 'content') {
      const d = (await f.repository.get(f.first.datastoreChild))!;
      (f.repository as unknown as { documents: Map<string, Domain.DiagramDocument> }).documents.set(d.id, { ...d, updatedAt: '2030-01-01T00:00:00.000Z' });
    }
    if (change === 'provenance') { await f.service.restore(f.first.datastoreChild); await f.service.trash(f.first.datastoreChild); }
    if (change === 'ancestor') {
      const d = (await f.repository.get(f.first.parent))!;
      await f.service.save(d.id, { ...d, components: d.components.map(c => c.id === f.first.datastore ? { ...c, name: 'Renamed owner' } : c) });
    }
    const before = await f.snapshot();
    const result = await f.execute(response.json()); expect(result.statusCode).toBe(409); validate('Error', result.json()); expect(result.json().code).toBe('DELETE_IMPACT_CHANGED');
    expect(await f.snapshot()).toEqual(before);
  });

  it('invalidates full ADR content changes in Trash', async () => {
    const f = await setup(); const p = await f.service.trashImpact(f.first.context); await f.service.trash(f.first.context, p.affectedDiagramIds);
    const response = await f.preview(); expect(response.statusCode).toBe(200);
    const adr = (await f.adrs.listFull(f.first.child))[0];
    await f.adrs.update(adr.id, { ...adr, decision: 'Changed decision' });
    const before = await f.snapshot(); const result = await f.execute(response.json());
    expect(result.statusCode).toBe(409); validate('Error', result.json()); expect(result.json().code).toBe('DELETE_IMPACT_CHANGED'); expect(await f.snapshot()).toEqual(before);
  });

  it('refuses active descendants with an actionable dependency and keeps every Trash batch', async () => {
    const f = await setup(); await f.activeDescendantBlocker(); const before = await f.snapshot();
    const response = await f.preview(); expect(response.statusCode).toBe(409); validate('Error', response.json()); expect(response.json().code).toBe('DIAGRAM_DEPENDENCY');
    expect(response.json().blockers).toEqual(expect.arrayContaining([expect.objectContaining({ diagramId: f.first.child, nextAction: expect.any(String) })]));
    expect(await f.snapshot()).toEqual(before);
  });

  it('rejects an empty-Trash confirmation when a new batch appears', async () => {
    const f = await setup();
    for (const id of [f.first.datastoreChild, f.second.datastoreChild]) await f.service.restore(id);
    const response = await f.preview(); expect(response.statusCode).toBe(200); expect(response.json().affectedCount).toBe(0);
    await f.service.trash(f.first.unrelated); const before = await f.snapshot();
    const result = await f.execute(response.json()); expect(result.statusCode).toBe(409); validate('Error', result.json()); expect(result.json().code).toBe('DELETE_IMPACT_CHANGED');
    expect(await f.snapshot()).toEqual(before);
  });
});
