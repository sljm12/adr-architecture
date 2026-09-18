import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('workspace usability contract', () => {
  it('keeps library and Details visibility independent and preserves edit entry points', () => {
    const workspace = source('../src/components/DiagramWorkspace.tsx');
    const toolbar = source('../src/components/DiagramToolbar.tsx');
    const styles = source('../src/styles.css');
    expect(workspace).toContain('inspectorOpen');
    expect(workspace).toContain('className={`canvas-workspace');
    expect(toolbar).toContain('Hide Details panel');
    expect(toolbar).toContain('onToggleInspector');
    expect(styles).toContain('.canvas-workspace.inspector-closed');
    expect(styles).toContain('html,body,#root{overflow:hidden}');
  });

  it('keeps saved diagram filters behind a disclosure and exposes recovery', () => {
    const list = source('../src/components/SavedDiagramList.tsx');
    const styles = source('../src/components/saved-diagram-list.css');
    expect(list).toContain('Filters and sort');
    expect(list).toContain('Open recovery');
    expect(list).toContain('registerRestoredSavedDocument');
    expect(styles).toContain('.saved-diagrams-filter-disclosure');
    expect(styles).toContain('.saved-diagram-row.is-current');
  });
});
