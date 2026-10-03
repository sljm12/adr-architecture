import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { completeAdrPayload } from '../fixtures';
import { generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';

describe('occurrence dependency contract', () => {
  it.each(['active', 'trashed'] as const)('protects %s occurrences and all their decisions on PUT and DELETE', async status => {
    const diagrams = new DiagramRepository(), adrs = new AdrRepository();
    diagrams.create(generalParentFixture() as any); diagrams.create(populatedChildFixture() as any);
    const adr = adrs.create(ids.populatedChild, completeAdrPayload);
    adrs.replaceLinks(adr.id, [ids.externalOccurrence]); adrs.replaceRelationshipLinks(adr.id, [ids.childRelationship]);
    if (status === 'trashed') diagrams.trash(ids.populatedChild);
    const before = diagrams.listAll(), decisions = adrs.get(adr.id);
    const app = buildApp(diagrams, adrs);
    try {
      const dependencies = await app.inject(`/diagrams/${ids.parentDiagram}/components/${ids.sourceSystem}/dependencies`);
      expect(dependencies.json().diagramBlockers).toEqual([expect.objectContaining({ componentId: ids.externalOccurrence, sourceComponentId: ids.sourceSystem, status })]);
      const incoming = diagrams.get(ids.parentDiagram)!;
      incoming.components.find(c => c.id === ids.sourceSystem)!.type = 'database';
      for (const response of [await app.inject({ method: 'PUT', url: `/diagrams/${ids.parentDiagram}`, payload: incoming }), await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parentDiagram}/components/${ids.sourceSystem}` })]) {
        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({ code: 'DIAGRAM_DEPENDENCY', diagramBlockers: [expect.objectContaining({ diagramId: ids.populatedChild, name: 'Payments', status, componentId: ids.externalOccurrence, sourceComponentId: ids.sourceSystem, nextAction: expect.stringMatching(/remove/i) })] });
      }
      expect(diagrams.listAll()).toEqual(before); expect(adrs.get(adr.id)).toEqual(decisions);
      incoming.components.find(c => c.id === ids.sourceSystem)!.type = 'person';
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.parentDiagram}`, payload: incoming })).statusCode).toBe(200);
      incoming.components.find(c => c.id === ids.owner)!.type = 'person';
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.parentDiagram}`, payload: incoming })).statusCode).toBe(409);
    } finally { await app.close(); }
  });
});
