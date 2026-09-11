import { describe, expect, it } from 'vitest';
import {
  assertDiagramInvariants,
  calculateGroupBounds,
  componentWriteSchema,
  constrainMemberPosition,
  diagramDocumentSchema,
  getRelativeMemberPosition,
  type DiagramDocument,
  type SystemGroup,
} from '../src/index';

const ids = {
  diagram: '00000000-0000-0000-0000-000000000101',
  person: '00000000-0000-0000-0000-000000000102',
  first: '00000000-0000-0000-0000-000000000103',
  second: '00000000-0000-0000-0000-000000000104',
  group: '00000000-0000-0000-0000-000000000105',
  otherGroup: '00000000-0000-0000-0000-000000000106',
  relationship: '00000000-0000-0000-0000-000000000107',
};
const timestamp = '2026-01-01T00:00:00.000Z';
const component = (id: string, name: string, type: string | null, x: number, y: number, diagramId = ids.diagram) => ({ id, diagramId, name, description: null, type, position: { x, y }, createdAt: timestamp, updatedAt: timestamp });
const base: DiagramDocument = {
  id: ids.diagram, name: 'System context', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
  components: [component(ids.first, 'Billing', 'software-system', 100, 100), component(ids.second, 'Ledger', 'software-system', 340, 180), component(ids.person, 'Operator', 'person', 10, 20)],
  relationships: [{ id: ids.relationship, diagramId: ids.diagram, sourceComponentId: ids.person, targetComponentId: ids.first, direction: 'directed', label: 'uses', createdAt: timestamp, updatedAt: timestamp }],
  groups: [],
};
const grouped = (): SystemGroup => {
  const layout = calculateGroupBounds(base.components.slice(0, 2).map(item => item.position));
  return { id: ids.group, diagramId: ids.diagram, name: ' Finance ', memberComponentIds: [ids.first, ids.second], ...layout, createdAt: timestamp, updatedAt: timestamp };
};

describe('C4 artifact and system group boundaries', () => {
  it('accepts supported C4 writes and keeps legacy unclassified documents readable', () => {
    expect(componentWriteSchema.safeParse({ ...base.components[0], type: 'person' }).success).toBe(true);
    expect(componentWriteSchema.safeParse({ ...base.components[0], type: null }).success).toBe(false);
    expect(diagramDocumentSchema.safeParse({ ...base, components: base.components.map(item => item.id === ids.first ? { ...item, type: null } : item) }).success).toBe(true);
  });

  it('rejects duplicate group names, invalid membership, and non-nesting', () => {
    const first = grouped();
    expect(() => assertDiagramInvariants({ ...base, groups: [first, { ...first, id: ids.otherGroup, name: 'finance' } as SystemGroup] })).toThrow(/duplicates/i);
    expect(() => assertDiagramInvariants({ ...base, groups: [{ ...first, memberComponentIds: [ids.first] }] })).toThrow(/at least two/i);
    expect(() => assertDiagramInvariants({ ...base, groups: [{ ...first, memberComponentIds: [ids.first, ids.person] }] })).toThrow(/Software System/i);
    expect(() => assertDiagramInvariants({ ...base, groups: [{ ...first, memberComponentIds: [ids.first, ids.second] }, { ...first, id: ids.otherGroup, name: 'Operations', memberComponentIds: [ids.first, ids.second] }] })).toThrow(/more than one group/i);
    expect(() => assertDiagramInvariants({ ...base, groups: [{ ...first, memberComponentIds: [ids.otherGroup, ids.second] }] })).toThrow(/missing|another group/i);
  });

  it('fits a boundary around existing positions and constrains member layout', () => {
    const group = grouped();
    expect(group.position).toEqual({ x: 68, y: 44 });
    expect(() => assertDiagramInvariants({ ...base, groups: [group] })).not.toThrow();
    expect(getRelativeMemberPosition({ x: 100, y: 100 }, group.position)).toEqual({ x: 32, y: 56 });
    expect(constrainMemberPosition(group, { x: -1000, y: 1000 })).toEqual({ x: 100, y: 180 });
    expect(base.components[0].position).toEqual({ x: 100, y: 100 });
    expect(base.relationships[0].sourceComponentId).toBe(ids.person);
  });

  it('rejects cross-diagram members and invalid positive layouts without changing references', () => {
    const group = grouped();
    expect(() => assertDiagramInvariants({ ...base, groups: [{ ...group, diagramId: ids.otherGroup }] })).toThrow(/belong to diagram/i);
    expect(() => assertDiagramInvariants({ ...base, groups: [{ ...group, size: { width: 0, height: group.size.height } }] })).toThrow(/positive finite/i);
    expect(() => assertDiagramInvariants({ ...base, components: base.components.map(item => item.id === ids.first ? { ...item, diagramId: ids.otherGroup } : item), groups: [group] })).toThrow(/belong to diagram/i);
    expect(base.relationships[0].id).toBe(ids.relationship);
  });
});
