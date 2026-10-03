import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app';
import { DiagramRepository } from '../src/persistence/diagram-repository';
import { generalParentFixture, populatedChildFixture, emptyChildFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';

describe('resolved persisted container export', () => {
  it('uses current sources and saved subtype and rejects empty and inactive graphs', async () => {
    const repository = new DiagramRepository(); repository.create(generalParentFixture() as any);
    const child = populatedChildFixture(); child.components[0].containerType = 'datastore'; repository.create(child as any);
    const app = buildApp(repository);
    try {
      const parent = repository.get(ids.parentDiagram)!; parent.components.find(c => c.id === ids.sourceSystem)!.name = 'Current Ledger'; repository.replace(parent);
      const output = await app.inject(`/diagrams/${ids.populatedChild}/export/mermaid`);
      expect(output.statusCode).toBe(200); expect(output.body).toContain('Datastore'); expect(output.body).toContain('Current Ledger');
      repository.trash(ids.parentDiagram);
      expect((await app.inject(`/diagrams/${ids.populatedChild}/export/mermaid`)).json().code).toBe('PARENT_INACTIVE');
    } finally { await app.close(); }
    const emptyRepository = new DiagramRepository(); emptyRepository.create(generalParentFixture() as any); emptyRepository.create(emptyChildFixture() as any);
    const emptyApp = buildApp(emptyRepository);
    try { const response = await emptyApp.inject(`/diagrams/${ids.emptyChild}/export/mermaid`); expect(response.statusCode).toBe(422); expect(response.json().code).toBe('EMPTY_CONTAINER_MERMAID'); } finally { await emptyApp.close(); }
  });
});
