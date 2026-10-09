import { describe, expect, it } from 'vitest';
import { componentContextFixture, componentParentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { deriveDiagramGroups, deriveDiagramLibraryDisplay } from '../src/state/diagram-list';
import type { DiagramDocument } from '../../shared/src/index';

describe('three-level diagram library', () => {
  const fixtures = () => [componentContextFixture(), componentParentFixture(), emptyComponentFixture() as DiagramDocument, emptyComponentFixture('datastore') as DiagramDocument];
  it('places matching Components under both nonmatching ancestors without counting context headings', () => {
    const diagrams = fixtures(), draft = structuredClone(diagrams[1]); draft.components[0].name = 'Unique draft name';
    const view = deriveDiagramGroups(deriveDiagramLibraryDisplay(diagrams, draft), { nameQuery: 'Unique draft' }, { field: 'name', direction: 'ascending' });
    expect(view.items.map(d => d.id)).toEqual([ids.child]); expect(view.groups).toHaveLength(1);
    expect(view.groups[0]).toMatchObject({ parentId: ids.context, parentMatches: false, branches: [{ parentId: ids.parent, parentMatches: false, children: [{ id: ids.child, name: 'Unique draft name' }] }] });
    expect(diagrams[2].name).not.toBe('Unique draft name');
  });
  it('propagates Context owner previews to descendant context and keeps same-name children separate', () => {
    const diagrams = fixtures(), draft = structuredClone(diagrams[0]); draft.components.find(c => c.id === ids.system)!.name = 'New system';
    const display = deriveDiagramLibraryDisplay(diagrams, draft);
    expect(display[2].scope).toMatchObject({ softwareSystemName: 'New system', parentDiagramName: 'New system' });
    const view = deriveDiagramGroups(display); expect(view.groups).toHaveLength(1);
    expect(view.groups[0].branches[0].children.map(d => d.id).sort()).toEqual([ids.child, ids.datastoreChild].sort());
  });
  it('uses scope identities for unavailable ancestor context instead of promoting a Component', () => {
    const c = emptyComponentFixture() as DiagramDocument; const view = deriveDiagramGroups([c]);
    expect(view.groups[0]).toMatchObject({ parentId: ids.context, parent: null, parentMatches: false, branches: [{ parentId: ids.parent, parent: null, children: [{ id: ids.child }] }] });
  });
});
