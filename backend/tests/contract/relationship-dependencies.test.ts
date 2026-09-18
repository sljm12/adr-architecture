import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { completeAdrPayload } from '../fixtures';

describe('relationship ADR dependencies', () => {
  it('blocks deleting a relationship linked to an ADR', async () => {
    const app = buildApp(); await app.ready();
    const diagram = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } })).json();
    const componentA = { id: '00000000-0000-0000-0000-000000000091', diagramId: diagram.id, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: diagram.createdAt, updatedAt: diagram.updatedAt };
    const componentB = { ...componentA, id: '00000000-0000-0000-0000-000000000092', name: 'Database' };
    const relationship = { id: '00000000-0000-0000-0000-000000000093', diagramId: diagram.id, sourceComponentId: componentA.id, targetComponentId: componentB.id, direction: 'directed' as const, label: 'sends', createdAt: diagram.createdAt, updatedAt: diagram.updatedAt };
    await app.inject({ method: 'PUT', url: `/diagrams/${diagram.id}`, payload: { ...diagram, components: [componentA, componentB], relationships: [relationship] } });
    const adr = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload })).json();
    await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [relationship.id] } });
    const blocked = await app.inject({ method: 'DELETE', url: `/diagrams/${diagram.id}/relationships/${relationship.id}` });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ blockers: [{ adrId: adr.id, title: adr.title, reason: expect.stringContaining('relationship') }] });
    expect((await app.inject({ method: 'GET', url: `/diagrams/${diagram.id}` })).json().relationships).toHaveLength(1);
    await app.close();
  });

  it('blocks component deletion when a dependent relationship has ADR links', async () => {
    const app = buildApp(); await app.ready();
    const diagram = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } })).json();
    const componentA = { id: '00000000-0000-0000-0000-000000000094', diagramId: diagram.id, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: diagram.createdAt, updatedAt: diagram.updatedAt };
    const componentB = { ...componentA, id: '00000000-0000-0000-0000-000000000095', name: 'Database' };
    const relationship = { id: '00000000-0000-0000-0000-000000000096', diagramId: diagram.id, sourceComponentId: componentA.id, targetComponentId: componentB.id, direction: 'directed' as const, label: null, createdAt: diagram.createdAt, updatedAt: diagram.updatedAt };
    await app.inject({ method: 'PUT', url: `/diagrams/${diagram.id}`, payload: { ...diagram, components: [componentA, componentB], relationships: [relationship] } });
    const adr = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload })).json();
    await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [relationship.id] } });
    const blocked = await app.inject({ method: 'DELETE', url: `/diagrams/${diagram.id}/components/${componentA.id}` });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().blockers).toEqual([expect.objectContaining({ adrId: adr.id, title: adr.title })]);
    await app.close();
  });
});
