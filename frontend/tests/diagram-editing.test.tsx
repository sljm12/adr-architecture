import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromReactFlow, toReactFlow } from '../src/adapters/react-flow/diagram-adapter';
import type { DiagramDocument } from '../../shared/src/index';
import { useDiagramStore } from '../src/state/diagram-store';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('diagram artifact editing contract', () => {
  it('exposes stable-ID editing actions and validation in the diagram store', () => {
    const store = source('../src/state/diagram-store.ts');
    expect(store).toContain('renameComponent');
    expect(store).toContain('updateRelationship');
    expect(store).toContain('reverseRelationship');
    expect(store).toContain('setRelationshipDirection');
    expect(store).toContain('name.trim()');
    expect(store).toContain('createdAt');
  });

  it('exposes accessible selected-artifact edit controls', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    expect(inspector).toContain('Edit component');
    expect(inspector).toContain('Save component');
    expect(inspector).toContain('Edit relationship');
    expect(inspector).toContain('relationship-edit-label');
    expect(inspector).toContain('relationship-edit-direction');
    expect(inspector).toContain('Reverse direction');
  });

  it('renders adapter values from domain data with stable node and edge IDs', () => {
    const adapter = source('../src/adapters/react-flow/diagram-adapter.ts');
    const canvas = source('../src/components/DiagramCanvas.tsx');
    expect(adapter).toContain('data:{label:c.name}');
    expect(adapter).toContain('source:relationship.sourceComponentId');
    expect(adapter).toContain('target:relationship.targetComponentId');
    expect(adapter).toContain('markerEnd:relationship.direction');
    expect(canvas).toContain('onNodeClick');
    expect(canvas).toContain('onEdgeClick');
  });

  it('retains resized dimensions in editable domain state and React Flow layout', () => {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const document: DiagramDocument = {
      id: '00000000-0000-0000-0000-000000000001', name: 'Resize', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
      components: [{ id: '00000000-0000-0000-0000-000000000002', diagramId: '00000000-0000-0000-0000-000000000001', name: 'API', description: null, type: 'software-system', position: { x: 20, y: 30 }, size: { width: 180, height: 72 }, createdAt: timestamp, updatedAt: timestamp }],
      relationships: [], groups: [],
    };
    useDiagramStore.getState().open(document);
    expect(useDiagramStore.getState().resizeComponent(document.components[0].id, { width: 280, height: 104 })).toBe(true);
    const resized = useDiagramStore.getState().document!;
    expect(resized.components[0].size).toEqual({ width: 280, height: 104 });
    expect(resized.components[0].id).toBe(document.components[0].id);
    const nodes = toReactFlow(resized).nodes;
    expect(nodes.find(node => node.id === document.components[0].id)?.style).toMatchObject({ width: 280, height: 104 });
    expect(fromReactFlow(resized, nodes).components[0].size).toEqual({ width: 280, height: 104 });
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document?.components[0].size).toEqual({ width: 180, height: 72 });
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().document?.components[0].size).toEqual({ width: 280, height: 104 });
  });
});
