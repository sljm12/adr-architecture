import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from '../../shared/src/index';
import { calculateGroupBounds } from '../../shared/src/index';
import { fromReactFlow, toReactFlow } from '../src/adapters/react-flow/diagram-adapter';

const diagramId = '00000000-0000-0000-0000-000000000601';
const ids = { first: '00000000-0000-0000-0000-000000000602', second: '00000000-0000-0000-0000-000000000603', group: '00000000-0000-0000-0000-000000000604', relationship: '00000000-0000-0000-0000-000000000605' };
const timestamp = '2026-01-01T00:00:00.000Z';
const base: DiagramDocument = {
  id: diagramId,
  name: 'Flow groups',
  status: 'active',
  createdAt: timestamp,
  updatedAt: timestamp,
  trashedAt: null,
  components: [
    { id: ids.first, diagramId, name: 'Billing', description: null, type: 'software-system', position: { x: 120, y: 130 }, createdAt: timestamp, updatedAt: timestamp },
    { id: ids.second, diagramId, name: 'Ledger', description: null, type: 'software-system', position: { x: 360, y: 220 }, createdAt: timestamp, updatedAt: timestamp },
  ],
  relationships: [{ id: ids.relationship, diagramId, sourceComponentId: ids.first, targetComponentId: ids.second, direction: 'directed', label: 'syncs', createdAt: timestamp, updatedAt: timestamp }],
  groups: [{ id: ids.group, diagramId, name: 'Finance', memberComponentIds: [ids.first, ids.second], ...calculateGroupBounds([{ x: 120, y: 130 }, { x: 360, y: 220 }]), createdAt: timestamp, updatedAt: timestamp }],
};

describe('React Flow system group adapter', () => {
  it('emits parents before children with relative positions and bounded, non-connectable group nodes', () => {
    const visual = toReactFlow(base);
    expect(visual.nodes.map(node => node.id)).toEqual([ids.group, ids.first, ids.second]);
    const groupNode = visual.nodes[0];
    const firstNode = visual.nodes[1];
    expect(groupNode.type).toBe('systemGroup');
    expect(groupNode.className ?? '').not.toContain('system-group-node');
    expect(groupNode.connectable).toBe(false);
    expect(groupNode.zIndex).toBeLessThan(0);
    expect(firstNode.parentId).toBe(ids.group);
    expect(firstNode.position).toEqual({ x: 32, y: 56 });
    expect(firstNode.extent).toBe('parent');
    expect(firstNode.expandParent).toBe(true);
    expect(firstNode.data).toMatchObject({ type: 'software-system', groupId: ids.group });
  });

  it('preserves stable edge endpoints and converts group drag positions back to absolute domain positions', () => {
    const visual = toReactFlow(base);
    const movedGroup = { ...visual.nodes[0], position: { x: visual.nodes[0].position.x + 50, y: visual.nodes[0].position.y + 25 } };
    const roundTrip = fromReactFlow(base, [movedGroup, visual.nodes[1], visual.nodes[2]]);
    expect(roundTrip.groups[0].position).toEqual({ x: base.groups[0].position.x + 50, y: base.groups[0].position.y + 25 });
    expect(roundTrip.components[0].position).toEqual({ x: 170, y: 155 });
    expect(roundTrip.components[1].position).toEqual({ x: 410, y: 245 });
    expect(roundTrip.relationships[0]).toMatchObject({ id: ids.relationship, sourceComponentId: ids.first, targetComponentId: ids.second });
  });

  it('fits a dragged or resized child beyond the prior boundary without removing its parent', () => {
    const visual = toReactFlow(base);
    const child = { ...visual.nodes[1], position: { x: -1000, y: -1000 }, measured: { width: 260, height: 120 } };
    const roundTrip = fromReactFlow(base, [visual.nodes[0], child, visual.nodes[2]]);
    expect(roundTrip.groups[0].memberComponentIds).toContain(ids.first);
    expect(roundTrip.components[0].position).toEqual({ x: base.groups[0].position.x - 1000, y: base.groups[0].position.y - 1000 });
    expect(roundTrip.groups[0].position).toEqual({ x: -944, y: -982 });
    expect(roundTrip.groups[0].size).toEqual({ width: 1516, height: 1306 });
  });

  it('keeps an added member parented while preserving the absolute domain position on round-trip', () => {
    const candidateId = '00000000-0000-0000-0000-000000000606';
    const added: DiagramDocument = { ...base, components: [...base.components, { id: candidateId, diagramId, name: 'Notifications', description: null, type: 'software-system', position: { x: 620, y: 260 }, createdAt: timestamp, updatedAt: timestamp }], groups: [{ ...base.groups[0], memberComponentIds: [...base.groups[0].memberComponentIds, candidateId], ...calculateGroupBounds([{ x: 120, y: 130 }, { x: 360, y: 220 }, { x: 620, y: 260 }]) }] };
    const visual = toReactFlow(added);
    const candidate = visual.nodes.find(node => node.id === candidateId)!;
    expect(candidate.parentId).toBe(ids.group);
    expect(candidate.position).toEqual({ x: 620 - added.groups[0].position.x, y: 260 - added.groups[0].position.y });
    const roundTrip = fromReactFlow(added, visual.nodes);
    expect(roundTrip.components.find(component => component.id === candidateId)?.position).toEqual({ x: 620, y: 260 });
    expect(roundTrip.relationships[0]).toMatchObject({ id: ids.relationship, sourceComponentId: ids.first, targetComponentId: ids.second });
    expect(roundTrip.groups[0].memberComponentIds).toContain(candidateId);
  });
});
