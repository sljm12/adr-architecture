import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('system group UI accessibility contract', () => {
  it('supports keyboard multi-selection and distinct group selection on the canvas', () => {
    const canvas = source('../src/components/DiagramCanvas.tsx');
    const component = source('../src/components/ComponentNode.tsx');
    const workspace = source('../src/components/DiagramWorkspace.tsx');
    expect(canvas).toContain('selectionOnDrag');
    expect(canvas).toContain('multiSelectionKeyCode');
    expect(canvas).toContain('onSelectionChange={handleSelectionChange}');
    expect(canvas).toContain('onMultiSelectionChange?.(componentIds)');
    expect(canvas).toContain('onMultiSelectionChange?.([])');
    expect(canvas).toContain("kind: 'group'");
    expect(canvas).toContain('constrainMemberPosition');
    expect(component).toContain('component-selection-state');
    expect(component).toContain('is-selected');
    expect(workspace).toContain('groupingSelectionActive');
    expect(workspace).toContain('clearCanvasSelection');
  });

  it('exposes group creation feedback and member actions with confirmation semantics', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    const toolbar = source('../src/components/DiagramToolbar.tsx');
    const groupNode = source('../src/components/SystemGroupNode.tsx');
    expect(toolbar).toContain('Group selected systems');
    expect(toolbar).toContain('disabled');
    expect(inspector).toContain('Group selected systems');
    expect(inspector).toContain('Remove from group');
    expect(inspector).toContain('Ungroup');
    expect(inspector).toContain('ConfirmDialog');
    expect(inspector).toContain('groupError');
    expect(groupNode).toContain('aria-label');
    expect(groupNode).toContain('System group');
  });

  it('keeps labels, focus targets, and actionable validation visible', () => {
    const styles = source('../src/styles.css');
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    const toolbar = source('../src/components/DiagramToolbar.tsx');
    const store = source('../src/state/diagram-store.ts');
    expect(styles).toContain('.system-group-node');
    expect(styles).toContain('group-boundary-label');
    expect(styles).toContain('.component-selection-state');
    expect(styles).toContain('.selection-feedback');
    expect(styles).toContain('min-height:44px');
    expect(inspector).toContain('role="alert"');
    expect(inspector).toContain('aria-live="polite"');
    expect(toolbar).toContain('Selected for grouping:');
    expect(toolbar).toContain('selection-feedback-error');
    expect(inspector).toContain('describeGroupSelection');
    expect(store).toContain('Person cannot be grouped with a Software System');
    expect(store).toContain('system groups contain only Software Systems');
  });
});
