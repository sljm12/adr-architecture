import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { diagramDocumentSchema, type DiagramDocument } from '../../../shared/src/index';
import { generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
function setup() {
  const repository = new DiagramRepository();
  const parent = diagramDocumentSchema.parse(generalParentFixture()) as DiagramDocument;
  const child = diagramDocumentSchema.parse({ ...populatedChildFixture(), name: 'Payment runtime' }) as DiagramDocument;
  repository.create(parent); repository.create(child);
  const app = buildApp(repository); apps.push(app);
  return { app, repository, parent, child };
}

describe('saved container navigation contract', () => {
  it('repeatedly PUTs the independently named child, retaining subtype, IDs, dates and parent content', async () => {
    const { app, repository, parent, child } = setup();
    const parentBefore = repository.get(parent.id);
    for (const containerType of ['datastore', 'application'] as const) {
      const response = await app.inject({ method: 'PUT', url: `/diagrams/${child.id}`, payload: { ...child, name: '  Payment runtime  ', components: child.components.map(c => c.role === 'container' ? { ...c, containerType } : c) } });
      expect(response.statusCode).toBe(200);
      const saved = response.json();
      expect(saved).toMatchObject({ id: child.id, name: 'Payment runtime', kind: 'container', createdAt: child.createdAt, scope: child.scope, boundary: child.boundary });
      expect(saved.components[0]).toMatchObject({ id: ids.container, containerType, createdAt: child.components[0].createdAt });
      expect((await app.inject(`/diagrams/${child.id}`)).json()).toEqual(saved);
      expect(repository.get(parent.id)).toEqual(parentBefore);
      const rows = (await app.inject('/diagrams')).json();
      expect(rows).toHaveLength(2);
      expect(rows.find((row: any) => row.id === child.id)).toMatchObject({ name: 'Payment runtime', kind: 'container', scope: child.scope });
      expect(rows.every((row: any) => !('components' in row))).toBe(true);
    }
  });

  it('resolves renamed parent, owner and eligible reclassified source without editing local child data', async () => {
    const { app, repository, parent, child } = setup();
    repository.replace({ ...parent, name: 'Current overview', components: parent.components.map(c => c.id === ids.owner ? { ...c, name: 'Current owner' } : c.id === ids.sourceSystem ? { ...c, name: 'Current source', description: null, type: 'person' } : c) });
    const resolved = (await app.inject(`/diagrams/${child.id}`)).json();
    expect(resolved).toMatchObject({ name: 'Payment runtime', scope: { parentDiagramName: 'Current overview', softwareSystemName: 'Current owner' }, boundary: child.boundary });
    expect(resolved.components[1]).toMatchObject({ id: ids.externalOccurrence, name: 'Current source', type: 'person', description: null, position: child.components[1].position, createdAt: child.components[1].createdAt });
    expect(resolved.updatedAt).toBe(child.updatedAt);
    for (const path of ['/diagrams', '/diagrams/trash']) {
      if (path.endsWith('trash')) repository.trash(child.id);
      const rows = (await app.inject(path)).json();
      expect(rows.find((row: any) => row.id === child.id)).toMatchObject({ name: child.name, kind: 'container', createdAt: child.createdAt, scope: { parentDiagramId: parent.id, parentDiagramName: 'Current overview', softwareSystemName: 'Current owner' } });
    }
  });

  it('keeps duplicate names under distinct parent and owner UUIDs', async () => {
    const { app, repository, parent, child } = setup();
    const otherParentId = crypto.randomUUID(), otherOwnerId = crypto.randomUUID();
    repository.create({ ...parent, id: otherParentId, components: [{ ...parent.components[0], id: otherOwnerId, diagramId: otherParentId }], relationships: [] });
    const other = await app.inject({ method: 'POST', url: `/diagrams/${otherParentId}/components/${otherOwnerId}/container-diagram` });
    const otherChild = { ...other.json(), name: child.name };
    expect((await app.inject({ method: 'PUT', url: `/diagrams/${otherChild.id}`, payload: otherChild })).statusCode).toBe(200);
    const rows = (await app.inject('/diagrams')).json().filter((row: any) => row.kind === 'container');
    expect(rows.map((row: any) => row.scope.parentDiagramId).sort()).toEqual([parent.id, otherParentId].sort());
    expect(new Set(rows.map((row: any) => row.id)).size).toBe(2);
    expect(rows.map((row: any) => row.name)).toEqual([child.name, child.name]);
  });

  it.each(['/diagrams', '/diagrams/trash'])('rejects broken ownership in %s rather than publishing a valid-looking summary', async path => {
    const { app, repository, parent, child } = setup();
    if (path.endsWith('trash')) repository.trash(child.id);
    // Deliberately bypass the service to simulate corrupt persisted legacy data.
    repository.replace({ ...parent, components: [], relationships: [] });
    const response = await app.inject(path);
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('DIAGRAM_REFERENCE_BROKEN');
    if (path === '/diagrams') expect((await app.inject(`/diagrams/${child.id}`)).statusCode).toBe(409);
  });
  it('rejects missing external sources on both GET and list with an occurrence-specific reference error', async () => {
    const { app, repository, parent, child } = setup();
    repository.replace({ ...parent, components: parent.components.filter(c => c.id !== ids.sourceSystem), relationships: [] });
    for (const path of [`/diagrams/${child.id}`, '/diagrams']) {
      const response = await app.inject(path); expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'DIAGRAM_REFERENCE_BROKEN', message: expect.stringContaining(ids.externalOccurrence) });
    }
  });
});
