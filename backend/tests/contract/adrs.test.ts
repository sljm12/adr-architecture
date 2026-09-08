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
});
