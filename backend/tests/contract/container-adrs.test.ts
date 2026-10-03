import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { completeAdrPayload } from '../fixtures';
import { generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';

describe('container-local decisions', () => {
  it('links local artifacts, isolates parent decisions and enforces lifecycle, boundary and activity rules', async () => {
    const repository = new DiagramRepository(); repository.create(generalParentFixture() as any); repository.create(populatedChildFixture() as any);
    const app = buildApp(repository);
    try {
      const created = await app.inject({ method: 'POST', url: `/diagrams/${ids.populatedChild}/adrs`, payload: completeAdrPayload });
      expect(created.statusCode).toBe(201); const id = created.json().id;
      expect((await app.inject({ method: 'PUT', url: `/adrs/${id}/components`, payload: { componentIds: [ids.container, ids.externalOccurrence] } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'PUT', url: `/adrs/${id}/relationships`, payload: { relationshipIds: [ids.childRelationship] } })).statusCode).toBe(200);
      expect((await app.inject(`/diagrams/${ids.parentDiagram}/adrs`)).json()).toEqual([]);
      expect((await app.inject({ method: 'PUT', url: `/adrs/${id}/components`, payload: { componentIds: [ids.owner] } })).statusCode).toBe(422);
      expect((await app.inject({ method: 'PUT', url: `/adrs/${id}/components`, payload: { componentIds: [`boundary-${ids.populatedChild}`] } })).statusCode).toBe(422);
      expect((await app.inject({ method: 'PATCH', url: `/adrs/${id}`, payload: { ...completeAdrPayload, status: 'superseded' } })).statusCode).toBe(422);
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.populatedChild}/relationships/${ids.childRelationship}` })).statusCode).toBe(409);
      repository.trash(ids.parentDiagram);
      expect((await app.inject({ method: 'PATCH', url: `/adrs/${id}`, payload: completeAdrPayload })).json().code).toBe('PARENT_INACTIVE');
    } finally { await app.close(); }
  });
});
