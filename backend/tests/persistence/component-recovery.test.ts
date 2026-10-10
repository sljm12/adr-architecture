import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import { DiagramService } from '../../src/services/diagram-service';
import type { DiagramDocument } from '../../../shared/src/index';

describe.skipIf(!postgresEnabled)('Component PostgreSQL exact recovery', () => {
  it('preserves independent batches and rolls all staged statuses back after final child validation fails', async () => {
    const db = await componentTestDatabase();
    try {
      for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture(), emptyComponentFixture('datastore')]) await db.diagrams.create(d as DiagramDocument);
      const service = new DiagramService(db.diagrams, db.adrs);
      await service.trash(ids.datastoreChild);
      const independent = await db.diagrams.getTrashProvenance(ids.datastoreChild);
      await service.trash(ids.context, [ids.context, ids.parent, ids.child]);
      const impact = await service.restoreImpact(ids.datastoreChild);
      expect(impact).toMatchObject({ restoreRootDiagramId: ids.context, requestedDiagramIncluded: false });
      const body = { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId };
      const before = await db.diagrams.listAll();
      // SQL allows this existing legacy type; locked service validation must reject the broken source graph.
      await db.pool.query("UPDATE components SET type='database' WHERE id=$1", [ids.canonicalPerson]);
      await expect(service.restore(ids.context, body)).rejects.toThrow();
      for (const d of before) expect((await db.diagrams.get(d.id))?.status).toBe(d.status);
      expect(await db.diagrams.getTrashProvenance(ids.child)).toMatchObject({ trashBatchId: body.confirmedTrashBatchId });
      await db.pool.query("UPDATE components SET type='person' WHERE id=$1", [ids.canonicalPerson]);
      await service.restore(ids.context, body);
      expect((await db.diagrams.get(ids.child))?.status).toBe('active');
      expect(await db.diagrams.getTrashProvenance(ids.datastoreChild)).toEqual(independent);
      await service.restore(ids.datastoreChild);
      expect((await db.diagrams.get(ids.child))?.components.map(c => c.id)).toEqual(populatedComponentFixture().components.map(c => c.id));
    } finally { await db.close(); }
  });
});
