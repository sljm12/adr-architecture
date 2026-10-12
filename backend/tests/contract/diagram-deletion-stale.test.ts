import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/api/app';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import { deletionErrorSchema } from '../../../shared/src/index';
const ordered = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));

afterEach(() => vi.useRealTimers());

describe.each(['trash', 'permanent'] as const)('%s stale confirmation HTTP', mode => {
  it.each(['component', 'relationship', 'group', 'metadata', 'adr', 'component links', 'relationship links', 'edit/revert', 'root rename', 'owner rename', 'ancestor', 'source', 'membership', 'status', 'provenance'])(
    'rejects %s changes and preserves the saved edit', async change => {
      const { repository, adrs, ids } = await diagramDeletionFixture();
      const service = new DiagramService(repository, adrs), decisions = new AdrService(adrs, repository);
      const root = ['owner rename', 'ancestor', 'source'].includes(change) ? ids.child : ids.context;
      const app = buildApp(repository, adrs);
      try {
        const preview = await app.inject({ method: 'POST', url: '/diagrams/deletion-preview', payload: { selector: { id: root }, mode } });
        expect(preview.statusCode).toBe(200);
        const context = (await repository.get(ids.context))!, parent = (await repository.get(ids.parent))!, child = (await repository.get(ids.child))!;
        const adr = (await adrs.listFull(ids.child)).find(a => a.status === 'accepted')!;
        switch (change) {
          case 'component': child.components[0].description = 'Saved responsibilities'; await service.save(child.id, child); break;
          case 'relationship': child.relationships[0].protocol = 'HTTPS'; await service.save(child.id, child); break;
          case 'group': context.groups[0].name = 'Saved team'; await service.save(context.id, context); break;
          case 'metadata': await service.save(child.id, child); break;
          case 'adr': await decisions.update(adr.id, { title: 'Saved decision', context: adr.context, decision: adr.decision, consequences: adr.consequences, status: adr.status }); break;
          case 'component links': await decisions.replaceLinks(adr.id, { componentIds: [] }); break;
          case 'relationship links': await decisions.replaceRelationshipLinks(adr.id, { relationshipIds: [] }); break;
          case 'edit/revert': {
            vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(child.updatedAt));
            const original = structuredClone(child);
            child.components[0].description = 'Temporary edit'; await service.save(child.id, child);
            await service.save(child.id, original);
            expect(await repository.get(child.id)).toEqual(original); vi.useRealTimers(); break;
          }
          case 'root rename': await service.save(context.id, { ...context, name: 'Renamed root' }); break;
          case 'owner rename': parent.components.find(c => c.id === ids.application)!.name = 'Renamed owner'; await service.save(parent.id, parent); break;
          case 'ancestor': await service.save(context.id, { ...context, name: 'Renamed ancestor' }); break;
          case 'source': parent.components.find(c => c.id === ids.personOccurrence)!.position.x += 10; await service.save(parent.id, parent); break;
          case 'membership': {
            await service.executeDeletion(ids.datastoreChild, await service.previewDeletion({ selector: { id: ids.datastoreChild }, mode: 'permanent' }).then(p => ({ mode: p.mode, confirmationToken: p.confirmationToken })));
            await service.createOrOpenComponentDiagram(ids.parent, ids.datastore); break;
          }
          case 'status': await service.trash(ids.child); break;
          case 'provenance': await service.restore(ids.datastoreChild); await service.trash(ids.datastoreChild); break;
        }
        const before = { documents: ordered(await repository.listAll()), adrs: ordered(await adrs.listFull(ids.child)), provenance: await repository.getTrashProvenance(ids.datastoreChild) };
        const response = await app.inject({ method: 'POST', url: `/diagrams/${root}/deletion`, payload: { mode, confirmationToken: preview.json().confirmationToken } });
        expect(response.statusCode).toBe(409);
        expect(deletionErrorSchema.parse(response.json()).code).toBe('DELETE_IMPACT_CHANGED');
        expect(response.json().remedy).toMatch(/fresh preview/);
        expect({ documents: ordered(await repository.listAll()), adrs: ordered(await adrs.listFull(ids.child)), provenance: await repository.getTrashProvenance(ids.datastoreChild) }).toEqual(before);
      } finally { await app.close(); }
    });

  it.each(['root', 'mode', 'token', 'removed root'])('refuses %s mismatch without changing other data', async mismatch => {
    const { repository, adrs, ids } = await diagramDeletionFixture(); const service = new DiagramService(repository, adrs), app = buildApp(repository, adrs);
    try {
      const preview = await service.previewDeletion({ selector: { id: ids.context }, mode });
      if (mismatch === 'removed root') await service.executeDeletion(ids.context, { mode: 'permanent', confirmationToken: (await service.previewDeletion({ selector: { id: ids.context }, mode: 'permanent' })).confirmationToken });
      const before = ordered(await repository.listAll());
      const response = await app.inject({ method: 'POST', url: `/diagrams/${mismatch === 'root' ? ids.unrelated : ids.context}/deletion`, payload: { mode: mismatch === 'mode' ? mode === 'trash' ? 'permanent' : 'trash' : mode, confirmationToken: mismatch === 'token' ? '0'.repeat(64) : preview.confirmationToken } });
      expect(response.statusCode).toBe(mismatch === 'removed root' ? 404 : 409);
      expect(deletionErrorSchema.safeParse(response.json()).success).toBe(true); expect(ordered(await repository.listAll())).toEqual(before);
    } finally { await app.close(); }
  });

  it('ignores edits in unrelated graphs', async () => {
    const { repository, adrs, ids } = await diagramDeletionFixture(); const service = new DiagramService(repository, adrs);
    const preview = await service.previewDeletion({ selector: { id: ids.child }, mode });
    await service.save(ids.unrelated, { ...(await repository.get(ids.unrelated))!, name: 'Independent edit' });
    await new AdrService(adrs, repository).create(ids.unrelated, { title: 'Independent ADR', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' });
    await expect(service.executeDeletion(ids.child, { mode, confirmationToken: preview.confirmationToken })).resolves.toMatchObject({ rootDiagramId: ids.child });
    expect((await repository.get(ids.unrelated))!.name).toBe('Independent edit'); expect(await adrs.listFull(ids.unrelated)).toHaveLength(1);
  });
});

describe('literal saved selectors', () => {
  it.each(['payments', 'Payments.*?', '支払い é', 'e\u0301', '00000000-0000-4000-8000-000000000001'])('matches only the complete name %j in either mode', async name => {
    const { repository, adrs, ids } = await diagramDeletionFixture(); const service = new DiagramService(repository, adrs);
    await repository.replace({ ...(await repository.get(ids.unrelated))!, name });
    for (const mode of ['trash', 'permanent'] as const) {
      expect((await service.previewDeletion({ selector: { name }, mode })).rootDiagramId).toBe(ids.unrelated);
      for (const near of [name + 'x', name.slice(0, -1), ` ${name}`, `${name} `, name === 'e\u0301' ? 'é' : name.toUpperCase()]) if (near !== name) await expect(service.previewDeletion({ selector: { name: near }, mode })).rejects.toMatchObject({ detail: { code: 'DELETE_NOT_FOUND' } });
    }
  });
  it('includes only eligible statuses in duplicate diagnostics', async () => {
    const { repository, adrs, ids } = await diagramDeletionFixture(); const service = new DiagramService(repository, adrs);
    const name = (await repository.get(ids.context))!.name;
    await repository.replace({ ...(await repository.get(ids.unrelated))!, name }); await service.trash(ids.unrelated);
    expect((await service.previewDeletion({ selector: { name }, mode: 'trash' })).rootDiagramId).toBe(ids.context);
    await expect(service.previewDeletion({ selector: { name }, mode: 'permanent' })).rejects.toMatchObject({ detail: { code: 'DELETE_NAME_AMBIGUOUS', candidates: expect.arrayContaining([expect.objectContaining({ id: ids.context, status: 'active' }), expect.objectContaining({ id: ids.unrelated, status: 'trashed' })]) } });
  });
});
