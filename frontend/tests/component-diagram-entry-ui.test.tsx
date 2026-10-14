import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { componentParentFixture, emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
import { useDiagramStore } from '../src/state/diagram-store';
import { WorkspaceInspector } from '../src/components/WorkspaceInspector';
import { DiagramToolbar } from '../src/components/DiagramToolbar';
import { ContainerBoundaryNode } from '../src/components/ContainerBoundaryNode';
import { fromReactFlow, toReactFlow } from '../src/adapters/react-flow/diagram-adapter';
vi.mock('../src/state/diagram-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/state/diagram-store')>();
  return { ...actual, useDiagramStore: Object.assign((selector: (state: ReturnType<typeof actual.useDiagramStore.getState>) => unknown = (state: ReturnType<typeof actual.useDiagramStore.getState>) => state) => selector(actual.useDiagramStore.getState()), actual.useDiagramStore) };
});
afterEach(() => useDiagramStore.getState().startNew());
const inspector = (id: string) => renderToStaticMarkup(<WorkspaceInspector mode={null} selection={{ kind: 'component', id }} onClose={() => undefined} />);
describe('Component entry rendered UI and adapter', () => {
  it('offers a native keyboard entry action for Application and Datastore only', () => {
    useDiagramStore.getState().open(componentParentFixture());
    expect(inspector(ids.application)).toContain('Checking component diagram');
    expect(inspector(ids.datastore)).toContain('Checking component diagram');
    expect(inspector(ids.personOccurrence)).not.toContain('Create or open component diagram');
    expect(inspector(ids.systemOccurrence)).toContain('Checking container diagram');
    useDiagramStore.getState().open(populatedComponentFixture() as DiagramDocument);
    expect(inspector(ids.internal)).not.toContain('Create or open component diagram');
    expect(inspector(ids.siblingOccurrence)).toContain('Checking component diagram');
  });
  it('renders an inert owner-labeled empty boundary without a persisted target', () => {
    const child = emptyComponentFixture() as DiagramDocument;
    const visual = toReactFlow(child);
    expect(visual.nodes).toHaveLength(1); expect(visual.edges).toEqual([]);
    expect(visual.nodes[0]).toMatchObject({ type: 'containerBoundary', position: { x: 0, y: 0 }, data: { label: child.name, scopeKind: 'component' }, selectable: false, connectable: false, draggable: false, focusable: false });
    expect(fromReactFlow(child, visual.nodes)).toEqual(child);
    const boundary = renderToStaticMarkup(<ContainerBoundaryNode {...({ data: visual.nodes[0].data } as React.ComponentProps<typeof ContainerBoundaryNode>)} />);
    expect(boundary).toContain(`Container boundary for ${child.name}`); expect(boundary).not.toContain('react-flow__handle');
  });
  it('renders Open/Restore labels and actionable progress/error feedback for the selected owner', () => {
    useDiagramStore.getState().open(componentParentFixture());
    const child = emptyComponentFixture();
    useDiagramStore.setState({ componentOpenComponentId: ids.application, componentAvailability: { parentDiagramId: ids.parent, containerId: ids.application, availability: 'active', diagram: child  } });
    expect(inspector(ids.application)).toContain('Open component diagram');
    useDiagramStore.setState({ componentOpenStatus: 'loading' });
    expect(inspector(ids.application)).toContain('Opening the canonical Component diagram');
    useDiagramStore.setState({ componentOpenStatus: 'failed', componentOpenError: 'Load failed. Retry opening.' });
    expect(inspector(ids.application)).toContain('Load failed. Retry opening.'); expect(inspector(ids.application)).toContain('Retry');
    useDiagramStore.setState({ componentAvailability: { parentDiagramId: ids.parent, containerId: ids.application, availability: 'trashed', diagram: { ...child, status: 'trashed' }  } });
    expect(inspector(ids.application)).toContain('Restore component diagram');
  });
  it('identifies all scopes and returns to the immediate parent with its owner', () => {
    useDiagramStore.getState().open(emptyComponentFixture() as DiagramDocument);
    const toolbar = renderToStaticMarkup(<DiagramToolbar onOpenInspector={() => undefined} onToggleLibrary={() => undefined} libraryOpen onToggleInspector={() => undefined} inspectorOpen />);
    expect(toolbar).toContain('Component diagram'); expect(toolbar).toContain('component-diagram-heading');
    expect(toolbar).toContain('Return to Payments'); expect(toolbar).toContain('Software System: Payments');
    expect(toolbar).toContain('readOnly');
  });
});
