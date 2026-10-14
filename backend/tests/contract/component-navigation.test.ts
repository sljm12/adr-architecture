import type * as Domain from '../../../shared/src/index';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../../shared/src/index';

describe('Component navigation REST', () => {
  it('projects saved owner names across load/list/entry/recovery without writing child timestamps or layout', async () => {
    const repository = new DiagramRepository();
    for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture(), emptyComponentFixture('datastore')]) repository.create(d as DiagramDocument);
    const app = buildApp(repository), before = repository.get(ids.child)!;
    try {
      const parent = repository.get(ids.parent)!; parent.components[0] = { ...parent.components[0], name: 'Renamed application', containerType: 'datastore' };
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.parent}`, payload: parent })).statusCode).toBe(200);
      for (const url of [`/diagrams/${ids.child}`, `/diagrams/${ids.parent}/components/${ids.application}/component-diagram`]) {
        const response = (await app.inject(url)).json(); const child = response.diagram ?? response;
        expect(child).toMatchObject({ id: ids.child, name: 'Renamed application', kind: 'component', scope: { parentDiagramId: ids.parent, containerId: ids.application, containerType: 'datastore' }, createdAt: before.createdAt, updatedAt: before.updatedAt });
      }
      const rows = (await app.inject('/diagrams')).json(); expect(rows.find((d: Domain.DiagramDocument) => d.id === ids.child).name).toBe('Renamed application');
      expect(rows.find((d: Domain.DiagramDocument) => d.id === ids.datastoreChild).name).toBe(before.name);
      const opened = await app.inject({ method: 'POST', url: `/diagrams/${ids.parent}/components/${ids.application}/component-diagram` }); expect(opened.statusCode).toBe(200);
      expect(repository.get(ids.child)).toMatchObject({ createdAt: before.createdAt, updatedAt: before.updatedAt, components: before.components, relationships: before.relationships, boundary: before.boundary });
      const trash = await app.inject(`/diagrams/${ids.child}/trash-impact`); expect(trash.statusCode).toBe(200); expect(trash.json().affectedDiagrams[0].name).toBe('Renamed application');
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.child}` })).statusCode).toBe(204);
      expect((await app.inject('/diagrams/trash')).json().find((d: Domain.DiagramDocument) => d.id === ids.child)).toMatchObject({ name: 'Renamed application', kind: 'component', scope: { containerId: ids.application, parentDiagramId: ids.parent } });
      const impact = await app.inject(`/diagrams/${ids.child}/restore-impact`); expect(impact.json().affectedDiagrams[0].name).toBe('Renamed application');
      const restored = await app.inject({ method: 'POST', url: `/diagrams/${ids.child}/restore` }); expect(restored.statusCode).toBe(200);
      expect(restored.json()).toMatchObject({ id: ids.child, name: 'Renamed application', createdAt: before.createdAt, scope: { containerType: 'datastore' }, components: before.components, relationships: before.relationships, boundary: before.boundary });
    } finally { await app.close(); }
  });
  it('saves the same child repeatedly with authoritative naming, preserving ancestor documents and local references', async () => {
    const repository = new DiagramRepository(); for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture()]) repository.create(d as DiagramDocument);
    const app = buildApp(repository), ancestors = [repository.get(ids.context), repository.get(ids.parent)];
    try {
      let c = repository.get(ids.child)!; const created = c.createdAt; c.name = 'Forged independent title';
      for (let i = 0; i < 2; i++) { const saved = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: c }); expect(saved.statusCode).toBe(200); c = saved.json(); expect(c).toMatchObject({ id: ids.child, kind: 'component', name: componentParentFixture().components[0].name, createdAt: created, scope: { parentDiagramId: ids.parent, containerId: ids.application } }); }
      expect(c.components.map(x => x.id)).toEqual(populatedComponentFixture().components.map(x => x.id)); expect(c.relationships.map(({ updatedAt, ...r }) => r)).toEqual(populatedComponentFixture().relationships.map(({ updatedAt, ...r }) => r));
      expect([repository.get(ids.context), repository.get(ids.parent)]).toEqual(ancestors);
    } finally { await app.close(); }
  });
});
