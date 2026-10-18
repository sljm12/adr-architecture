import { describe, expect, it } from 'vitest';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { buildApp } from '../../src/api/app';
import { trashConfirmationSchema, restoreConfirmationSchema } from '../../../shared/src/index';
import { generalParentFixture } from '../../../shared/tests/container-fixtures';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { GraphTransaction } from '../../src/persistence/graph-transaction';

describe('historical import confirmation compatibility', () => {
  it('accepts only strict optional SHA-256 impact tokens', () => {
    const ids = [generalParentFixture().id];
    expect(trashConfirmationSchema.safeParse({ confirmedDiagramIds: ids }).success).toBe(true);
    expect(trashConfirmationSchema.safeParse({ confirmedDiagramIds: ids, impactToken: 'a'.repeat(64) }).success).toBe(true);
    for (const impactToken of ['', null, 1, 'bad']) expect(restoreConfirmationSchema.safeParse({ confirmedDiagramIds: ids, confirmedTrashBatchId: null, impactToken }).success).toBe(false);
    expect(trashConfirmationSchema.safeParse({ confirmedDiagramIds: ids, extra: true }).success).toBe(false);
  });
  it.each([false,true])('supports epoch-zero legacy requests (body=%s) and refuses them after an epoch advance', async body => {
    const repository = new DiagramRepository(); const document = generalParentFixture(); await repository.create(document);
    const app = buildApp(repository); await app.ready();
    try {
      const url = `/diagrams/${document.id}`;
      const preview = (await app.inject({ method: 'GET', url: `${url}/trash-impact` })).json();
      expect(preview.impactToken).toMatch(/^[0-9a-f]{64}$/);
      expect((await app.inject({ method: 'DELETE', url, ...(body ? { payload: { confirmedDiagramIds: [document.id] } } : {}) })).statusCode).toBe(204);
      expect((await app.inject({ method: 'POST', url: `${url}/restore` })).statusCode).toBe(200);
      await repository.withCollectionTransaction(d => d.advanceConfirmationEpochs([document.id]));
      expect((await app.inject({ method: 'DELETE', url, ...(body ? { payload: { confirmedDiagramIds: [document.id] } } : {}) })).json().code).toBe('TRASH_IMPACT_CHANGED');
      expect((await app.inject({ method: 'DELETE', url, payload: { confirmedDiagramIds: [document.id], impactToken: preview.impactToken } })).json().code).toBe('TRASH_IMPACT_CHANGED');
      const fresh = (await app.inject({ method: 'GET', url: `${url}/trash-impact` })).json();
      expect((await app.inject({ method: 'DELETE', url, payload: { confirmedDiagramIds: fresh.affectedDiagramIds, impactToken: fresh.impactToken } })).statusCode).toBe(204);
      const restore = (await app.inject({ method: 'GET', url: `${url}/restore-impact` })).json();
      expect((await app.inject({ method: 'POST', url: `${url}/restore` })).json().code).toBe('RESTORE_IMPACT_CHANGED');
      expect((await app.inject({ method: 'POST', url: `${url}/restore`, payload: { confirmedDiagramIds: restore.affectedDiagramIds, confirmedTrashBatchId: restore.trashBatchId, impactToken: 'f'.repeat(64) } })).json().code).toBe('RESTORE_IMPACT_CHANGED');
      expect((await app.inject({ method: 'POST', url: `${url}/restore`, payload: { confirmedDiagramIds: restore.affectedDiagramIds, confirmedTrashBatchId: restore.trashBatchId, impactToken: restore.impactToken } })).statusCode).toBe(200);
    } finally { await app.close(); }
  });
  it('rejects a supplied stale token even when the epoch is zero', async () => {
    const repository = new DiagramRepository(); const document = generalParentFixture(); await repository.create(document);
    const app = buildApp(repository); await app.ready();
    try {
      const url = `/diagrams/${document.id}`;
      const impact = (await app.inject({ method: 'GET', url: `${url}/trash-impact` })).json();
      await repository.replace({ ...repository.get(document.id)!, name: 'changed' });
      expect((await app.inject({ method: 'DELETE', url, payload: { confirmedDiagramIds: [document.id], impactToken: impact.impactToken } })).statusCode).toBe(409);
    } finally { await app.close(); }
  });
  it('invalidates single/collection deletion consent for historical apply while preserving unrelated review', async () => {
    const repository = new DiagramRepository(), adrs = new AdrRepository(), document = generalParentFixture();
    await repository.create(document);
    const other = { ...document, id: 'aaaaaaaa-0000-4000-8000-000000000099', name: 'Other', components: [], relationships: [], groups: [] };
    await repository.create(other);
    const service = new DiagramService(repository,adrs), graph = new GraphTransaction(repository,adrs);
    const single = await service.previewDeletion({ selector: { id: document.id }, mode: 'trash' });
    const collection = await service.previewCollectionDeletion({ target: { kind: 'all-matches', name: document.name, mode: 'trash' } });
    const unrelated = await service.previewDeletion({ selector: { id: other.id }, mode: 'trash' });
    const historical = await graph.readArchiveSnapshot(), changed = structuredClone(historical);
    changed.diagrams.find(d => d.id === document.id)!.name = 'Imported earlier name';
    await graph.applyArchiveRows(changed); await graph.applyArchiveRows(historical);
    await expect(service.executeDeletion(document.id, { mode: 'trash', confirmationToken: single.confirmationToken })).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
    await expect(service.executeCollectionDeletion({ target: collection.target, rootDiagramIds: collection.rootDiagramIds, confirmationToken: collection.confirmationToken })).rejects.toMatchObject({ detail: { code: 'DELETE_IMPACT_CHANGED' } });
    expect((await service.previewDeletion({ selector: { id: other.id }, mode: 'trash' })).confirmationToken).toBe(unrelated.confirmationToken);
  });
});
