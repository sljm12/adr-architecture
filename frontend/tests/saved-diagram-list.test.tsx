import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SavedDiagramList } from '../src/components/SavedDiagramList';
import { useDiagramStore } from '../src/state/diagram-store';
import { emptyChildFixture, generalParentFixture } from '../../shared/tests/container-fixtures';
vi.mock('../src/state/diagram-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/state/diagram-store')>();
  return { ...actual, useDiagramStore: Object.assign((selector: any = (s: any) => s) => selector(actual.useDiagramStore.getState()), actual.useDiagramStore) };
});

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

  it('provides accessible sorting controls and stable identity hooks for rows', () => {
    expect(list).toContain('Sort diagrams by');
    expect(list).toContain('Sort direction');
    expect(list).toContain('data-diagram-id={document.id}');
    expect(list).toContain('defaultDiagramListSort');
  });

  it('offers save, discard, and cancel choices before replacing unsaved work', () => {
    expect(dialog).toContain('Save and load');
    expect(dialog).toContain('Discard and load');
    expect(dialog).toContain('Cancel');
    expect(dialog).toContain('aria-modal="true"');
  });
});

describe('nested saved container library markup', () => {
  const render = () => renderToStaticMarkup(<SavedDiagramList onSelect={() => {}} onDelete={() => {}} onCreate={() => {}} />);
  it('renders nested native lists with the current owner title, level, parent and independent open/delete buttons', () => {
    const parent = generalParentFixture(), child = { ...emptyChildFixture(), name: 'Runtime' };
    useDiagramStore.setState({ savedDocuments: [parent, child] as any, document: child as any, savedDocumentsStatus: 'loaded', savedDocumentsDeleteStatus: 'idle' });
    const html = render();
    expect(html).toMatch(/<ul[^>]*saved-diagrams-list[^>]*>.*<li.*<ul[^>]*saved-diagram-children/s);
    expect(html).toContain('Payments, Container diagram, owner Payments, parent Payments architecture');
    expect(html).toContain('Delete Payments, Container diagram, owner Payments, parent Payments architecture');
    expect(html).toContain('aria-current="true"'); expect(html).toContain('2 saved diagrams.');
  });
  it('retains unavailable parent context instead of showing a child as a top-level diagram', () => {
    useDiagramStore.setState({ savedDocuments: [{ ...emptyChildFixture(), name: 'Runtime' }] as any, savedDocumentsStatus: 'loaded' });
    const html = render(); expect(html).toContain('Payments architecture'); expect(html).toContain('Parent unavailable'); expect(html).toContain('saved-diagram-children'); expect(html).toContain('1 saved diagrams.');
  });
});
