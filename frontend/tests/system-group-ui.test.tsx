import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('system group UI accessibility contract', () => {
  it('supports keyboard multi-selection and distinct group selection on the canvas', () => {
    const canvas = source('../src/components/DiagramCanvas.tsx');
    expect(canvas).toContain('selectionOnDrag');
    expect(canvas).toContain('multiSelectionKeyCode');
    expect(canvas).toContain('onSelectionChange');
    expect(canvas).toContain("kind: 'group'");
    expect(canvas).toContain('constrainMemberPosition');
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
    expect(styles).toContain('.system-group-node');
    expect(styles).toContain('group-boundary-label');
    expect(styles).toContain('min-height:44px');
    expect(inspector).toContain('role="alert"');
    expect(inspector).toContain('aria-live="polite"');
  });
});
