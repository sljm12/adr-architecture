import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramDocument } from '../../shared/src/index';
import { calculateGroupBounds } from '../../shared/src/index';
import { useDiagramStore } from '../src/state/diagram-store';

const diagramId = '00000000-0000-0000-0000-000000000501';
const ids = {
  first: '00000000-0000-0000-0000-000000000502',
  second: '00000000-0000-0000-0000-000000000503',
  third: '00000000-0000-0000-0000-000000000504',
  person: '00000000-0000-0000-0000-000000000505',
  relationship: '00000000-0000-0000-0000-000000000506',
};
const timestamp = '2026-01-01T00:00:00.000Z';
const component = (id: string, name: string, type: string | null, x: number, y: number) => ({
  id,
  diagramId,
  name,
  description: null,
  type,
  position: { x, y },
  createdAt: timestamp,
  updatedAt: timestamp,
});
const document: DiagramDocument = {
  id: diagramId,
  name: 'System groups',
  status: 'active',
  createdAt: timestamp,
  updatedAt: timestamp,
  trashedAt: null,
  components: [
    component(ids.first, 'Billing', 'software-system', 100, 100),
    component(ids.second, 'Ledger', 'software-system', 360, 180),
    component(ids.third, 'Notifications', 'software-system', 620, 260),
    component(ids.person, 'Operator', 'person', 20, 20),
  ],
  relationships: [{
    id: ids.relationship,
    diagramId,
    sourceComponentId: ids.person,
    targetComponentId: ids.first,
    direction: 'directed',
    label: 'uses',
    createdAt: timestamp,
    updatedAt: timestamp,
  }],
  groups: [],
};

afterEach(() => useDiagramStore.getState().open(structuredClone(document)));

describe('system group diagram store', () => {
  it('rejects invalid selections and names without changing the document', () => {
    useDiagramStore.getState().open(structuredClone(document));
    expect(useDiagramStore.getState().createGroup(' ', [ids.first, ids.second])).toBe(false);
    expect(useDiagramStore.getState().createGroup('Finance', [ids.first, ids.person])).toBe(false);
    expect(useDiagramStore.getState().createGroup('Finance', [ids.first, ids.first])).toBe(false);
    expect(useDiagramStore.getState().document?.groups).toHaveLength(0);
    expect(useDiagramStore.getState().groupError).toMatch(/two|Software System|unique|name/i);
  });

  it('creates a padded boundary without rearranging member positions and enforces name uniqueness', () => {
    useDiagramStore.getState().open(structuredClone(document));
    const firstPosition = structuredClone(document.components[0].position);
    const secondPosition = structuredClone(document.components[1].position);
    expect(useDiagramStore.getState().createGroup(' Finance ', [ids.first, ids.second])).toBe(true);

    const group = useDiagramStore.getState().document!.groups[0];
    expect(group.name).toBe('Finance');
    expect(group.memberComponentIds).toEqual([ids.first, ids.second]);
    expect(group.position).toEqual(calculateGroupBounds([firstPosition, secondPosition]).position);
    expect(useDiagramStore.getState().document!.components[0].position).toEqual(firstPosition);
    expect(useDiagramStore.getState().document!.components[1].position).toEqual(secondPosition);
    expect(useDiagramStore.getState().createGroup('  finance ', [ids.third, ids.person])).toBe(false);
    expect(useDiagramStore.getState().document!.groups).toHaveLength(1);
  });

  it('moves groups by a shared delta, constrains members, removes membership explicitly, and preserves references', () => {
    useDiagramStore.getState().open(structuredClone(document));
    expect(useDiagramStore.getState().createGroup('Platform', [ids.first, ids.second, ids.third])).toBe(true);
    const created = useDiagramStore.getState().document!;
    const group = created.groups[0];
    const originalRelationship = structuredClone(created.relationships[0]);
    const delta = { x: 40, y: -15 };

    expect(useDiagramStore.getState().moveGroup(group.id, { x: group.position.x + delta.x, y: group.position.y + delta.y })).toBe(true);
    const moved = useDiagramStore.getState().document!;
    expect(moved.groups[0].position).toEqual({ x: group.position.x + delta.x, y: group.position.y + delta.y });
    expect(moved.components.find(item => item.id === ids.first)?.position).toEqual({ x: 140, y: 85 });
    expect(moved.components.find(item => item.id === ids.second)?.position).toEqual({ x: 400, y: 165 });
    expect(moved.relationships[0]).toEqual(originalRelationship);

    expect(useDiagramStore.getState().moveComponent(ids.first, { x: -1000, y: -1000 })).toBe(true);
    const constrained = useDiagramStore.getState().document!.components.find(item => item.id === ids.first)!;
    expect(constrained.position.x).toBeGreaterThanOrEqual(moved.groups[0].position.x + 32);
    expect(constrained.position.y).toBeGreaterThanOrEqual(moved.groups[0].position.y + 56);

    const memberPosition = structuredClone(constrained.position);
    expect(useDiagramStore.getState().removeGroupMember(group.id, ids.first)).toBe(true);
    expect(useDiagramStore.getState().document!.groups[0].memberComponentIds).not.toContain(ids.first);
    expect(useDiagramStore.getState().document!.components.find(item => item.id === ids.first)?.position).toEqual(memberPosition);
    expect(useDiagramStore.getState().document!.relationships[0]).toEqual(originalRelationship);
  });

  it('renames, ungroups, and supports bounded undo/redo while preserving identities', () => {
    useDiagramStore.getState().open(structuredClone(document));
    expect(useDiagramStore.getState().createGroup('Platform', [ids.first, ids.second])).toBe(true);
    const groupId = useDiagramStore.getState().document!.groups[0].id;
    expect(useDiagramStore.getState().renameGroup(groupId, '  Core Platform  ')).toBe(true);
    expect(useDiagramStore.getState().document!.groups[0].name).toBe('Core Platform');
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document!.groups[0].name).toBe('Platform');
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().document!.groups[0].name).toBe('Core Platform');

    const componentIds = useDiagramStore.getState().document!.components.map(item => item.id);
    expect(useDiagramStore.getState().ungroup(groupId)).toBe(true);
    expect(useDiagramStore.getState().document!.groups).toEqual([]);
    expect(useDiagramStore.getState().document!.components.map(item => item.id)).toEqual(componentIds);
  });
});
