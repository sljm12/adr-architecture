import type * as Domain from '../../../shared/src/index';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramService } from '../../src/services/diagram-service';
import { collectionDeletionFixture } from '../component-recovery-fixture';
import { validateCollectionContract as validate } from './collection-deletion-contract';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function setup() {
  const fixture = await collectionDeletionFixture();
  const app = buildApp(fixture.repository, fixture.adrs); apps.push(app);
  const service = new DiagramService(fixture.repository, fixture.adrs);
  const preview = (target: unknown) => app.inject({ method: 'POST', url: '/diagrams/deletion-set-preview', payload: { target } });
  const execute = (impact: Domain.CollectionImpact, overrides = {}) => app.inject({ method: 'POST', url: '/diagrams/deletion-set', payload: { target: impact.target, rootDiagramIds: impact.rootDiagramIds, confirmationToken: impact.confirmationToken, ...overrides } });
  return { ...fixture, app, service, preview, execute };
}

describe('all exact-name matches HTTP contract', () => {
  it.each(['trash', 'permanent'] as const)('deduplicates nested roots and commits the %s union with pre-action summaries', async mode => {
    const f = await setup();
    const target = { kind: 'all-matches', name: f.name, mode };
    const response = await f.preview(target);
    expect(response.statusCode).toBe(200); validate('CollectionImpact', response.json());
    const impact = response.json();
    const roots = [f.first.context, f.first.parent, f.first.child, f.second.context, f.second.parent, f.second.child].sort();
    expect(impact.rootDiagramIds).toEqual(roots);
    const affected = roots.concat(mode === 'permanent' ? [f.first.datastoreChild, f.second.datastoreChild] : []);
    expect(impact.affectedDiagrams.map((d: Domain.DiagramDocument) => d.id).sort()).toEqual(affected.sort());
    expect(impact.affectedCount).toBe(affected.length);
    expect(new Set(impact.affectedDiagrams.map((d: Domain.DiagramDocument) => d.id)).size).toBe(affected.length);
    expect(impact.affectedDiagrams.map((d: Domain.DiagramDocument) => d.kind)).toEqual(mode === 'trash' ? ['general', 'general', 'container', 'container', 'component', 'component'] : ['general', 'general', 'container', 'container', 'component', 'component', 'component', 'component']);
    for (const kind of ['general', 'container', 'component']) {
      const ids = impact.affectedDiagrams.filter((d: Domain.DiagramDocument) => d.kind === kind).map((d: Domain.DiagramDocument) => d.id);
      expect(ids).toEqual([...ids].sort());
    }
    expect(await f.snapshot()).toEqual(f.before);
    expect((await f.preview(target)).json()).toEqual(impact);
    const result = await f.execute(impact);
    expect(result.statusCode).toBe(200); validate('CollectionResult', result.json());
    const { confirmationToken: _token, ...expected } = impact;
    expect(result.json()).toEqual(expected);
    for (const id of affected) {
      const d = await f.repository.get(id);
      if (mode === 'permanent') expect(d).toBeUndefined();
      else expect(d!.status).toBe('trashed');
    }
    for (const d of f.before.documents.filter(d => !affected.includes(d.id))) expect(await f.repository.get(d.id)).toEqual(d);
  });

  it('returns actionable zero-match failure, one-match success, and retains default ambiguity refusal', async () => {
    const f = await setup();
    const missing = await f.preview({ kind: 'all-matches', name: f.name + ' absent', mode: 'trash' });
    expect(missing.statusCode).toBe(404); validate('Error', missing.json()); expect(missing.json().code).toBe('DELETE_NOT_FOUND');
    const single = await f.service.create('Only one');
    const preview = await f.preview({ kind: 'all-matches', name: single.name, mode: 'trash' });
    expect(preview.statusCode).toBe(200); validate('CollectionImpact', preview.json()); expect(preview.json().rootDiagramIds).toEqual([single.id]);
    const ambiguous = await f.app.inject({ method: 'POST', url: '/diagrams/deletion-preview', payload: { selector: { name: f.name }, mode: 'trash' } });
    expect(ambiguous.statusCode).toBe(409); validate('Error', ambiguous.json()); expect(ambiguous.json().code).toBe('DELETE_NAME_AMBIGUOUS');
  });

  it.each([' Équipe 東京! ', '3f85e47c-86c5-4b5a-983b-d95a7a7c2e74'])('preserves literal names including %s', async name => {
    const f = await setup();
    const roots = [await f.service.create(name), await f.service.create(name)];
    for (const d of roots) (f.repository as unknown as { documents: Map<string, Domain.DiagramDocument> }).documents.set(d.id, { ...d, name });
    await f.service.create(name + '!');
    const preview = await f.preview({ kind: 'all-matches', name, mode: 'permanent' });
    expect(preview.statusCode).toBe(200); validate('CollectionImpact', preview.json());
    expect(preview.json().rootDiagramIds).toEqual(roots.map(d => d.id).sort());
    expect(preview.json().affectedDiagrams.map((d: Domain.DiagramDocument) => d.name)).toEqual([name, name]);
  });

  it('uses active roots for Trash and all-status roots for permanent deletion', async () => {
    const f = await setup();
    const impact = await f.service.trashImpact(f.first.context); await f.service.trash(f.first.context, impact.affectedDiagramIds);
    const active = await f.preview({ kind: 'all-matches', name: f.name, mode: 'trash' });
    expect(active.statusCode).toBe(200); validate('CollectionImpact', active.json());
    expect(active.json().rootDiagramIds).toEqual([f.second.context, f.second.parent, f.second.child].sort());
    expect(active.json().affectedDiagrams.every((d: Domain.DiagramDocument) => d.status === 'active')).toBe(true);
    const mixed = await f.preview({ kind: 'all-matches', name: f.name, mode: 'permanent' });
    expect(mixed.statusCode).toBe(200); validate('CollectionImpact', mixed.json());
    expect(mixed.json().rootDiagramIds).toHaveLength(6); expect(mixed.json().affectedDiagrams).toHaveLength(8);
  });

  it.each(['target', 'roots', 'token'] as const)('rejects %s tampering before mutation', async kind => {
    const f = await setup(); const response = await f.preview({ kind: 'all-matches', name: f.name, mode: 'trash' }); expect(response.statusCode).toBe(200);
    const impact = response.json();
    const overrides = kind === 'target' ? { target: { ...impact.target, mode: 'permanent' } } : kind === 'roots' ? { rootDiagramIds: [f.first.context] } : { confirmationToken: '0'.repeat(64) };
    const result = await f.execute(impact, overrides);
    expect(result.statusCode).toBe(409); validate('Error', result.json()); expect(result.json().code).toBe('DELETE_IMPACT_CHANGED');
    expect(await f.snapshot()).toEqual(f.before);
  });

  it.each([
    { kind: 'all-matches', name: ' ', mode: 'trash' },
    { kind: 'all-matches', name: 'Name', mode: 'invalid' },
    { kind: 'all-matches', id: 'a0000000-0000-4000-8000-000000000001', mode: 'trash' },
    { kind: 'all-matches', name: 'Name', mode: 'trash', extra: true },
  ])('strictly rejects invalid targets: %j', async target => {
    const f = await setup(); const response = await f.preview(target);
    expect(response.statusCode).toBe(400); validate('Error', response.json()); expect(response.json().code).toBe('DELETE_INVALID_REQUEST');
    expect(await f.snapshot()).toEqual(f.before);
  });

  it.each(['added', 'removed', 'renamed', 'eligibility'] as const)('invalidates consent when matches are %s', async change => {
    const f = await setup(); const response = await f.preview({ kind: 'all-matches', name: f.name, mode: 'trash' }); expect(response.statusCode).toBe(200);
    if (change === 'added') await f.service.create(f.name);
    if (change === 'removed') { const p = await f.service.previewDeletion({ selector: { id: f.first.context }, mode: 'permanent' }); await f.service.executeDeletion(f.first.context, { mode: 'permanent', confirmationToken: p.confirmationToken }); }
    if (change === 'renamed') { const d = (await f.repository.get(f.first.context))!; await f.service.save(d.id, { ...d, name: 'Renamed root' }); }
    if (change === 'eligibility') { const p = await f.service.trashImpact(f.first.context); await f.service.trash(f.first.context, p.affectedDiagramIds); }
    const saved = await f.snapshot();
    const result = await f.execute(response.json());
    expect(result.statusCode).toBe(409); validate('Error', result.json()); expect(result.json().code).toBe('DELETE_IMPACT_CHANGED');
    expect(await f.snapshot()).toEqual(saved);
  });

  it('does not invalidate consent for an unrelated nonmatching edit', async () => {
    const f = await setup(); const response = await f.preview({ kind: 'all-matches', name: f.name, mode: 'trash' }); expect(response.statusCode).toBe(200);
    const d = (await f.repository.get(f.first.unrelated))!; await f.service.save(d.id, { ...d, name: 'Unrelated edit' });
    expect((await f.preview(response.json().target)).json()).toEqual(response.json());
    const result = await f.execute(response.json()); expect(result.statusCode).toBe(200); validate('CollectionResult', result.json());
    expect((await f.repository.get(d.id))!.name).toBe('Unrelated edit');
  });
});
