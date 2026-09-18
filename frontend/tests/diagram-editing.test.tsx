import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
