import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import { componentRecoveryFixture } from '../component-recovery-fixture';
describe('three-level confirmed recovery', () => {
  it('previews all active descendants, preserves independent trash and stages deep-child recovery', async () => {
    const repository = componentRecoveryFixture(), app = buildApp(repository);
    try {
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.datastoreChild}` })).statusCode).toBe(204);
      const independent = repository.getTrashProvenance(ids.datastoreChild);
      const impact = (await app.inject(`/diagrams/${ids.context}/trash-impact`)).json();
      expect(impact.affectedDiagramIds.sort()).toEqual([ids.context, ids.parent, ids.child].sort());
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.context}`, payload: { confirmedDiagramIds: [ids.context, ids.parent] } })).json().code).toBe('TRASH_IMPACT_CHANGED');
      expect(repository.get(ids.context)?.status).toBe('active');
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.context}`, payload: { confirmedDiagramIds: impact.affectedDiagramIds, impactToken: impact.impactToken } })).statusCode).toBe(204);
      const before = repository.listAll();
      const preview = (await app.inject(`/diagrams/${ids.datastoreChild}/restore-impact`)).json();
      expect(preview).toMatchObject({ restoreRootDiagramId: ids.context, requestedDiagramIncluded: false });
      expect(preview.affectedDiagramIds.sort()).toEqual([ids.context, ids.parent, ids.child].sort());
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.datastoreChild}/restore` })).json()).toMatchObject({ code: 'PARENT_INACTIVE', restoreRootDiagramId: ids.context });
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.context}/restore`, payload: { confirmedDiagramIds: preview.affectedDiagramIds, confirmedTrashBatchId: crypto.randomUUID() } })).json().code).toBe('RESTORE_IMPACT_CHANGED');
      expect(repository.listAll()).toEqual(before);
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.context}/restore`, payload: { confirmedDiagramIds: preview.affectedDiagramIds, confirmedTrashBatchId: preview.trashBatchId, impactToken: preview.impactToken } })).statusCode).toBe(200);
      expect(repository.get(ids.child)?.status).toBe('active');
      expect(repository.get(ids.datastoreChild)?.status).toBe('trashed');
      expect(repository.getTrashProvenance(ids.datastoreChild)).toEqual(independent);
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.datastoreChild}/restore` })).statusCode).toBe(200);
    } finally { await app.close(); }
  });
  it('trashes Container children together and rejects stale membership without mutation', async () => {
    const repository = componentRecoveryFixture(), app = buildApp(repository);
    try {
      const impact = (await app.inject(`/diagrams/${ids.parent}/trash-impact`)).json();
      expect(impact.affectedDiagramIds.sort()).toEqual([ids.parent, ids.child, ids.datastoreChild].sort());
      await app.inject({ method: 'DELETE', url: `/diagrams/${ids.datastoreChild}` });
      const before = repository.listAll();
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parent}`, payload: { confirmedDiagramIds: impact.affectedDiagramIds } })).json().code).toBe('TRASH_IMPACT_CHANGED');
      expect(repository.listAll()).toEqual(before);
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parent}`, payload: { confirmedDiagramIds: [ids.parent, ids.child] } })).statusCode).toBe(204);
      expect(repository.get(ids.context)?.status).toBe('active');
    } finally { await app.close(); }
  });
});
