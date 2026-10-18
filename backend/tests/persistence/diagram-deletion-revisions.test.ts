import { describe, expect, it, vi } from 'vitest';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { scopedRepository } from '../html-export-source-fixtures';

describe('saved deletion revisions and memory rollback', () => {
  it('increments every diagram writer, including frozen-clock edit/revert, but not failed writes', async () => {
    const { repository: r, adrs, ids } = await diagramDeletionFixture();
    const service = new DiagramService(r, adrs);
    expect(await r.getDeletionRevision(ids.context)).toBe('0');
    const original = (await r.get(ids.context))!;
    vi.useFakeTimers(); vi.setSystemTime(new Date(original.updatedAt));
    try {
      await service.save(ids.context, { ...original, name: 'Changed' });
      await service.save(ids.context, original);
      expect(await r.getDeletionRevision(ids.context)).toBe('2');
      await expect(service.save(ids.context, { ...original, status: 'trashed' })).rejects.toThrow();
      expect(await r.getDeletionRevision(ids.context)).toBe('2');
    } finally { vi.useRealTimers(); }
    await service.removeRelationship(ids.context, original.relationships[0].id);
    await service.removeComponent(ids.context, original.components[1].id);
    expect(await r.getDeletionRevision(ids.context)).toBe('4');
    await service.trash(ids.context, (await service.trashImpact(ids.context)).affectedDiagramIds);
    expect(await r.getDeletionRevision(ids.context)).toBe('5');
    const impact = await service.restoreImpact(ids.context);
    await service.restore(ids.context, { confirmedDiagramIds: impact.affectedDiagramIds, confirmedTrashBatchId: impact.trashBatchId });
    expect(await r.getDeletionRevision(ids.context)).toBe('6');
  });
  it('increments all ADR mutations without changing document timestamps; failed links roll back', async () => {
    const { repository: r, adrs, ids } = await diagramDeletionFixture();
    const service = new AdrService(adrs, r); const before = (await r.get(ids.context))!;
    const payload = { title: 'Decision', context: 'Context', decision: 'Use it', consequences: 'Consequences', status: 'accepted' };
    const adr = await service.create(ids.context, payload);
    await service.update(adr.id, { ...payload, title: 'Updated' });
    await service.replaceLinks(adr.id, { componentIds: [before.components[0].id] });
    await service.replaceRelationshipLinks(adr.id, { relationshipIds: [before.relationships[0].id] });
    await expect(service.replaceLinks(adr.id, { componentIds: [ids.internal] })).rejects.toThrow();
    expect(await r.getDeletionRevision(ids.context)).toBe('4');
    await service.remove(adr.id);
    expect(await r.getDeletionRevision(ids.context)).toBe('5');
    expect((await r.get(ids.context))!.updatedAt).toBe(before.updatedAt);
  });
  it('keeps bigint precision and restores removed roots, descendants, new members and ADR indexes', async () => {
    const r = new DiagramRepository(); const a = new AdrRepository();
    const { ids, before } = await diagramDeletionFixture(r, a);
    // Deliberately simulate future purge without introducing a public purge operation in US1.
    const internals = r as unknown as { documents: Map<string, unknown>; provenance: Map<string, unknown>; revisions: Map<string, bigint> };
    internals.revisions.set(ids.context, 9007199254740993n);
    await r.incrementDeletionRevision(ids.context);
    expect(r.getDeletionRevision(ids.context)).toBe('9007199254740994');
    const snapshot = a.snapshotGraph();
    await expect(new GraphTransaction(r, a).run(ids.context, [], async ({ diagrams }) => {
      await diagrams.trash(ids.child);
      const added = { ...(await diagrams.get(ids.datastoreChild))!, id: crypto.randomUUID(), name: 'New', status: 'active' as const, trashedAt: null };
      internals.documents.delete(ids.datastoreChild);
      await diagrams.create(added); a.registerDiagram(added.id);
      internals.documents.delete(added.id);
      for (const id of [ids.child, ids.parent, ids.context]) { internals.documents.delete(id); internals.provenance.delete(id); internals.revisions.delete(id); }
      a.restoreGraphSnapshot({ diagramIds: [ids.context, ids.parent, ids.child, ids.datastoreChild, added.id], records: new Map(), diagrams: new Set(), components: new Map(), relationships: new Map(), componentLinkTimes: new Map(), relationshipLinkTimes: new Map() });
      throw new Error('Injected failure');
    })).rejects.toThrow('Injected failure');
    expect(r.getDeletionRevision(ids.context)).toBe('9007199254740994');
    const sorted = (documents: typeof before.documents) => documents.sort((a, b) => a.id.localeCompare(b.id));
    expect(sorted(await r.listAll())).toEqual(sorted(before.documents));
    expect(a.snapshotGraph()).toEqual(snapshot);
  });
  it('rolls back ADR writes if the owning revision increment fails', async () => {
    const { repository, adrs, ids } = await diagramDeletionFixture();
    const before = await adrs.listFull(ids.child);
    const failing = scopedRepository(repository, scoped => ({ incrementDeletionRevision: async id => { await scoped.incrementDeletionRevision(id); throw Error('Revision failure'); } }));
    await expect(new AdrService(adrs, failing).create(ids.child, { title:'Decision',context:'Context',decision:'Decision',consequences:'Consequences',status:'draft' })).rejects.toThrow('Revision failure');
    expect(await adrs.listFull(ids.child)).toEqual(before);
    expect(await repository.getDeletionRevision(ids.child)).toBe('0');
  });
});

describe.skipIf(!postgresEnabled)('PostgreSQL saved writer revisions', () => {
  it('covers every supported writer and failed-write rollback without Number conversion', async () => {
    const database = await componentTestDatabase();
    try {
      const { repository:r,adrs,ids } = await diagramDeletionFixture(database.diagrams,database.adrs);
      const diagrams = new DiagramService(r,adrs), decisions = new AdrService(adrs,r);
      const original = (await r.get(ids.context))!;
      expect(await r.getDeletionRevision(ids.context)).toBe('0');
      vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date(original.updatedAt));
      try { await diagrams.save(ids.context,{...original,name:'Changed'});await diagrams.save(ids.context,original); }
      finally { vi.useRealTimers(); }
      await expect(diagrams.save(ids.context,{...original,status:'trashed'})).rejects.toThrow();
      const payload={title:'Decision',context:'Context',decision:'Decision',consequences:'Consequences',status:'accepted'};
      const adr=await decisions.create(ids.context,payload);
      await decisions.update(adr.id,{...payload,title:'Updated'});
      await decisions.replaceLinks(adr.id,{componentIds:[original.components[0].id]});
      await decisions.replaceRelationshipLinks(adr.id,{relationshipIds:[original.relationships[0].id]});
      await expect(decisions.replaceLinks(adr.id,{componentIds:[ids.internal]})).rejects.toThrow();
      await decisions.remove(adr.id);
      await diagrams.removeRelationship(ids.context,original.relationships[0].id);
      await diagrams.removeComponent(ids.context,original.components[1].id);
      await diagrams.trash(ids.context,(await diagrams.trashImpact(ids.context)).affectedDiagramIds);
      const impact=await diagrams.restoreImpact(ids.context);
      await diagrams.restore(ids.context,{confirmedDiagramIds:impact.affectedDiagramIds,confirmedTrashBatchId:impact.trashBatchId});
      expect(await r.getDeletionRevision(ids.context)).toBe('11');
      const failing=scopedRepository(r,scoped=>({incrementDeletionRevision:async id=>{await scoped.incrementDeletionRevision(id);throw Error('Revision failure');}}));
      await expect(new AdrService(adrs,failing).create(ids.context,payload)).rejects.toThrow('Revision failure');
      expect(await r.getDeletionRevision(ids.context)).toBe('11');expect(await adrs.listFull(ids.context)).toEqual([]);
    } finally { vi.useRealTimers();await database.close(); }
  });
});
