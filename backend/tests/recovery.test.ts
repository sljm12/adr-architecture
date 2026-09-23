import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app';
import { AdrRepository } from '../src/persistence/adr-repository';
import { DiagramRepository } from '../src/persistence/diagram-repository';
import { DiagramService } from '../src/services/diagram-service';
import { completeAdrPayload } from './fixtures';
import type { DiagramDocument } from '../../shared/src/index';

const diagramId = '00000000-0000-4000-8000-000000000001';
const componentApiId = '00000000-0000-4000-8000-000000000002';
const componentDbId = '00000000-0000-4000-8000-000000000003';
const relationshipId = '00000000-0000-4000-8000-000000000004';
const duplicateDiagramId = '00000000-0000-4000-8000-000000000005';
const missingDiagramId = '00000000-0000-4000-8000-000000000006';
const timestamp = '2026-01-01T00:00:00.000Z';
const document: DiagramDocument = {
  id: diagramId, name: 'System', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
  components: [
    { id: componentApiId, diagramId, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, size: { width: 180, height: 72 }, createdAt: timestamp, updatedAt: timestamp },
    { id: componentDbId, diagramId, name: 'DB', description: null, type: null, position: { x: 1, y: 1 }, size: { width: 180, height: 72 }, createdAt: timestamp, updatedAt: timestamp },
  ],
  relationships: [{ id: relationshipId, diagramId, sourceComponentId: componentApiId, targetComponentId: componentDbId, direction: 'directed', label: null, createdAt: timestamp, updatedAt: timestamp }],
  groups: [],
};

describe('recovery service', () => {
  it('counts dependencies and rejects removal while relationships are attached', () => {
    const repository = new DiagramRepository(); repository.create(document); const service = new DiagramService(repository);
    expect(service.dependencyCount(diagramId, componentApiId)).toBe(1);
    expect(() => service.removeComponent(diagramId, componentApiId)).toThrow(/Remove the relationships first/);
    expect(repository.get(diagramId)?.components.map(component => component.id)).toEqual([componentApiId, componentDbId]);
  });

  it('removes an unconnected component without changing relationships', () => {
    const repository = new DiagramRepository(); repository.create({ ...document, components: [document.components[0]], relationships: [] }); const service = new DiagramService(repository);
    const result = service.removeComponent(diagramId, componentApiId);
    expect(result.relationshipCount).toBe(0); expect(result.document.components).toEqual([]); expect(result.document.relationships).toEqual([]);
  });

  it('reports missing diagrams and components', () => {
    const service = new DiagramService(new DiagramRepository());
    expect(() => service.dependencyCount(missingDiagramId, componentApiId)).toThrow(/Diagram not found/);
  });

  it('rechecks dependencies when a stale preflight is followed by removal', () => {
    const repository = new DiagramRepository(); repository.create({ ...document, relationships: [] }); const service = new DiagramService(repository);
    expect(service.dependencyCount(diagramId, componentApiId)).toBe(0); repository.replace(document);
    expect(() => service.removeComponent(diagramId, componentApiId)).toThrow(/1 dependent relationship/); expect(repository.get(diagramId)?.components).toHaveLength(2);
  });

  it('blocks deletion when an ADR links the component and leaves the diagram unchanged', () => {
    const repository = new DiagramRepository(); repository.create({ ...document, components: [document.components[0]], relationships: [] }); const adrs = new AdrRepository();
    const adr = adrs.create(diagramId, completeAdrPayload); adrs.replaceLinks(adr.id, [componentApiId]); const service = new DiagramService(repository, adrs);
    expect(() => service.removeComponent(diagramId, componentApiId)).toThrow(/linked to one or more ADRs/);
    expect(repository.get(diagramId)?.components.map(component => component.id)).toEqual([componentApiId]);
  });

  it('moves a diagram to trash and restores its stable content', () => {
    const repository = new DiagramRepository(); repository.create(document); const service = new DiagramService(repository); service.trash(diagramId);
    expect(repository.list()).toEqual([]); expect(repository.listTrash()[0].id).toBe(diagramId);
    const restored = service.restore(diagramId);
    expect(restored.status).toBe('active'); expect(restored.components[0].id).toBe(componentApiId); expect(restored.relationships[0].id).toBe(relationshipId);
  });

  it('preserves the original creation date through edit, trash, and restore', () => {
    const repository = new DiagramRepository(); repository.create(document); const service = new DiagramService(repository);
    const edited = repository.replace({ ...document, name: 'Renamed', createdAt: 'changed-by-client' });
    expect(edited?.createdAt).toBe(document.createdAt); service.trash(diagramId);
    expect(repository.listTrash()[0].createdAt).toBe(document.createdAt); expect(service.restore(diagramId).createdAt).toBe(document.createdAt);
  });

  it('returns createdAt in trash summaries and preserves it after restore', async () => {
    const repository = new DiagramRepository(); repository.create(document); const app = buildApp(repository); await app.ready();
    expect((await app.inject({ method: 'DELETE', url: `/diagrams/${diagramId}` })).statusCode).toBe(204);
    const trash = await app.inject({ method: 'GET', url: '/diagrams/trash' });
    expect(trash.json()).toEqual([expect.objectContaining({ id: diagramId, status: 'trashed', createdAt: document.createdAt })]);
    expect((await app.inject({ method: 'POST', url: `/diagrams/${diagramId}/restore` })).json()).toMatchObject({ id: diagramId, status: 'active', createdAt: document.createdAt });
    await app.close();
  });

  it('returns not found for a missing deletion target and leaves all active diagrams unchanged', async () => {
    const repository = new DiagramRepository(); repository.create(document); const app = buildApp(repository); await app.ready();
    const response = await app.inject({ method: 'DELETE', url: `/diagrams/${missingDiagramId}` });
    expect(response.statusCode).toBe(404); expect(repository.list().map(item => item.id)).toEqual([diagramId]); await app.close();
  });

  it('targets duplicate names by UUID and restores the complete document without changing identities', async () => {
    const repository = new DiagramRepository();
    const duplicate = { ...document, id: duplicateDiagramId, components: document.components.map(component => ({ ...component, diagramId: duplicateDiagramId })), relationships: document.relationships.map(relationship => ({ ...relationship, diagramId: duplicateDiagramId })) };
    repository.create(document); repository.create(duplicate); const app = buildApp(repository); await app.ready();
    expect((await app.inject({ method: 'DELETE', url: `/diagrams/${duplicateDiagramId}` })).statusCode).toBe(204);
    expect(repository.list().map(item => item.id)).toEqual([diagramId]);
    const restored = await app.inject({ method: 'POST', url: `/diagrams/${duplicateDiagramId}/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: duplicateDiagramId, createdAt: document.createdAt, components: expect.arrayContaining([expect.objectContaining({ id: componentApiId })]), relationships: expect.arrayContaining([expect.objectContaining({ id: relationshipId })]) });
    await app.close();
  });
});
