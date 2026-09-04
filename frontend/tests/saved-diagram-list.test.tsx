import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const list = source('../src/components/SavedDiagramList.tsx');
const dialog = source('../src/components/DiagramSwitchDialog.tsx');

describe('saved-document controls', () => {
  it('provides a labeled saved-document list with empty, loading, and error feedback', () => {
    expect(list).toContain('Saved diagrams');
    expect(list).toContain('Loading saved diagrams');
    expect(list).toContain('No saved diagrams yet.');
    expect(list).toContain('last saved');
    expect(list).toContain('role="status"');
  });

  it('offers save, discard, and cancel choices before replacing unsaved work', () => {
    expect(dialog).toContain('Save and load');
    expect(dialog).toContain('Discard and load');
    expect(dialog).toContain('Cancel');
    expect(dialog).toContain('aria-modal="true"');
  });
});
