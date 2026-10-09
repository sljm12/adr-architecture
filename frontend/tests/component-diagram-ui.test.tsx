import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { populatedComponentFixture, componentParentFixture } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
import { WorkspaceInspector } from '../src/components/WorkspaceInspector';
import { DiagramToolbar } from '../src/components/DiagramToolbar';
import { useDiagramStore } from '../src/state/diagram-store';
vi.mock('../src/state/diagram-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/state/diagram-store')>();
  return { ...actual, useDiagramStore: Object.assign((selector: any = (s: any) => s) => selector(actual.useDiagramStore.getState()), actual.useDiagramStore) };
});
describe('Component authoring surfaces', () => {
  it('provides Component-only required fields and enables authoring and source refresh controls', () => {
    useDiagramStore.getState().open(populatedComponentFixture() as DiagramDocument);
    const html = renderToStaticMarkup(<WorkspaceInspector mode="component" selection={null} onClose={() => {}} />);
    expect(html).toContain('Component type'); expect(html).toContain('Responsibilities'); expect(html).toContain('Technology'); expect(html).not.toContain('value="application"'); expect(html).not.toContain('value="person"');
    const toolbar = renderToStaticMarkup(<DiagramToolbar onOpenInspector={() => {}} onToggleLibrary={() => {}} libraryOpen onToggleInspector={() => {}} inspectorOpen />);
    for (const label of ['Add component', 'Connect', 'Include external participant', 'Refresh source details']) expect(toolbar).toContain(label);
  });
  it('keeps Component editing separate from Application/Datastore after switching levels', () => {
    const child = populatedComponentFixture() as DiagramDocument; useDiagramStore.getState().open(child);
    const edit = renderToStaticMarkup(<WorkspaceInspector mode={null} selection={{ kind: 'component', id: child.components[0].id }} onClose={() => {}} />);
    expect(edit).toContain('TypeScript'); expect(edit).toContain('Responsibilities'); expect(edit).not.toContain('value="datastore"');
    useDiagramStore.getState().open(componentParentFixture());
    const parent = renderToStaticMarkup(<WorkspaceInspector mode="component" selection={null} onClose={() => {}} />);
    expect(parent).toContain('value="application"'); expect(parent).toContain('value="datastore"'); expect(parent).not.toContain('Component type');
  });
  it('requires interaction descriptions and offers optional protocol, directed only', () => {
    useDiagramStore.getState().open(populatedComponentFixture() as DiagramDocument);
    const html = renderToStaticMarkup(<WorkspaceInspector mode="relationship" selection={null} onClose={() => {}} />);
    expect(html).toContain('Interaction description'); expect(html).toContain('relationship-protocol'); expect(html).not.toContain('value="undirected"');
  });
});
