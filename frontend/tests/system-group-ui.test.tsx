import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('system group UI accessibility contract', () => {
  it('supports keyboard multi-selection and distinct group selection on the canvas', () => {
    const canvas = source('../src/components/DiagramCanvas.tsx');
    const component = source('../src/components/ComponentNode.tsx');
    const workspace = source('../src/components/DiagramWorkspace.tsx');
    expect(canvas).toContain('selectionOnDrag={false}');
    expect(canvas).toContain('selectionKeyCode="Shift"');
    expect(canvas).toContain('multiSelectionKeyCode="Shift"');
    expect(canvas).toContain('onSelectionChange={handleSelectionChange}');
    expect(canvas).toContain('onMultiSelectionChange?.(componentIds)');
    expect(canvas).toContain('onMultiSelectionChange?.([])');
    expect(canvas).toContain('if (event.shiftKey)');
    expect(canvas).not.toContain('event.metaKey');
    expect(canvas).not.toContain('event.ctrlKey');
    expect(canvas).toContain("kind: 'group'");
    expect(component).toContain('component-selection-state');
    expect(component).toContain('is-selected');
    expect(workspace).toContain('groupingSelectionActive');
    expect(workspace).toContain('clearCanvasSelection');
    expect(workspace).toContain("next?.kind === 'components' ? next.ids : []");
    expect(canvas).toContain("kind: 'group-member-candidate'");
    expect(workspace).toContain('selectedCandidateComponentId');
  });

  it('exposes group creation feedback and member actions with confirmation semantics', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    const recovery = source('../src/components/RecoveryControls.tsx');
    const toolbar = source('../src/components/DiagramToolbar.tsx');
    const groupNode = source('../src/components/SystemGroupNode.tsx');
    expect(toolbar).toContain('Group selected systems');
    expect(toolbar).toContain('disabled');
    expect(inspector).toContain('Group selected systems');
    expect(inspector).toContain('Remove from group');
    expect(inspector).toContain('Ungroup');
    expect(inspector).toContain('ConfirmDialog');
    expect(inspector).toContain('groupError');
    expect(inspector).toContain('onSelectionClear={onClose}');
    expect(recovery).toContain('onSelectionClear?.()');
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
    expect(inspector).toContain('Add component to group');
    expect(inspector).toContain('Candidate component');
    expect(inspector).toContain('aria-live');
    expect(inspector).toContain('group-member-candidate-error');
    expect(inspector).toContain('disabled={Boolean(candidateError)}');
    expect(inspector).toContain('aria-live="assertive"');
    expect(inspector).toContain('clearGroupError');
    expect(store).toContain('Person cannot be grouped with a Software System');
    expect(store).toContain('system groups contain only Software Systems');
    expect(store).toContain('already belongs to');
    expect(store).toContain('cannot be added again');
  });

  it('keeps a rejected candidate cancellable while preserving the selected group', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    const workspace = source('../src/components/DiagramWorkspace.tsx');
    expect(inspector).toContain('onSelectGroup?.(selectedGroup.id)');
    expect(inspector).toContain('>Cancel</button>');
    expect(workspace).toContain("selection?.kind === 'group-member-candidate'");
    expect(workspace).toContain('clearCanvasSelection');
  });
});
