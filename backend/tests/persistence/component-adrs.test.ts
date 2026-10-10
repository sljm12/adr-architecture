import { describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import { AdrService } from '../../src/services/adr-service';
import { DiagramService } from '../../src/services/diagram-service';
import { completeAdrPayload } from '../fixtures';
import type { DiagramDocument } from '../../../shared/src/index';

describe.skipIf(!postgresEnabled)('Component-local PostgreSQL decisions', () => {
  it('persists exact links/lifecycle/counts and preserves them across rename, movement, recovery and reopen', async () => {
    const db = await componentTestDatabase();
    try {
      for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture()]) await db.diagrams.create(d as DiagramDocument);
      const service = new AdrService(db.adrs, db.diagrams), diagrams = new DiagramService(db.diagrams, db.adrs);
      const parent = await service.create(ids.parent, completeAdrPayload);
      const adr = await service.create(ids.child, completeAdrPayload), replacement = await service.create(ids.child, { ...completeAdrPayload, title: 'Replacement' });
      await service.replaceLinks(adr.id, { componentIds: [ids.internal, ids.childPerson, ids.siblingOccurrence] });
      await service.replaceRelationshipLinks(adr.id, { relationshipIds: [ids.relationship] });
      await service.update(adr.id, { ...completeAdrPayload, status: 'superseded', replacementAdrId: replacement.id });
      const before = await service.load(adr.id);
      const child = await diagrams.load(ids.child); child.components[0].name = 'Renamed'; child.components[0].position.x += 10;
      await diagrams.save(ids.child, child);
      await diagrams.trash(ids.parent, [ids.parent, ids.child]);
      const impact = await diagrams.restoreImpact(ids.child);
      await diagrams.restore(ids.parent, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId });
      expect(await service.load(adr.id)).toEqual(before);
      expect((await service.list(ids.child)).map(a => a.id)).not.toContain(parent.id);
      expect(await service.componentSummaries(ids.child, ids.childPerson)).toEqual([expect.objectContaining({ id: adr.id, status: 'superseded' })]);
      expect(await service.relationshipSummaries(ids.child, ids.relationship)).toHaveLength(1);
      expect(await service.componentAdrCounts(ids.child)).toEqual(expect.arrayContaining([expect.objectContaining({ componentId: ids.internal, count: 1 })]));
      await expect(service.replaceLinks(adr.id, { componentIds: [ids.personOccurrence] })).rejects.toThrow();
      await expect(service.remove(replacement.id)).rejects.toThrow();
    } finally { await db.close(); }
  });
});
