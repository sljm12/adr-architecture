import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { completeAdrPayload } from '../fixtures';
import { componentRecoveryFixture } from '../component-recovery-fixture';
import { componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';

describe('component ADR dependencies', () => {
  it('reports both source hops, all recoverable occurrences, and blocks direct/PUT source or owner removal', async () => {
    const repository = componentRecoveryFixture(), app = buildApp(repository);
    try {
      await app.inject({ method: 'DELETE', url: `/diagrams/${ids.child}` });
      const dependencies = (await app.inject(`/diagrams/${ids.context}/components/${ids.canonicalPerson}/dependencies`)).json();
      expect(dependencies.diagramBlockers).toEqual(expect.arrayContaining([
        expect.objectContaining({ diagramId: ids.parent, componentId: ids.personOccurrence }),
        expect.objectContaining({ diagramId: ids.child, componentId: ids.childPerson, status: 'trashed' }),
      ]));
      for (const [diagramId, componentId] of [[ids.context, ids.canonicalPerson], [ids.parent, ids.personOccurrence], [ids.parent, ids.application]]) {
        const before = repository.get(diagramId)!;
        expect((await app.inject({ method: 'DELETE', url: `/diagrams/${diagramId}/components/${componentId}` })).json().code).toBe('DIAGRAM_DEPENDENCY');
        expect((await app.inject({ method: 'PUT', url: `/diagrams/${diagramId}`, payload: { ...before, components: before.components.filter(c => c.id !== componentId), relationships: before.relationships.filter(r => r.sourceComponentId !== componentId && r.targetComponentId !== componentId) } })).json().code).toBe('DIAGRAM_DEPENDENCY');
        expect(repository.get(diagramId)).toEqual(before);
      }
      const context = repository.get(ids.context)!;
      context.components.find(c => c.id === ids.canonicalPerson)!.type = 'database';
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.context}`, payload: context })).json().code).toBe('DIAGRAM_DEPENDENCY');
      const parent = repository.get(ids.parent)!;
      parent.components.find(c => c.id === ids.application)!.containerType = 'datastore';
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.parent}`, payload: parent })).statusCode).toBe(200);
    } finally { await app.close(); }
  });
  it('blocks deletion and returns the linked ADR IDs and titles', async () => {
    const app = buildApp(); await app.ready();
    const diagramResponse = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } });
    const diagram = diagramResponse.json();
    const component = { id: '00000000-0000-0000-0000-000000000021', diagramId: diagram.id, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: diagram.createdAt, updatedAt: diagram.updatedAt };
    await app.inject({ method: 'PUT', url: `/diagrams/${diagram.id}`, payload: { ...diagram, components: [component], relationships: [] } });
    const created = await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload });
    const adr = created.json();
    await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [component.id] } });
    const blocked = await app.inject({ method: 'DELETE', url: `/diagrams/${diagram.id}/components/${component.id}` });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ blockers: [{ adrId: adr.id, title: adr.title, reason: expect.stringContaining('linked') }] });
    const unchanged = await app.inject({ method: 'GET', url: `/diagrams/${diagram.id}` });
    expect(unchanged.json().components).toHaveLength(1);
    await app.close();
  });
});
