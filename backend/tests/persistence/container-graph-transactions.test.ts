import { describe, expect, it } from 'vitest';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { GraphTransaction } from '../../src/persistence/graph-transaction';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { generalParentFixture, emptyChildFixture, populatedChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';

describe('memory graph transactions', () => {
  it('rolls diagram and ADR mutations back together when a graph write fails', async () => {
    const diagrams = new DiagramRepository();
    const adrs = new AdrRepository();
    diagrams.create(generalParentFixture() as any);
    adrs.registerDiagram(ids.parentDiagram);
    const graph = new GraphTransaction(diagrams, adrs);
    const child = emptyChildFixture() as any;

    await expect(graph.run(ids.parentDiagram, [], async ({ diagrams: transactionDiagrams, adrs: transactionAdrs }) => {
      transactionDiagrams.create(child);
      transactionAdrs!.registerDiagram(child.id);
      throw new Error('abort graph change');
    })).rejects.toThrow('abort graph change');

    expect(diagrams.get(child.id)).toBeUndefined();
    expect(adrs.list(child.id)).toEqual([]);
  });

  it('serializes competing graph mutations on the parent before taking child work', async () => {
    const diagrams = new DiagramRepository();
    diagrams.create(generalParentFixture() as any);
    const graph = new GraphTransaction(diagrams);
    const events: string[] = [];
    let releaseFirst!: () => void;
    const blocked = new Promise<void>(resolve => { releaseFirst = resolve; });
    const first = graph.run(ids.parentDiagram, [], async () => { events.push('first-start'); await blocked; events.push('first-end'); });
    const second = graph.run(ids.parentDiagram, [], async () => { events.push('second-start'); });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(events).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('round-trips feature fields and resolves current parent/source labels without changing local layout', () => {
    const diagrams = new DiagramRepository();
    const parent = generalParentFixture() as any;
    const child = populatedChildFixture() as any;
    diagrams.create(parent);
    diagrams.create(child);
    const before = diagrams.get(child.id)! as any;
    expect(before).toMatchObject({ kind:'container', scope:{ parentDiagramId:parent.id, softwareSystemId:ids.owner }, boundary:child.boundary });
    expect(before.relationships[0].protocol).toBe('HTTPS');
    expect(before.components[1]).toMatchObject({ role:'external', sourceComponentId:ids.sourceSystem, name:'Ledger' });

    const renamedParent = { ...parent, name:'Payments platform', components:parent.components.map((component:any) => component.id === ids.owner
      ? { ...component, name:'Payments Core', description:'Updated owner summary' }
      : component.id === ids.sourceSystem ? { ...component, name:'Ledger v2', description:'Updated ledger summary' } : component) };
    diagrams.replace(renamedParent);
    const after = diagrams.get(child.id)! as any;
    expect(after.scope).toMatchObject({ parentDiagramName:'Payments platform', softwareSystemName:'Payments Core', softwareSystemDescription:'Updated owner summary' });
    expect(after.components[1]).toMatchObject({ name:'Ledger v2', description:'Updated ledger summary', sourceComponentId:ids.sourceSystem, position:before.components[1].position });
    expect(after.createdAt).toBe(child.createdAt);
    expect(after.components[1].id).toBe(before.components[1].id);
  });
});
