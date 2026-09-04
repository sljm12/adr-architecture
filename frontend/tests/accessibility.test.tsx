import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workspace = source('../src/components/DiagramWorkspace.tsx');
const toolbar = source('../src/components/DiagramToolbar.tsx');
const dialog = source('../src/components/ConfirmDialog.tsx');
const switchDialog = source('../src/components/DiagramSwitchDialog.tsx');
const savedList = source('../src/components/SavedDiagramList.tsx');
const styles = source('../src/styles.css');

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
    expect(toolbar).toContain('<form onSubmit={submitCreate}>');
    expect(toolbar).toContain('aria-label="Relationship source component"');
    expect(toolbar).toContain('aria-label="Relationship target component"');
    expect(toolbar).toContain('aria-label="Relationship direction"');
    expect(workspace).toContain('>New Diagram</button>');
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

  it('uses WCAG AA contrast for the primary controls and muted text', () => {
    expect(contrast('#0066cc', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#5f6368', '#f5f5f7')).toBeGreaterThanOrEqual(4.5);
    expect(styles).toContain('#5f6368');
    expect(styles).not.toContain('color:#7a7a7a');
  });
});
