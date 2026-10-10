import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { completeAdrPayload } from '../fixtures';
import { componentRecoveryFixture } from '../component-recovery-fixture';
import { componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';

describe('Component-local decision contracts', () => {
  it('keeps exact local links, counts, review and replacements through save/reopen without inheritance', async () => {
    const repository = componentRecoveryFixture(), app = buildApp(repository);
    try {
      const create = async (diagramId: string, title: string) => {
        const response = await app.inject({ method: 'POST', url: `/diagrams/${diagramId}/adrs`, payload: { ...completeAdrPayload, title } });
        expect(response.statusCode).toBe(201); return response.json();
      };
      await create(ids.parent, 'Parent decision');
      const adr = await create(ids.child, 'Local Component decision');
      const replacement = await create(ids.child, 'Replacement');
      expect((await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [ids.internal, ids.childPerson, ids.siblingOccurrence] } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [ids.relationship] } })).statusCode).toBe(200);
      for (const invalid of [ids.canonicalPerson, ids.personOccurrence, ids.application]) expect((await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [invalid] } })).statusCode).toBe(422);
      expect((await app.inject({ method: 'PATCH', url: `/adrs/${adr.id}`, payload: { ...completeAdrPayload, status: 'superseded' } })).statusCode).toBe(422);
      expect((await app.inject({ method: 'PATCH', url: `/adrs/${adr.id}`, payload: { ...completeAdrPayload, status: 'superseded', replacementAdrId: replacement.id } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'DELETE', url: `/adrs/${replacement.id}` })).statusCode).toBe(409);
      const before = (await app.inject(`/adrs/${adr.id}`)).json();
      const child = (await app.inject(`/diagrams/${ids.child}`)).json();
      child.components.find((c: any) => c.id === ids.internal).name = 'Renamed handler';
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: child })).statusCode).toBe(200);
      expect((await app.inject(`/adrs/${adr.id}`)).json()).toEqual(before);
      expect((await app.inject(`/diagrams/${ids.child}/adrs`)).json().map((a: any) => a.id).sort()).toEqual([adr.id, replacement.id].sort());
      expect((await app.inject(`/diagrams/${ids.child}/components/${ids.childPerson}/adrs`)).json()).toEqual([expect.objectContaining({ id: adr.id, status: 'superseded' })]);
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.child}/relationships/${ids.relationship}` })).statusCode).toBe(409);
    } finally { await app.close(); }
  });
});
