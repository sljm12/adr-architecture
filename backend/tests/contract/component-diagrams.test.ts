import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../../shared/src/index';

const apps: ReturnType<typeof buildApp>[] = [];
function setup(...children: DiagramDocument[]) {
  const repository = new DiagramRepository();
  [componentContextFixture(), componentParentFixture(), ...children].forEach(d => repository.create(d));
  const app = buildApp(repository); apps.push(app);
  return { app, repository };
}
const path = (owner = ids.application as string, parent = ids.parent as string) => `/diagrams/${parent}/components/${owner}/component-diagram`;
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe('Component entry REST contract', () => {
  it.each([ids.application, ids.datastore])('creates and reopens one empty child for owner %s', async owner => {
    const { app, repository } = setup();
    const before = repository.listAll();
    expect((await app.inject({ method: 'GET', url: path(owner) })).json()).toEqual({ parentDiagramId: ids.parent, containerId: owner, availability: 'none', diagram: null });
    expect(repository.listAll()).toEqual(before);
    const created = await app.inject({ method: 'POST', url: path(owner) });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ kind: 'component', name: 'Payment API', components: [], relationships: [], groups: [], boundary: { position: { x: 0, y: 0 }, size: { width: 480, height: 320 } }, scope: { parentDiagramId: ids.parent, containerId: owner, systemContextDiagramId: ids.context, softwareSystemId: ids.system, containerType: owner === ids.application ? 'application' : 'datastore' } });
    const repeated = await app.inject({ method: 'POST', url: path(owner) });
    expect(repeated.statusCode).toBe(200); expect(repeated.json().id).toBe(created.json().id);
    expect((await app.inject({ method: 'GET', url: path(owner) })).json()).toMatchObject({ availability: 'active', diagram: { id: created.json().id, kind: 'component', scope: { containerId: owner } } });
    expect(repository.get(ids.context)).toEqual(before.find(d => d.id === ids.context));
    expect(repository.get(ids.parent)).toEqual(before.find(d => d.id === ids.parent));
    const context = await app.inject({ method: 'GET', url: `/diagrams/${created.json().id}/component-context` });
    expect(context.statusCode).toBe(200);
    expect(context.json().sources).toContainEqual(expect.objectContaining({ id: ids.personOccurrence, canonicalSourceComponentId: ids.canonicalPerson, sourceDiagramId: ids.context }));
  });
  it('uses the canonical sibling owner from a supporting container', async () => {
    const { app } = setup(populatedComponentFixture() as DiagramDocument);
    const first = await app.inject({ method: 'POST', url: path(ids.siblingOccurrence, ids.child) });
    expect(first.statusCode).toBe(201);
    expect(first.json().scope).toMatchObject({ parentDiagramId: ids.parent, containerId: ids.datastore });
    const direct = await app.inject({ method: 'POST', url: path(ids.datastore) });
    expect(direct.statusCode).toBe(200); expect(direct.json().id).toBe(first.json().id);
    const system = await app.inject({ method: 'POST', url: `/diagrams/${ids.child}/components/${ids.childSystem}/container-diagram` });
    expect(system.statusCode).toBe(201);
    expect(system.json().scope).toMatchObject({ parentDiagramId: ids.context, softwareSystemId: ids.canonicalSystem });
  });
  it('rejects people, systems, internals, boundaries and mismatched owners', async () => {
    const { app } = setup(populatedComponentFixture() as DiagramDocument);
    for (const [owner, parent] of [[ids.personOccurrence, ids.parent], [ids.systemOccurrence, ids.parent], [ids.internal, ids.child], [ids.system, ids.context]]) {
      expect((await app.inject({ method: 'POST', url: path(owner, parent) })).statusCode).toBe(422);
    }
    expect((await app.inject({ method: 'GET', url: path(ids.application, ids.child) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: path(ids.child, ids.child) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${ids.parent}/component-context` })).statusCode).toBe(422);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${ids.internal}/component-context` })).statusCode).toBe(404);
  });
  it('identifies recoverable children and blocks inactive ancestors and broken supporting sources', async () => {
    const child = { ...emptyComponentFixture(), status: 'trashed', trashedAt: new Date().toISOString() } as DiagramDocument;
    const { app, repository } = setup(child);
    expect((await app.inject({ method: 'GET', url: path() })).json()).toMatchObject({ availability: 'trashed', diagram: { id: ids.child } });
    const restore = await app.inject({ method: 'POST', url: path() });
    expect(restore.statusCode).toBe(409); expect(restore.json()).toMatchObject({ code: 'RESTORE_REQUIRED', diagram: { id: ids.child } });
    await repository.trash(ids.context);
    expect((await app.inject({ method: 'POST', url: path() })).json()).toMatchObject({ code: 'PARENT_INACTIVE' });
    await repository.restore(ids.context);
    const populated = populatedComponentFixture();
    repository.create({ ...emptyComponentFixture('datastore'), components: populated.components.filter(c => c.id === ids.internal || c.id === ids.childPerson).map(c => ({ ...c, diagramId: ids.datastoreChild })), relationships: [] } as DiagramDocument);
    const broken = repository.get(ids.datastoreChild)!;
    await repository.replace({ ...broken, components: broken.components.map(c => c.id === ids.childPerson ? { ...c, description: 'Supporting responsibility', type: 'container', containerType: 'application', technology: 'TS', sourceComponentId: ids.internal } : c) });
    const response = await app.inject({ method: 'POST', url: path(ids.childPerson, ids.datastoreChild) });
    expect(response.statusCode).toBe(409); expect(response.json()).toMatchObject({ code: 'DIAGRAM_REFERENCE_BROKEN' });
  });
});
