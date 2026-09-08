import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { completeAdrPayload } from '../fixtures';

describe('component ADR dependencies', () => {
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
