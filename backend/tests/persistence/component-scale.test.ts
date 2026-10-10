import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';
import * as schema from '../../src/persistence/schema';
import { PostgresDiagramRepository } from '../../src/persistence/diagram-repository';
import { PostgresAdrRepository } from '../../src/persistence/adr-repository';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { ComponentContextService } from '../../src/services/component-context';
import { ContainerContextService } from '../../src/services/container-context';
import { HtmlExportSourceService } from '../../src/services/html-export-source';
import { DiagramService } from '../../src/services/diagram-service';
import { componentScaleFixture, sampledMedian } from '../../../shared/tests/component-scale-fixture';
import { componentTestDatabase, postgresEnabled } from './component-test-database';

describe.skipIf(!postgresEnabled)('Component scale in migrated PostgreSQL', () => {
  it('measures batch hydration and complete hierarchy capture, root-first locks and actual root contention', async () => {
    const database = await componentTestDatabase();
    const fixture = componentScaleFixture();
    const queries: Array<{ sql: string; first: unknown }> = [];
    const db = drizzle(database.pool, { schema, logger: { logQuery(sql, params) { queries.push({ sql, first: params[0] }); } } });
    const diagrams = new PostgresDiagramRepository(db), adrs = new PostgresAdrRepository(db);
    try {
      for (const d of fixture.documents) await diagrams.create(d);
      for (const a of fixture.adrs) {
        const saved = await adrs.create(a.diagramId, a);
        await adrs.replaceLinks(saved.id, a.componentIds); await adrs.replaceRelationshipLinks(saved.id, a.relationshipIds);
      }
      const observations: Record<string, unknown> = {};
      const diagramService = new DiagramService(diagrams, adrs);
      for (const document of [fixture.containers[0], fixture.components[0]]) {
        const service = document.kind === 'component' ? new ComponentContextService(diagrams) : new ContainerContextService(diagrams);
        observations[`${document.kind}.hydrate`] = await sampledMedian(() => service.hydrateAndValidateDocument(document, diagrams));
        queries.length = 0;
        const hydrated = await service.hydrateAndValidateDocument(document, diagrams);
        expect(hydrated.components.map(c => [c.id, c.sourceComponentId, c.position])).toEqual(document.components.map(c => [c.id, c.sourceComponentId, c.position]));
        observations[`${document.kind}.hydrateQueries`] = queries.length;
        // Query work depends on ancestor documents, not on 100 occurrence IDs.
        expect(queries.length).toBeLessThanOrEqual(document.kind === 'component' ? 12 : 6);
        const sourceIds = new Set(document.components.filter(c => c.role === 'external').map(c => c.sourceComponentId));
        expect(queries.filter(q => /where "components"\."id"/i.test(q.sql) && sourceIds.has(q.first as string))).toHaveLength(0);
        observations[`${document.kind}.load`] = await sampledMedian(() => diagramService.load(document.id));
        const open = () => document.kind === 'component'
          ? diagramService.createOrOpenComponentDiagram(document.scope!.parentDiagramId, fixture.containers[0].components[0].id)
          : diagramService.createOrOpenContainerDiagram(fixture.context.id, fixture.context.components[0].id);
        observations[`${document.kind}.idempotentOpen`] = await sampledMedian(open);
        queries.length = 0; await open(); observations[`${document.kind}.openQueries`] = queries.length;
        queries.length = 0; await diagramService.load(document.id); observations[`${document.kind}.loadQueries`] = queries.length;
      }
      const capture = new HtmlExportSourceService(diagrams, adrs);
      observations.hierarchyCapture = await sampledMedian(() => capture.gather(fixture.context.id));
      queries.length = 0;
      const source = await capture.gather(fixture.context.id);
      expect(source.diagrams).toHaveLength(10); expect(source.diagrams.flatMap(m => m.adrs)).toHaveLength(20);
      observations.hierarchyQueries = queries.length;
      const lockIds = queries.filter(q => /for update/i.test(q.sql)).map(q => q.first);
      expect(lockIds).toEqual([fixture.context.id, ...fixture.containers.map(d => d.id).sort(), ...fixture.components.map(d => d.id).sort()]);
      observations.lockIds = lockIds;
      const blocker = await database.pool.connect();
      let pending: Promise<unknown> | undefined, entered = false;
      try {
        await blocker.query('BEGIN'); await blocker.query('SELECT id FROM diagrams WHERE id=$1 FOR UPDATE', [fixture.context.id]);
        const start = performance.now();
        pending = new GraphTransaction(diagrams).run(fixture.components[0].id, [], () => { entered = true; });
        // Verify the database reports a waiter, rather than inferring blocking from elapsed time.
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await database.pool.query("SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%for update%'");
          if (result.rows[0].waiting > 0) break;
          if (attempt === 99) throw new Error('Root row lock waiter was not observed');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(entered).toBe(false);
        await blocker.query('SELECT id FROM diagrams WHERE id=$1 FOR UPDATE NOWAIT', [fixture.containers[0].id]);
        await blocker.query('SELECT id FROM diagrams WHERE id=$1 FOR UPDATE NOWAIT', [fixture.components[0].id]);
        await blocker.query('ROLLBACK'); await pending;
        observations.controlledRootWaitMs = performance.now() - start;
      } finally { await blocker.query('ROLLBACK'); blocker.release(); await pending; }
      // Roll back each created child so every creation sample has the same 10-member root.
      const rollback = new Error('scale creation sample rollback');
      for (const kind of ['container', 'component'] as const) {
        const parentId = kind === 'component' ? fixture.containers[0].id : fixture.context.id;
        const ownerId = kind === 'component' ? fixture.containers[0].components[2].id
          : fixture.context.components.find(c => c.type === 'software-system' && !fixture.containers.some(d => d.scope!.softwareSystemId === c.id))!.id;
        observations[`${kind}.createWithRollback`] = await sampledMedian(async () => {
          try {
            await new GraphTransaction(diagrams, adrs).run(parentId, [], async scoped => {
              const service = new DiagramService(scoped.diagrams, scoped.adrs);
              const result = kind === 'component' ? await service.createOrOpenComponentDiagram(parentId, ownerId) : await service.createOrOpenContainerDiagram(parentId, ownerId);
              expect(result.created).toBe(true); throw rollback;
            });
          } catch (error) { if (error !== rollback) throw error; }
        });
      }
      expect((await diagrams.findDescendants(fixture.context.id))).toHaveLength(9);
      console.info('Spec 010 PostgreSQL scale:', JSON.stringify(observations));
    } finally { await database.close(); }
  }, 120_000);
});
