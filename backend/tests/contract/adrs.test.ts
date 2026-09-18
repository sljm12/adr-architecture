import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { completeAdrPayload } from '../fixtures';

describe('ADR API contract', () => {
  it('creates, lists, patches, and reopens an ADR with a stable identity', async () => {
    const app = buildApp(); await app.ready();
    const diagram = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } });
    const diagramId = diagram.json().id;
    const created = await app.inject({ method: 'POST', url: `/diagrams/${diagramId}/adrs`, payload: completeAdrPayload });
    expect(created.statusCode).toBe(201);
    const adr = created.json();
    expect(adr).toMatchObject({ diagramId, title: completeAdrPayload.title, status: 'draft', componentIds: [], createdAt: expect.any(String), updatedAt: expect.any(String) });
    const listed = await app.inject({ method: 'GET', url: `/diagrams/${diagramId}/adrs` });
    expect(listed.json()).toEqual([expect.objectContaining({ id: adr.id, title: adr.title, componentCount: 0 })]);
    const updated = await app.inject({ method: 'PATCH', url: `/adrs/${adr.id}`, payload: { ...completeAdrPayload, title: 'Use a payment boundary', status: 'accepted' } });
    expect(updated.statusCode).toBe(200); expect(updated.json()).toMatchObject({ id: adr.id, title: 'Use a payment boundary', status: 'accepted', createdAt: adr.createdAt });
    const reopened = await app.inject({ method: 'GET', url: `/adrs/${adr.id}` });
    expect(reopened.statusCode).toBe(200); expect(reopened.json()).toMatchObject({ id: adr.id, title: 'Use a payment boundary', status: 'accepted' });
    await app.close();
  });

  it('rejects incomplete writes with actionable fields and preserves no partial record', async () => {
    const app = buildApp(); await app.ready();
    const diagram = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } });
    const response = await app.inject({ method: 'POST', url: `/diagrams/${diagram.json().id}/adrs`, payload: { ...completeAdrPayload, title: '', context: '' } });
    expect(response.statusCode).toBe(422); expect(response.json().fields).toMatchObject({ title: expect.any(String), context: expect.any(String) });
    await app.close();
  });

  it('replaces links, permits unlinking, and rejects missing or cross-diagram components atomically', async () => {
    const app = buildApp(); await app.ready();
    const firstDiagram = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } });
    const secondDiagram = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Other' } });
    const first = firstDiagram.json(); const second = secondDiagram.json();
    const component = { id: '00000000-0000-0000-0000-000000000011', diagramId: first.id, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    const otherComponent = { ...component, id: '00000000-0000-0000-0000-000000000012', diagramId: second.id };
    await app.inject({ method: 'PUT', url: `/diagrams/${first.id}`, payload: { ...first, components: [component], relationships: [] } });
    await app.inject({ method: 'PUT', url: `/diagrams/${second.id}`, payload: { ...second, components: [otherComponent], relationships: [] } });
    const created = await app.inject({ method: 'POST', url: `/diagrams/${first.id}/adrs`, payload: completeAdrPayload });
    const adr = created.json();
    const linked = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [component.id] } });
    expect(linked.statusCode).toBe(200); expect(linked.json().componentIds).toEqual([component.id]);
    const invalid = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [otherComponent.id] } });
    expect(invalid.statusCode).toBe(422); expect(invalid.json().fields.componentIds).toContain('different diagram');
    const stillLinked = await app.inject({ method: 'GET', url: `/adrs/${adr.id}` });
    expect(stillLinked.json().componentIds).toEqual([component.id]);
    const missing = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: ['00000000-0000-0000-0000-000000000099'] } });
    expect(missing.statusCode).toBe(422); expect(missing.json().fields.componentIds).toContain('missing component');
    expect((await app.inject({ method: 'GET', url: `/adrs/${adr.id}` })).json().componentIds).toEqual([component.id]);
    const unlinked = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [] } });
    expect(unlinked.statusCode).toBe(200); expect(unlinked.json().componentIds).toEqual([]);
    await app.close();
  });

  it('returns linked component summaries, a valid empty array, and actionable 404s', async () => {
    const app = buildApp(); await app.ready();
    const diagramResponse = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } });
    const diagram = diagramResponse.json();
    const component = { id: '00000000-0000-0000-0000-000000000071', diagramId: diagram.id, name: 'API', description: null, type: 'service', position: { x: 0, y: 0 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    await app.inject({ method: 'PUT', url: `/diagrams/${diagram.id}`, payload: { ...diagram, components: [component], relationships: [] } });
    const adr = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload })).json();
    await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [component.id] } });

    const linked = await app.inject({ method: 'GET', url: `/diagrams/${diagram.id}/components/${component.id}/adrs` });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toEqual([expect.objectContaining({ id: adr.id, title: adr.title, status: adr.status, updatedAt: expect.any(String) })]);

    const emptyComponent = { ...component, id: '00000000-0000-0000-0000-000000000072', name: 'Database' };
    await app.inject({ method: 'PUT', url: `/diagrams/${diagram.id}`, payload: { ...diagram, components: [component, emptyComponent], relationships: [] } });
    const empty = await app.inject({ method: 'GET', url: `/diagrams/${diagram.id}/components/${emptyComponent.id}/adrs` });
    expect(empty.statusCode).toBe(200); expect(empty.json()).toEqual([]);

    const missing = await app.inject({ method: 'GET', url: `/diagrams/${diagram.id}/components/00000000-0000-0000-0000-000000000099/adrs` });
    expect(missing.statusCode).toBe(404);
    const missingDiagram = await app.inject({ method: 'GET', url: `/diagrams/00000000-0000-0000-0000-000000000099/components/${component.id}/adrs` });
    expect(missingDiagram.statusCode).toBe(404);
    await app.close();
  });

  it('replaces relationship links independently, returns relationship summaries, and rejects invalid links', async () => {
    const app = buildApp(); await app.ready();
    const first = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } })).json();
    const second = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Other' } })).json();
    const componentA = { id: '00000000-0000-0000-0000-000000000081', diagramId: first.id, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: first.createdAt, updatedAt: first.updatedAt };
    const componentB = { ...componentA, id: '00000000-0000-0000-0000-000000000082', name: 'Database' };
    const otherComponent = { ...componentA, id: '00000000-0000-0000-0000-000000000083', diagramId: second.id };
    const relationship = { id: '00000000-0000-0000-0000-000000000084', diagramId: first.id, sourceComponentId: componentA.id, targetComponentId: componentB.id, direction: 'directed' as const, label: 'sends', createdAt: first.createdAt, updatedAt: first.updatedAt };
    const otherRelationship = { ...relationship, id: '00000000-0000-0000-0000-000000000085', diagramId: second.id, sourceComponentId: otherComponent.id, targetComponentId: otherComponent.id };
    await app.inject({ method: 'PUT', url: `/diagrams/${first.id}`, payload: { ...first, components: [componentA, componentB], relationships: [relationship] } });
    await app.inject({ method: 'PUT', url: `/diagrams/${second.id}`, payload: { ...second, components: [otherComponent], relationships: [] } });
    const adr = (await app.inject({ method: 'POST', url: `/diagrams/${first.id}/adrs`, payload: completeAdrPayload })).json();

    const linked = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [relationship.id] } });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ relationshipIds: [relationship.id], componentIds: [] });
    const listed = await app.inject({ method: 'GET', url: `/diagrams/${first.id}/adrs` });
    expect(listed.json()).toEqual([expect.objectContaining({ id: adr.id, componentCount: 0, relationshipCount: 1 })]);

    const summary = await app.inject({ method: 'GET', url: `/diagrams/${first.id}/relationships/${relationship.id}/adrs` });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toEqual([expect.objectContaining({ id: adr.id, title: adr.title, status: adr.status })]);
    const invalid = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [otherRelationship.id] } });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().fields.relationshipIds).toContain('missing relationship');
    expect((await app.inject({ method: 'GET', url: `/adrs/${adr.id}` })).json().relationshipIds).toEqual([relationship.id]);
    const empty = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [] } });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().relationshipIds).toEqual([]);
    const emptySummary = await app.inject({ method: 'GET', url: `/diagrams/${first.id}/relationships/${relationship.id}/adrs` });
    expect(emptySummary.json()).toEqual([]);
    await app.close();
  });

  it('allows unrestricted lifecycle updates and keeps rejected/superseded records discoverable', async () => {
    const app = buildApp(); await app.ready();
    const diagram = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } })).json();
    const original = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload })).json();
    const replacement = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: { ...completeAdrPayload, title: 'Replacement decision', status: 'accepted' } })).json();

    for (const status of ['accepted', 'rejected'] as const) {
      const response = await app.inject({ method: 'PATCH', url: `/adrs/${original.id}`, payload: { ...completeAdrPayload, status, replacementAdrId: null } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: original.id, status });
    }
    const superseded = await app.inject({ method: 'PATCH', url: `/adrs/${original.id}`, payload: { ...completeAdrPayload, status: 'superseded', replacementAdrId: replacement.id } });
    expect(superseded.statusCode).toBe(200);
    expect(superseded.json()).toMatchObject({ id: original.id, status: 'superseded', replacementAdrId: replacement.id });
    const listed = await app.inject({ method: 'GET', url: `/diagrams/${diagram.id}/adrs` });
    expect(listed.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: original.id, status: 'superseded' }),
      expect.objectContaining({ id: replacement.id, status: 'accepted' }),
    ]));
    await app.close();
  });

  it('rejects superseded writes without a replacement and blocks then permits repaired deletion', async () => {
    const app = buildApp(); await app.ready();
    const diagram = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } })).json();
    const original = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload })).json();
    const replacement = (await app.inject({ method: 'POST', url: `/diagrams/${diagram.id}/adrs`, payload: completeAdrPayload })).json();
    const invalid = await app.inject({ method: 'PATCH', url: `/adrs/${original.id}`, payload: { ...completeAdrPayload, status: 'superseded', replacementAdrId: null } });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().fields.replacementAdrId).toContain('replacement');
    await app.inject({ method: 'PATCH', url: `/adrs/${original.id}`, payload: { ...completeAdrPayload, status: 'superseded', replacementAdrId: replacement.id } });
    const blocked = await app.inject({ method: 'DELETE', url: `/adrs/${replacement.id}` });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ blockers: [{ adrId: original.id, title: original.title }] });
    await app.inject({ method: 'PATCH', url: `/adrs/${original.id}`, payload: { ...completeAdrPayload, status: 'rejected', replacementAdrId: null } });
    const deleted = await app.inject({ method: 'DELETE', url: `/adrs/${replacement.id}` });
    expect(deleted.statusCode).toBe(204);
    await app.close();
  });
});
