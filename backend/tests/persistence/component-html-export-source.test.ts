import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { componentPackageInput } from '../../../shared/tests/component-package-input';
import { HtmlExportSourceService } from '../../src/services/html-export-source';
import { DiagramService } from '../../src/services/diagram-service';

describe.skipIf(!postgresEnabled)('Component PostgreSQL consistent export source', () => {
  let db: Awaited<ReturnType<typeof componentTestDatabase>>;
  beforeEach(async () => { db = await componentTestDatabase(); });
  afterEach(async () => { await db?.close(); });
  it('captures exact active descendants and local ADRs, hydrates omitted ancestors and remains detached', async () => {
    const { source, root, parent, child, sibling } = componentPackageInput();
    for (const member of source.diagrams) {
      await db.diagrams.create(member.diagram);
      for (const adr of member.adrs) { const saved = await db.adrs.create(member.diagram.id, adr); await db.adrs.replaceLinks(saved.id, adr.componentIds); await db.adrs.replaceRelationshipLinks(saved.id, adr.relationshipIds); }
    }
    const before = await db.pool.query('SELECT id, updated_at FROM diagrams ORDER BY id');
    const gather = new HtmlExportSourceService(db.diagrams, db.adrs);
    const context = await gather.gather(root.id); expect(context.diagrams).toHaveLength(4);
    expect((await gather.gather(parent.id)).diagrams).toHaveLength(3);
    const selected = await gather.gather(child.id); expect(selected.diagrams).toHaveLength(1);
    expect((selected as any).sourceContexts[child.id].scope).toMatchObject({ systemContextDiagramId: root.id, containerId: child.scope!.containerId });
    expect(selected.diagrams[0].adrs).toHaveLength(2); selected.diagrams[0].diagram.name = 'Mutated response';
    expect((await db.diagrams.get(child.id))!.name).toBe(child.name);
    expect((await db.pool.query('SELECT id, updated_at FROM diagrams ORDER BY id')).rows).toEqual(before.rows);
    await new DiagramService(db.diagrams, db.adrs).trash(sibling.id, [sibling.id]);
    expect((await gather.gather(root.id)).diagrams.map(m => m.diagram.id)).not.toContain(sibling.id);
  });
  it('serializes capture with root trash and never returns a mixed active hierarchy', async () => {
    const { source, root } = componentPackageInput(); for (const member of source.diagrams) await db.diagrams.create(member.diagram);
    const gather = new HtmlExportSourceService(db.diagrams, db.adrs), service = new DiagramService(db.diagrams, db.adrs);
    const ids = source.diagrams.map(m => m.diagram.id);
    const [result] = await Promise.allSettled([gather.gather(root.id), service.trash(root.id, ids)]);
    if (result.status === 'fulfilled') { expect(result.value.diagrams).toHaveLength(4); expect(result.value.diagrams.every(m => m.diagram.status === 'active')).toBe(true); }
    else expect(result.reason).toMatchObject({ statusCode: 404 });
  });
});
