import { randomUUID } from 'node:crypto';
import { cpus, platform } from 'node:os';
import { describe, expect, it } from 'vitest';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { DiagramService } from '../../src/services/diagram-service';
import { componentTestDatabase, postgresEnabled } from './component-test-database';

describe.skipIf(!postgresEnabled)('PostgreSQL confirmed deletion scale', () => {
  it('measures preview/committed execution p95 and searches beyond 100 diagrams without truncation', async () => {
    const database = await componentTestDatabase();
    try {
      const fixture = await diagramDeletionFixture();
      const subtree = fixture.before.documents.filter(d => d.id !== fixture.ids.unrelated)
        .map(d => ({ ...d, status: 'active' as const, trashedAt: null }));
      const root = subtree.find(d => d.id === fixture.ids.context)!;
      const componentCount = subtree.reduce((sum, d) => sum + d.components.length, 0);
      const relationshipCount = subtree.reduce((sum, d) => sum + d.relationships.length, 0);
      for (let i = componentCount; i < 1000; i++) root.components.push({
        ...root.components[0], id: randomUUID(), name: `Scale system ${i}`, position: { x: i * 200, y: 0 },
      });
      for (let i = relationshipCount; i < 1000; i++) root.relationships.push({
        ...root.relationships[0], id: randomUUID(), sourceComponentId: root.components[0].id,
        targetComponentId: root.components[1 + i % (root.components.length - 1)].id,
      });
      expect(subtree.reduce((sum, d) => sum + d.components.length, 0)).toBe(1000);
      expect(subtree.reduce((sum, d) => sum + d.relationships.length, 0)).toBe(1000);

      const seedSubtree = async () => {
        for (const document of subtree) await database.diagrams.create(document);
        for (let i = 0; i < 100; i++) {
          const adr = await database.adrs.create(root.id, {
            title: `Scale decision ${i}`, context: 'Saved architecture', decision: 'Keep stable identities',
            consequences: 'Explicit deletion scope', status: 'accepted', replacementAdrId: null,
            alternativesOrConstraints: null,
          });
          await database.adrs.replaceLinks(adr.id, [root.components[i % root.components.length].id]);
          await database.adrs.replaceRelationshipLinks(adr.id, [root.relationships[i].id]);
        }
      };
      await seedSubtree();
      const empty = fixture.before.documents.find(d => d.id === fixture.ids.unrelated)!;
      for (let i = 0; i < 96; i++) await database.diagrams.create({ ...empty, id: randomUUID(), name: `Unrelated ${i}` });
      expect(await database.diagrams.listAll()).toHaveLength(100);
      expect(await database.adrs.listFull(root.id)).toHaveLength(100);
      const service = new DiagramService(database.diagrams, database.adrs);
      const observations: Record<string, unknown> = {};
      for (const mode of ['trash', 'permanent'] as const) {
        const previewMs: number[] = [], executeMs: number[] = [];
        // Two warmups and 20 committed samples; restoration/reseeding is outside the timer.
        for (let sample = -2; sample < 20; sample++) {
          const start = performance.now();
          const preview = await service.previewDeletion({ selector: { name: root.name }, mode });
          const previewElapsed = performance.now() - start;
          expect(preview.affectedDiagrams.map(d => d.id).sort()).toEqual(subtree.map(d => d.id).sort());
          const executeStart = performance.now();
          const result = await service.executeDeletion(root.id, { mode, confirmationToken: preview.confirmationToken });
          const executeElapsed = performance.now() - executeStart;
          expect(result.affectedDiagrams).toEqual(preview.affectedDiagrams);
          expect(await database.diagrams.list()).toHaveLength(96);
          if (sample >= 0) { previewMs.push(previewElapsed); executeMs.push(executeElapsed); }
          if (mode === 'trash') {
            const impact = await service.restoreImpact(root.id);
            await service.restore(root.id, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId });
          } else await seedSubtree();
        }
        const p95 = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * .95) - 1];
        observations[mode] = { warmups: 2, samples: 20, previewMs, executeMs, previewP95Ms: p95(previewMs), executeP95Ms: p95(executeMs) };
      }
      // Exceed the measured collection size and place a duplicate after the original entries.
      const lateId = randomUUID();
      for (let i = 0; i < 5; i++) await database.diagrams.create({ ...empty, id: i === 4 ? lateId : randomUUID(), name: i === 4 ? 'Late exact target' : `Beyond fixture ${i}` });
      expect((await database.diagrams.listAll()).findIndex(d => d.id === lateId)).toBeGreaterThanOrEqual(100);
      expect((await service.previewDeletion({ selector: { name: 'Late exact target' }, mode: 'trash' })).rootDiagramId).toBe(lateId);
      await database.diagrams.create({ ...empty, id: randomUUID(), name: root.name });
      await expect(service.previewDeletion({ selector: { name: root.name }, mode: 'permanent' })).rejects.toMatchObject({
        detail: { code: 'DELETE_NAME_AMBIGUOUS', candidates: expect.arrayContaining([expect.objectContaining({ id: root.id })]) },
      });
      const version = await database.pool.query('SELECT version() AS version');
      console.info('Spec 012 PostgreSQL deletion scale:', JSON.stringify({
        environment: { node: process.version, platform: platform(), cpu: cpus()[0]?.model, postgres: version.rows[0].version },
        diagrams: 100, components: 1000, relationships: 1000, adrs: 100, budgetMs: 2000, observations,
      }));
      for (const measured of Object.values(observations) as Array<{ previewP95Ms: number; executeP95Ms: number }>) {
        expect(measured.previewP95Ms).toBeLessThan(2000);
        expect(measured.executeP95Ms).toBeLessThan(2000);
      }
    } finally { await database.close(); }
  }, 180_000);
});
