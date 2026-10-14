import type * as Domain from '../../../shared/src/index';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../../shared/src/index';

const setup = () => {
  const repository = new DiagramRepository();
  repository.create(componentContextFixture()); repository.create(componentParentFixture()); repository.create(populatedComponentFixture() as DiagramDocument);
  return { repository, app: buildApp(repository) };
};
describe('Component editing REST contract', () => {
  it('offers eligible sources without ancestor interactions and excludes owner/canonical duplicates', async () => {
    const { repository, app } = setup();
    try {
      const context = (await app.inject(`/diagrams/${ids.child}/component-context`)).json();
      expect(context.sources.map((s: Domain.Component) => s.id).sort()).toEqual([ids.datastore, ids.personOccurrence, ids.systemOccurrence].sort());
      expect(context.sources).toContainEqual(expect.objectContaining({ id: ids.personOccurrence, canonicalSourceComponentId: ids.canonicalPerson, sourceDiagramId: ids.context }));
      expect(context.sources).toContainEqual(expect.objectContaining({ id: ids.datastore, type: 'container', containerType: 'datastore', technology: 'PostgreSQL' }));
      const before = repository.get(ids.child)!;
      for (const sourceId of [ids.application, ids.canonicalPerson, ids.personOccurrence]) {
        const input = structuredClone(before); input.components.push({ ...input.components[2], id: crypto.randomUUID(), sourceComponentId: sourceId });
        const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: input });
        expect([409, 422]).toContain(response.statusCode); expect(repository.get(ids.child)).toEqual(before);
      }
    } finally { await app.close(); }
  });
  it.each(['name', 'description', 'technology'] as const)('rejects blank internal %s with actionable fields and no partial save', async field => {
    const { repository, app } = setup();
    try {
      const before = repository.get(ids.child)!; const input = structuredClone(before); (input.components[0] )[field] = ' ';
      const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: input });
      expect(response.statusCode).toBe(422); expect(Object.keys(response.json().fields).some(key => key.includes(field))).toBe(true); expect(repository.get(ids.child)).toEqual(before);
    } finally { await app.close(); }
  });
  it('rejects unsupported internals and invalid directed local interactions atomically', async () => {
    const { repository, app } = setup();
    try {
      const before = repository.get(ids.child)!;
      for (const change of [
        (d: Domain.DiagramDocument) => { d.components[0].type = 'container'; },
        (d: Domain.DiagramDocument) => { d.relationships[0].label = ' '; },
        (d: Domain.DiagramDocument) => { d.relationships[0].direction = 'undirected'; },
        (d: Domain.DiagramDocument) => { d.relationships[0].targetComponentId = ids.internal; },
        (d: Domain.DiagramDocument) => { d.relationships[0].sourceComponentId = ids.childPerson; },
        (d: Domain.DiagramDocument) => { d.relationships[0].targetComponentId = ids.canonicalPerson; },
      ]) {
        const input = structuredClone(before); change(input);
        const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: input });
        expect(response.statusCode).toBe(422); expect(response.json().fields).toBeDefined(); expect(repository.get(ids.child)).toEqual(before);
      }
    } finally { await app.close(); }
  });
  it('load, save and explicit context refresh resolve authoritative metadata while retaining local IDs/layout/interactions', async () => {
    const { repository, app } = setup();
    try {
      const before = repository.get(ids.child)!; const parentBefore = repository.get(ids.parent)!;
      const context = repository.get(ids.context)!; context.components.find(c => c.id === ids.canonicalPerson)!.name = 'Renamed customer'; repository.replace(context);
      const parent = repository.get(ids.parent)!; parent.components.find(c => c.id === ids.datastore)!.technology = 'SQLite'; repository.replace(parent);
      const loaded = (await app.inject(`/diagrams/${ids.child}`)).json();
      expect(loaded.components[2]).toMatchObject({ name: 'Renamed customer', id: ids.childPerson, sourceComponentId: ids.personOccurrence, position: before.components[2].position });
      expect(loaded.components[1].technology).toBe('SQLite'); expect(loaded.relationships).toEqual(before.relationships);
      expect(repository.get(ids.child)!.updatedAt).toBe(before.updatedAt); expect(repository.get(ids.child)!.components.map(c => ({ id: c.id, updatedAt: c.updatedAt, position: c.position }))).toEqual(before.components.map(c => ({ id: c.id, updatedAt: c.updatedAt, position: c.position })));
      const refreshed = (await app.inject(`/diagrams/${ids.child}/component-context`)).json(); expect(refreshed.sources.find((s: Domain.Component) => s.id === ids.personOccurrence).name).toBe('Renamed customer');
      loaded.components[1].name = 'Forged local name'; loaded.components[1].technology = 'Forged';
      const saved = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: loaded });
      expect(saved.statusCode).toBe(200); expect(saved.json().components[1].technology).toBe('SQLite'); expect(saved.json().components[1].name).not.toBe('Forged local name');
      expect(saved.json().relationships.map(({ updatedAt, ...relationship }: Domain.Relationship) => relationship)).toEqual(before.relationships.map(({ updatedAt, ...relationship }) => relationship)); expect(repository.get(ids.parent)!.relationships.map(({ updatedAt, ...relationship }) => relationship)).toEqual(parentBefore.relationships.map(({ updatedAt, ...relationship }) => relationship));
    } finally { await app.close(); }
  });
});
