import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('container diagram entry UI contract', () => {
  it('adds double-click activation while retaining click and Shift-selection behavior', () => {
    const canvas = source('../src/components/DiagramCanvas.tsx');
    expect(canvas).toContain('onNodeDoubleClick');
    expect(canvas).toContain('onNodeClick={onNodeClick}');
    expect(canvas).toContain('event.shiftKey');
    expect(canvas).toContain('onOpenContainerDiagram');
  });

  it('offers a native inspector action only for eligible system elements and external systems', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    expect(inspector).toContain('Create or open container diagram');
    expect(inspector).toContain('onOpenContainerDiagram');
    expect(inspector).toContain("selectedComponent.type === 'software-system'");
    expect(inspector).toContain("selectedComponent.role === 'external'");
    expect(inspector).toContain('type="button"');
  });

  it('renders an inert synthesized boundary and readable async retry feedback', () => {
    const adapter = source('../src/adapters/react-flow/diagram-adapter.ts');
    const workspace = source('../src/components/DiagramWorkspace.tsx');
    const canvas = source('../src/components/DiagramCanvas.tsx');
    const toolbar = source('../src/components/DiagramToolbar.tsx');
    expect(adapter).toContain('containerBoundary');
    expect(adapter).toContain('container-boundary-');
    expect(canvas).toContain('ContainerBoundaryNode');
    expect(canvas).toContain('onOpenContainerDiagram');
    expect(workspace).toContain('containerOpenStatus');
    expect(workspace).toContain('Retry');
    expect(toolbar).toContain('Container diagram');
  });
});
