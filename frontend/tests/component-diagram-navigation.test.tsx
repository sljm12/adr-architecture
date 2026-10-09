import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
import { useDiagramStore } from '../src/state/diagram-store';
import { diagramClient } from '../src/api/diagram-client';
import { DiagramToolbar } from '../src/components/DiagramToolbar';
import { DiagramSwitchDialog } from '../src/components/DiagramSwitchDialog';
import { useAdrStore } from '../src/state/adr-store';
import { componentAdrFixtures } from '../../shared/tests/component-fixtures';
vi.mock('../src/state/diagram-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/state/diagram-store')>();
  return { ...actual, useDiagramStore: Object.assign((selector: any = (s: any) => s) => selector(actual.useDiagramStore.getState()), actual.useDiagramStore) };
});
const store = () => useDiagramStore.getState();
afterEach(() => { vi.restoreAllMocks(); store().startNew(); useAdrStore.getState().clear(); });
describe('Component hierarchy navigation', () => {
  it('identifies every scope level, read-only owner title and immediate return action', () => {
    store().open(populatedComponentFixture() as DiagramDocument);
    const html = renderToStaticMarkup(<DiagramToolbar onOpenInspector={() => {}} onToggleLibrary={() => {}} libraryOpen onToggleInspector={() => {}} inspectorOpen />);
    for (const value of ['Component diagram', 'Software System: Payments', 'Parent Container: Payments', 'readOnly=""', 'Return to Payments, owner Payment API']) expect(html).toContain(value);
    const dialog = renderToStaticMarkup(<DiagramSwitchDialog onSaveAndLoad={() => {}} onDiscardAndLoad={() => {}} onCancel={() => {}} />);
    for (const label of ['Save and load', 'Discard and load', 'Cancel']) expect(dialog).toContain(label);
  });
  it('keeps document/history on failed or stale ancestor loads and retains saved history after a round trip', async () => {
    const c = populatedComponentFixture() as DiagramDocument, p = componentParentFixture(); store().open(c); store().renameComponent(ids.internal, 'Saved handler');
    vi.spyOn(diagramClient, 'save').mockImplementation(async d => d); await store().save(); const saved = structuredClone(store().document!);
    vi.spyOn(diagramClient, 'get').mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(p).mockResolvedValueOnce(saved);
    expect(await store().loadSavedDocument(p.id)).toBe(false); expect(store().document).toEqual(saved); expect(store().canUndo).toBe(true);
    expect(await store().loadSavedDocument(p.id)).toBe(true); expect(await store().loadSavedDocument(c.id)).toBe(true); expect(store().canUndo).toBe(true);
    store().undo(); expect(store().document?.components[0].name).toBe(c.components[0].name);
    let resolve!: (d: DiagramDocument) => void; vi.mocked(diagramClient.get).mockImplementation(() => new Promise(r => { resolve = r; }));
    const loading = store().loadSavedDocument(ids.context, { canCommit: () => false }); resolve(componentContextFixture());
    expect(await loading).toBe(false); expect(store().document?.id).toBe(c.id);
  });
  it('retains a saved local ADR selection across levels and discards only explicitly departed unsaved work', () => {
    const adr = componentAdrFixtures()[0]; useAdrStore.getState().open(adr);
    useAdrStore.getState().switchDiagram(ids.parent); expect(useAdrStore.getState().diagramId).toBe(ids.parent);
    useAdrStore.getState().switchDiagram(ids.child); expect(useAdrStore.getState().draft).toEqual(adr);
    useAdrStore.getState().update(d => ({ ...d, title: 'Discarded draft' }));
    useAdrStore.getState().switchDiagram(ids.parent); useAdrStore.getState().switchDiagram(ids.child);
    expect(useAdrStore.getState().status).toBe('idle'); expect(useAdrStore.getState().draft?.title).toBe('');
  });
  it('rejects a library load that changes the known parent/owner association', async () => {
    const c = populatedComponentFixture() as DiagramDocument, p = componentParentFixture(); store().open(p);
    useDiagramStore.setState({ savedDocuments: [p, c] });
    vi.spyOn(diagramClient, 'get').mockResolvedValue({ ...c, scope: { ...(c.scope as any), containerId: ids.datastore } });
    expect(await store().loadSavedDocument(c.id)).toBe(false); expect(store().document).toEqual(p);
    expect(store().loadError).toContain('parent/owner association');
  });
});
