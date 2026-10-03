import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { emptyChildFixture, generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';

export function recoveryFixture() {
  const repository = new DiagramRepository(); repository.create(generalParentFixture() as any); repository.create(populatedChildFixture() as any);
  const earlier = emptyChildFixture(); earlier.scope.softwareSystemId = ids.duplicateOwner; repository.create(earlier as any);
  return repository;
}
describe('confirmed exact recovery contract', () => {
  it('retains null-provenance legacy single-row restore and rejects malformed confirmations', async () => {
    const repository = new DiagramRepository(), parent = generalParentFixture(); parent.status = 'trashed'; parent.trashedAt = parent.updatedAt; repository.create(parent as any);
    const app = buildApp(repository);
    try {
      expect((await app.inject(`/diagrams/${parent.id}/restore-impact`)).json()).toMatchObject({ trashBatchId: null, affectedDiagramIds: [parent.id] });
      for (const payload of [{ confirmedDiagramIds: [parent.id] }, { confirmedDiagramIds: [parent.id, parent.id], confirmedTrashBatchId: null }, { confirmedDiagramIds: ['invalid'], confirmedTrashBatchId: null }]) expect((await app.inject({ method: 'POST', url: `/diagrams/${parent.id}/restore`, payload })).statusCode).toBe(422);
      expect(repository.get(parent.id)?.status).toBe('trashed');
      expect((await app.inject({ method: 'POST', url: `/diagrams/${parent.id}/restore` })).statusCode).toBe(200);
    } finally { await app.close(); }
  });
  it('previews a child parent batch, excludes earlier trash, and requires exact set and batch confirmation', async () => {
    const repository = recoveryFixture(), app = buildApp(repository);
    try {
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.emptyChild}` })).statusCode).toBe(204);
      const impact = (await app.inject(`/diagrams/${ids.parentDiagram}/trash-impact`)).json();
      expect(impact.affectedDiagramIds.sort()).toEqual([ids.parentDiagram, ids.populatedChild].sort());
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parentDiagram}`, payload: { confirmedDiagramIds: [ids.parentDiagram] } })).json().code).toBe('TRASH_IMPACT_CHANGED');
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parentDiagram}`, payload: { confirmedDiagramIds: impact.affectedDiagramIds } })).statusCode).toBe(204);
      const before = repository.listAll();
      const preview = (await app.inject(`/diagrams/${ids.populatedChild}/restore-impact`)).json();
      expect(preview).toMatchObject({ requestedDiagramId: ids.populatedChild, restoreRootDiagramId: ids.parentDiagram, trashBatchId: expect.any(String), requestedDiagramIncluded: true });
      expect(repository.listAll()).toEqual(before);
      const excluded = (await app.inject(`/diagrams/${ids.emptyChild}/restore-impact`)).json();
      expect(excluded.requestedDiagramIncluded).toBe(false);
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.populatedChild}/restore` })).json()).toMatchObject({ code: 'PARENT_INACTIVE', restoreRootDiagramId: ids.parentDiagram });
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.parentDiagram}/restore` })).json().code).toBe('RESTORE_CONFIRMATION_REQUIRED');
      const body = { confirmedDiagramIds: preview.affectedDiagramIds, confirmedTrashBatchId: preview.trashBatchId };
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.parentDiagram}/restore`, payload: { ...body, confirmedTrashBatchId: crypto.randomUUID() } })).json().code).toBe('RESTORE_IMPACT_CHANGED');
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.parentDiagram}/restore`, payload: { confirmedDiagramIds: body.confirmedDiagramIds } })).statusCode).toBe(422);
      expect(repository.listAll()).toEqual(before);
      const restored = await app.inject({ method: 'POST', url: `/diagrams/${ids.parentDiagram}/restore`, payload: body });
      expect(restored.statusCode).toBe(200); expect(restored.json().id).toBe(ids.parentDiagram);
      expect(repository.get(ids.populatedChild)?.status).toBe('active'); expect(repository.get(ids.emptyChild)?.status).toBe('trashed');
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.emptyChild}/restore` })).statusCode).toBe(200);
    } finally { await app.close(); }
  });
});
