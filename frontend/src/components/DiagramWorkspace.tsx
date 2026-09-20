import { useCallback, useState } from 'react';
import { DiagramToolbar, type InspectorMode } from './DiagramToolbar';
import { DiagramCanvas } from './DiagramCanvas';
import { useDiagramStore } from '../state/diagram-store';
import { ConfirmDialog } from './ConfirmDialog';
import { DiagramSwitchDialog } from './DiagramSwitchDialog';
import { DiagramDeletionUnsavedDialog } from './DiagramDeletionUnsavedDialog';
import { SavedDiagramList } from './SavedDiagramList';
import { WorkspaceInspector, type CanvasSelection } from './WorkspaceInspector';
import { useAdrStore } from '../state/adr-store';

const sameSelection = (left: CanvasSelection, right: CanvasSelection) => {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'components' && right.kind === 'components') return left.ids.length === right.ids.length && left.ids.every((id, index) => id === right.ids[index]);
  if (left.kind === 'group-member-candidate' && right.kind === 'group-member-candidate') return left.groupId === right.groupId && left.componentId === right.componentId;
  return 'id' in left && 'id' in right && left.id === right.id;
};

export function DiagramWorkspace() {
  const document = useDiagramStore(state => state.document);
  const status = useDiagramStore(state => state.status);
  const startNew = useDiagramStore(state => state.startNew);
  const save = useDiagramStore(state => state.save);
  const loadSavedDocument = useDiagramStore(state => state.loadSavedDocument);
  const trashSavedDocument = useDiagramStore(state => state.trashSavedDocument);
  const adrStatus = useAdrStore(state => state.status);
  const adrCounts = useAdrStore(state => state.componentAdrCounts);
  const adrCountStatus = useAdrStore(state => state.componentAdrCountsStatus);
  const adrCountError = useAdrStore(state => state.componentAdrCountsError);
  const loadAdrCounts = useAdrStore(state => state.loadComponentAdrCounts);
  const saveAdr = useAdrStore(state => state.save);
  const selectAdr = useAdrStore(state => state.select);
  const [confirmNew, setConfirmNew] = useState(false);
  const [pendingDiagramId, setPendingDiagramId] = useState<string | null>(null);
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [closedInspectorMode, setClosedInspectorMode] = useState<InspectorMode>(null);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(null);
  const [selection, setSelection] = useState<CanvasSelection>(null);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const updateSelectedComponentIds = useCallback((nextIds: string[]) => setSelectedComponentIds(current => current.length === nextIds.length && current.every((id, index) => id === nextIds[index]) ? current : nextIds), []);
  const clearCanvasSelection = useCallback(() => { setSelection(null); setSelectedComponentIds([]); }, []);
  const startFreshDiagram = useCallback(() => { clearCanvasSelection(); setClosedInspectorMode(null); setInspectorMode(null); setInspectorOpen(true); startNew(); }, [clearCanvasSelection, startNew]);
  const requestNewDiagram = () => { if (!document || status === 'saving' || adrStatus === 'saving') return; if (status === 'unsaved' || status === 'failed' || adrStatus === 'unsaved' || adrStatus === 'failed') { setConfirmNew(true); return; } startFreshDiagram(); };
  const load = async (id: string) => { if (await loadSavedDocument(id)) { clearCanvasSelection(); setClosedInspectorMode(null); setInspectorMode(null); setInspectorOpen(false); useAdrStore.getState().startNew(id); void useAdrStore.getState().loadComponentAdrCounts(id); setCanvasEpoch(value => value + 1); } };
  const requestLoad = (id: string) => { if (status === 'saving' || adrStatus === 'saving') return; if (document && document.id !== id && (status === 'unsaved' || status === 'failed' || adrStatus === 'unsaved' || adrStatus === 'failed')) { setPendingDiagramId(id); return; } void load(id); };
  const saveAndLoad = async () => { if (!pendingDiagramId) return; await save(); if (useDiagramStore.getState().status === 'saved' && (adrStatus !== 'unsaved' && adrStatus !== 'failed' || await saveAdr())) { const id = pendingDiagramId; setPendingDiagramId(null); await load(id); } };
  const discardAndLoad = () => { if (!pendingDiagramId) return; const id = pendingDiagramId; setPendingDiagramId(null); void load(id); };
  const finishDeletion = async (id: string) => { const deleted = await trashSavedDocument(id); if (deleted && useDiagramStore.getState().document?.id === id) { useAdrStore.getState().startNew(); startFreshDiagram(); } };
  const requestDelete = (id: string) => {
    const currentAdrStatus = useAdrStore.getState().status;
    if (status === 'saving' || currentAdrStatus === 'saving') return;
    if (document?.id === id && (status === 'unsaved' || status === 'failed' || currentAdrStatus === 'unsaved' || currentAdrStatus === 'failed')) { setPendingDeletionId(id); return; }
    void finishDeletion(id);
  };
  const saveAndDelete = async () => {
    if (!pendingDeletionId) return;
    const id = pendingDeletionId;
    await save();
    if (useDiagramStore.getState().status !== 'saved') return;
    const currentAdrStatus = useAdrStore.getState().status;
    if ((currentAdrStatus === 'unsaved' || currentAdrStatus === 'failed') && !(await useAdrStore.getState().save())) return;
    setPendingDeletionId(null);
    await finishDeletion(id);
  };
  const discardAndDelete = async () => {
    if (!pendingDeletionId) return;
    const id = pendingDeletionId;
    setPendingDeletionId(null);
    if (!(await loadSavedDocument(id))) return;
    useAdrStore.getState().startNew();
    await finishDeletion(id);
  };
  const selectCanvasItem = useCallback((next: CanvasSelection) => { setSelection(current => sameSelection(current, next) ? current : next); updateSelectedComponentIds(next?.kind === 'components' ? next.ids : []); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); }, [updateSelectedComponentIds]);
  const selectLinkedComponent = useCallback((componentId: string) => { setSelectedComponentIds([]); setSelection({ kind: 'component', id: componentId }); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); window.requestAnimationFrame(() => globalThis.document.getElementById('component-adr-summary-heading')?.focus()); }, []);
  const selectLinkedRelationship = useCallback((relationshipId: string) => { setSelectedComponentIds([]); setSelection({ kind: 'relationship', id: relationshipId }); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); }, []);
  const selectGroup = useCallback((groupId: string) => { setSelectedComponentIds([]); setSelection({ kind: 'group', id: groupId }); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); }, []);
  const openLinkedAdr = useCallback((adrId: string) => { clearCanvasSelection(); setInspectorMode('adr'); setClosedInspectorMode(null); setInspectorOpen(true); void selectAdr(adrId); }, [clearCanvasSelection, selectAdr]);
  const openInspector = useCallback((mode: Exclude<InspectorMode, null>) => { setSelection(null); if (mode !== 'group') setSelectedComponentIds([]); setClosedInspectorMode(null); setInspectorMode(mode); setInspectorOpen(true); }, []);
  const closeInspector = useCallback(() => { setClosedInspectorMode(inspectorMode); setInspectorMode(null); setInspectorOpen(false); }, [inspectorMode]);
  const toggleInspector = useCallback(() => { setInspectorOpen(open => { if (!open && inspectorMode === null && closedInspectorMode !== null) { setInspectorMode(closedInspectorMode); setClosedInspectorMode(null); } return !open; }); }, [closedInspectorMode, inspectorMode]);
  return <div className={`app-shell ${libraryOpen ? 'library-open' : 'library-closed'}`}>
    <a className="skip-link" href="#diagram-workspace">Skip to diagram workspace</a>
    <nav className="global-nav" aria-label="Global navigation"><a className="brand" href="/" aria-label="ADR Diagram home"><span className="brand-mark" aria-hidden="true">◇</span> ADR Diagram</a><div className="global-links"><a href="#diagrams">Diagrams</a><a href="#decisions" onClick={event => { event.preventDefault(); if (document) openInspector('adr'); }}>Decisions</a><a href="#help">Help</a></div><button className="nav-utility" type="button">Workspace</button></nav>
    <div className="sub-nav"><div><span className="eyebrow">Architecture workspace</span><h1>Make structure visible.</h1></div><div className="sub-nav-actions"><span className="quiet-note">Single-user workspace</span><button className="primary-pill" type="button" onClick={requestNewDiagram} disabled={!document || status === 'saving'}>New diagram</button></div></div>
    <div className="workspace"><aside className="workspace-sidebar" aria-label="Diagram overview"><div className="library-heading"><div><span className="eyebrow">Your artifacts</span><h2>Diagrams</h2></div><button className="icon-button" type="button" onClick={() => setLibraryOpen(false)} aria-label="Close diagrams panel">×</button></div><div className="current-diagram"><span className="card-kicker">Current diagram</span><strong>{document?.name ?? 'No diagram yet'}</strong><span className="card-meta">{document ? `${document.components.length} components · ${document.relationships.length} relationships` : 'Create a diagram to begin'}</span></div><SavedDiagramList onSelect={requestLoad} onDelete={requestDelete} onCreate={startNew} /></aside>
      <section className="editor-area" id="diagram-workspace" aria-label="Diagram editor"><DiagramToolbar onOpenInspector={openInspector} onToggleLibrary={() => setLibraryOpen(open => !open)} libraryOpen={libraryOpen} onToggleInspector={toggleInspector} inspectorOpen={inspectorOpen} selectedComponentIds={selectedComponentIds} />{document && adrCountStatus === 'failed' && <p className="adr-count-feedback" role="status">Decision counts are unavailable. <button type="button" className="text-action" onClick={() => void loadAdrCounts(document.id)}>Retry</button>{adrCountError ? ` ${adrCountError}` : ''}</p>}<div className={`canvas-workspace ${inspectorMode === 'adr' ? 'adr-mode' : ''} ${inspectorOpen ? 'inspector-open' : 'inspector-closed'}`}><DiagramCanvas onSelection={selectCanvasItem} selectedComponentIds={selectedComponentIds} selectedComponentId={selection?.kind === 'component' ? selection.id : null} selectedCandidateComponentId={selection?.kind === 'group-member-candidate' ? selection.componentId : null} selectedGroupId={selection?.kind === 'group' || selection?.kind === 'group-member-candidate' ? (selection.kind === 'group' ? selection.id : selection.groupId) : null} selectedRelationshipId={selection?.kind === 'relationship' ? selection.id : null} onMultiSelectionChange={updateSelectedComponentIds} groupingSelectionActive={inspectorMode === 'group'} canvasEpoch={canvasEpoch} adrCounts={adrCounts} onOpenComponentAdrs={selectLinkedComponent} /><WorkspaceInspector mode={inspectorMode} selection={selection} selectedComponentIds={selectedComponentIds} onClose={closeInspector} onSelectComponent={selectLinkedComponent} onSelectRelationship={selectLinkedRelationship} onSelectGroup={selectGroup} onOpenAdr={openLinkedAdr} /></div></section></div>
    {confirmNew && <ConfirmDialog title="Discard unsaved changes?" message="Your current diagram has changes that have not been saved. Discard them and create a new diagram?" confirmLabel="Discard and create" onConfirm={() => { startFreshDiagram(); setConfirmNew(false); }} onCancel={() => setConfirmNew(false)} />}
    {pendingDiagramId && <DiagramSwitchDialog onSaveAndLoad={() => void saveAndLoad()} onDiscardAndLoad={discardAndLoad} onCancel={() => setPendingDiagramId(null)} />}
    {pendingDeletionId && <DiagramDeletionUnsavedDialog onSaveAndDelete={() => void saveAndDelete()} onDiscardAndDelete={() => void discardAndDelete()} onCancel={() => setPendingDeletionId(null)} />}
  </div>;
}
