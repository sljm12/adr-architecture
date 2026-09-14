import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workspace = source('../src/components/DiagramWorkspace.tsx');
const toolbar = source('../src/components/DiagramToolbar.tsx');
const inspector = source('../src/components/WorkspaceInspector.tsx');
const dialog = source('../src/components/ConfirmDialog.tsx');
const switchDialog = source('../src/components/DiagramSwitchDialog.tsx');
const savedList = source('../src/components/SavedDiagramList.tsx');
const styles = source('../src/styles.css');
const canvas = source('../src/components/DiagramCanvas.tsx');
const componentNode = source('../src/components/ComponentNode.tsx');
const groupNode = source('../src/components/SystemGroupNode.tsx');
const store = source('../src/state/diagram-store.ts');

function contrast(foreground: string, background: string): number {
  const channel = (value: string) => { const numeric = parseInt(value, 16) / 255; return numeric <= 0.03928 ? numeric / 12.92 : ((numeric + 0.055) / 1.055) ** 2.4; };
  const rgb = (hex: string) => [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(channel);
  const luminance = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe('core workflow accessibility contract', () => {
  it('provides a skip link, labeled editor landmarks, and keyboard-submit forms', () => {
    expect(workspace).toContain('Skip to diagram workspace');
    expect(workspace).toContain('id="diagram-workspace" aria-label="Diagram editor"');
    expect(inspector).toContain('<form className="inspector-form" onSubmit={add}>');
    expect(inspector).toContain('workspace-inspector-adr');
    expect(inspector).toContain('adr-workspace-body');
    expect(inspector).toContain('htmlFor="relationship-source"');
    expect(inspector).toContain('htmlFor="relationship-target"');
    expect(inspector).toContain('htmlFor="relationship-direction"');
    expect(workspace).toContain('>New diagram</button>');
    expect(workspace).toContain('adr-mode');
    expect(workspace).toContain('Discard unsaved changes?');
  });

  it('keeps dialog focus inside the confirmation flow and restores the trigger focus', () => {
    expect(dialog).toContain("document.addEventListener('keydown'");
    expect(dialog).toContain("event.key === 'Escape'");
    expect(dialog).toContain('previouslyFocused?.focus()');
    expect(dialog).toContain('aria-describedby={messageId}');
  });

  it('keeps saved-document navigation and guarded switching accessible', () => {
    expect(savedList).toContain('aria-labelledby');
    expect(savedList).toContain('role="status"');
    expect(switchDialog).toContain('aria-modal="true"');
    expect(switchDialog).toContain("event.key === 'Escape'");
    expect(switchDialog).toContain('previouslyFocused?.focus()');
  });

  it('labels navigation, inspector controls, and live save feedback', () => {
    expect(workspace).toContain('nav className="global-nav" aria-label="Global navigation"');
    expect(workspace).toContain('aria-label="Diagram overview"');
    expect(workspace).toContain('aria-label="Close diagrams panel"');
    expect(inspector).toContain('aria-label={mode === \'adr\' ? \'ADR workspace\' : \'Diagram inspector\'}');
    expect(inspector).toContain('aria-label="Close inspector"');
    expect(workspace).toContain('id="diagram-workspace" aria-label="Diagram editor"');
    expect(styles).toContain('.save-status');
  });

  it('uses WCAG AA contrast for the primary controls and muted text', () => {
    expect(contrast('#0066cc', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#5f6368', '#f5f5f7')).toBeGreaterThanOrEqual(4.5);
    expect(styles).toContain('#5f6368');
    expect(styles).not.toContain('color:#7a7a7a');
  });

  it('keeps C4 groups and selection feedback keyboard discoverable', () => {
    expect(componentNode).toContain('tabIndex={0}');
    expect(componentNode).toContain('aria-selected');
    expect(groupNode).toContain('tabIndex={0}');
    expect(groupNode).toContain('aria-selected');
    expect(groupNode).toContain('Software System boundary');
    expect(canvas).toContain('selectionKeyCode="Shift"');
    expect(canvas).toContain('multiSelectionKeyCode="Shift"');
    expect(canvas).toContain('selectionOnDrag={false}');
    expect(inspector).toContain('Remove from group');
    expect(inspector).toContain('ConfirmDialog');
    expect(styles).toContain('.component-node:focus-visible');
    expect(styles).toContain('.system-group-node:focus-visible');
    expect(styles).toContain('@media(max-width:640px)');
    expect(styles).toContain('min-height:44px');
  });

  it('uses non-color selection cues and accessible incompatibility feedback', () => {
    expect(componentNode).toContain('component-selection-state');
    expect(groupNode).toContain('group-selection-state');
    expect(toolbar).toContain('selection-feedback-error');
    expect(toolbar).toContain('role={selectionError ? \'alert\' : \'status\'}');
    expect(store).toContain('Person cannot be grouped with a Software System');
    expect(inspector).toContain('aria-live="polite"');
    expect(styles).toContain('outline:3px solid #0071e3');
    expect(contrast('#ffffff', '#272729')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#c8d0d8', '#272729')).toBeGreaterThanOrEqual(4.5);
  });
});
