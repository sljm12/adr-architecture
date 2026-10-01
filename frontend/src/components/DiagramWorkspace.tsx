import { useCallback, useEffect, useRef, useState } from 'react';
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
  const clearGroupError = useDiagramStore(state => state.clearGroupError);
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
  const [pendingContainerIntent, setPendingContainerIntent] = useState<{ diagramId: string; componentId: string } | null>(null);
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [closedInspectorMode, setClosedInspectorMode] = useState<InspectorMode>(null);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(null);
  const [selection, setSelection] = useState<CanvasSelection>(null);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const updateSelectedComponentIds = useCallback((nextIds: string[]) => setSelectedComponentIds(current => current.length === nextIds.length && current.every((id, index) => id === nextIds[index]) ? current : nextIds), []);
  const clearCanvasSelection = useCallback(() => { clearGroupError(); setSelection(null); setSelectedComponentIds([]); }, [clearGroupError]);
  const startFreshDiagram = useCallback(() => { clearCanvasSelection(); setClosedInspectorMode(null); setInspectorMode(null); setInspectorOpen(true); startNew(); }, [clearCanvasSelection, startNew]);
  const requestNewDiagram = () => { if (!document || status === 'saving' || adrStatus === 'saving') return; if (status === 'unsaved' || status === 'failed' || adrStatus === 'unsaved' || adrStatus === 'failed') { setConfirmNew(true); return; } startFreshDiagram(); };
  const load = async (id: string) => { if (await loadSavedDocument(id)) { clearCanvasSelection(); setClosedInspectorMode(null); setInspectorMode(null); setInspectorOpen(false); useAdrStore.getState().startNew(id); void useAdrStore.getState().loadComponentAdrCounts(id); setCanvasEpoch(value => value + 1); } };
  const requestLoad = (id: string) => { if (status === 'saving' || adrStatus === 'saving') return; if (document && document.id !== id && (status === 'unsaved' || status === 'failed' || adrStatus === 'unsaved' || adrStatus === 'failed')) { setPendingDiagramId(id); return; } void load(id); };
  const finishContainerOpen = async (componentId: string) => {
    const opened = await useDiagramStore.getState().createOrOpenContainerDiagram(componentId);
    if (!opened) return;
    const child = useDiagramStore.getState().document;
    if (!child || child.kind !== 'container') return;
    clearCanvasSelection(); setClosedInspectorMode(null); setInspectorMode(null); setInspectorOpen(false);
    useAdrStore.getState().startNew(child.id); void useAdrStore.getState().load(child.id); void loadAdrCounts(child.id);
    setCanvasEpoch(value => value + 1);
    window.requestAnimationFrame(() => globalThis.document.getElementById('container-diagram-heading')?.focus());
  };
  const requestContainerOpen = (componentId: string) => {
    const current = useDiagramStore.getState();
    const currentAdr = useAdrStore.getState();
    if (!current.document || current.containerOpenStatus === 'loading' || current.status === 'saving' || currentAdr.status === 'saving') return;
    if (current.status === 'unsaved' || current.status === 'failed' || currentAdr.status === 'unsaved' || currentAdr.status === 'failed') {
      setPendingContainerIntent({ diagramId: current.document.id, componentId });
      return;
    }
    void finishContainerOpen(componentId);
  };
  const resolveContainerIntent = async (choice: 'save' | 'discard') => {
    const intent = pendingContainerIntent;
    if (!intent) return;
    const startingDocument = useDiagramStore.getState().document;
    if (!startingDocument || startingDocument.id !== intent.diagramId) { setPendingContainerIntent(null); return; }
    if (choice === 'save') {
      const diagramState = useDiagramStore.getState();
      if (diagramState.status === 'unsaved' || diagramState.status === 'failed') await diagramState.save();
      if (useDiagramStore.getState().status !== 'saved') return;
      const adrState = useAdrStore.getState();
      if ((adrState.status === 'unsaved' || adrState.status === 'failed') && !(await adrState.save())) return;
      if (!['saved', 'idle'].includes(useAdrStore.getState().status)) return;
    } else {
      const diagramState = useDiagramStore.getState();
      if (diagramState.status === 'unsaved' || diagramState.status === 'failed') {
        if (!(await diagramState.loadSavedDocument(intent.diagramId))) return;
      }
      const adrState = useAdrStore.getState();
      if (adrState.status === 'unsaved' || adrState.status === 'failed') {
        if (adrState.draft?.id) await adrState.select(adrState.draft.id);
        else adrState.startNew(intent.diagramId);
        if (useAdrStore.getState().status === 'failed' || useAdrStore.getState().status === 'loading') return;
      }
    }
    const current = useDiagramStore.getState();
    if (current.document?.id !== intent.diagramId || current.status !== 'saved') return;
    const owner = current.document.components.find(component => component.id === intent.componentId);
    const eligible = owner?.type === 'software-system' && (current.document.kind === 'container' ? owner.role === 'external' : (owner.role ?? 'element') === 'element');
    if (!eligible) {
      setPendingContainerIntent(null);
      useDiagramStore.setState({ containerOpenStatus: 'failed', containerOpenComponentId: intent.componentId, containerOpenError: 'That Software System was only present in the discarded draft. Save it before opening a container diagram.' });
      return;
    }
    setPendingContainerIntent(null);
    await finishContainerOpen(intent.componentId);
  };
  const containerOpenRequestRef = useRef(requestContainerOpen);
  containerOpenRequestRef.current = requestContainerOpen;
  useEffect(() => {
    const onContainerOpen = (event: Event) => {
      const componentId = (event as CustomEvent<{ componentId?: string }>).detail?.componentId;
      if (componentId) containerOpenRequestRef.current(componentId);
    };
    window.addEventListener('adr:open-container-diagram', onContainerOpen);
    return () => window.removeEventListener('adr:open-container-diagram', onContainerOpen);
  }, []);
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
  const selectCanvasItem = useCallback((next: CanvasSelection) => { clearGroupError(); setSelection(current => sameSelection(current, next) ? current : next); updateSelectedComponentIds(next?.kind === 'components' ? next.ids : []); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); }, [clearGroupError, updateSelectedComponentIds]);
  const selectLinkedComponent = useCallback((componentId: string) => { clearGroupError(); setSelectedComponentIds([]); setSelection({ kind: 'component', id: componentId }); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); window.requestAnimationFrame(() => globalThis.document.getElementById('component-adr-summary-heading')?.focus()); }, [clearGroupError]);
  const selectLinkedRelationship = useCallback((relationshipId: string) => { clearGroupError(); setSelectedComponentIds([]); setSelection({ kind: 'relationship', id: relationshipId }); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); }, [clearGroupError]);
  const selectGroup = useCallback((groupId: string) => { clearGroupError(); setSelectedComponentIds([]); setSelection({ kind: 'group', id: groupId }); setInspectorMode(null); setClosedInspectorMode(null); setInspectorOpen(true); }, [clearGroupError]);
  const openLinkedAdr = useCallback((adrId: string) => { clearCanvasSelection(); setInspectorMode('adr'); setClosedInspectorMode(null); setInspectorOpen(true); void selectAdr(adrId); }, [clearCanvasSelection, selectAdr]);
  const openInspector = useCallback((mode: Exclude<InspectorMode, null>) => { clearGroupError(); setSelection(null); if (mode !== 'group') setSelectedComponentIds([]); setClosedInspectorMode(null); setInspectorMode(mode); setInspectorOpen(true); }, [clearGroupError]);
  const closeInspector = useCallback(() => { if (inspectorMode === 'group' || selection?.kind === 'group-member-candidate') clearCanvasSelection(); else clearGroupError(); setClosedInspectorMode(inspectorMode); setInspectorMode(null); setInspectorOpen(false); }, [clearCanvasSelection, clearGroupError, inspectorMode, selection?.kind]);
  const toggleInspector = useCallback(() => { setInspectorOpen(open => { if (!open && inspectorMode === null && closedInspectorMode !== null) { setInspectorMode(closedInspectorMode); setClosedInspectorMode(null); } return !open; }); }, [closedInspectorMode, inspectorMode]);
  return <div className={`app-shell ${libraryOpen ? 'library-open' : 'library-closed'}`}>
    <a className="skip-link" href="#diagram-workspace">Skip to diagram workspace</a>
    <nav className="global-nav" aria-label="Global navigation"><a className="brand" href="/" aria-label="ADR Diagram home"><span className="brand-mark" aria-hidden="true">◇</span> ADR Diagram</a><div className="global-links"><a href="#diagrams">Diagrams</a><a href="#decisions" onClick={event => { event.preventDefault(); if (document) openInspector('adr'); }}>Decisions</a><a href="#help">Help</a></div><button className="nav-utility" type="button">Workspace</button></nav>
    <div className="sub-nav"><div><span className="eyebrow">Architecture workspace</span><h1>Make structure visible.</h1></div><div className="sub-nav-actions"><span className="quiet-note">Single-user workspace</span><button className="primary-pill" type="button" onClick={requestNewDiagram} disabled={!document || status === 'saving'}>New diagram</button></div></div>
    <div className="workspace"><aside className="workspace-sidebar" aria-label="Diagram overview"><div className="library-heading"><div><span className="eyebrow">Your artifacts</span><h2>Diagrams</h2></div><button className="icon-button" type="button" onClick={() => setLibraryOpen(false)} aria-label="Close diagrams panel">×</button></div><div className="current-diagram"><span className="card-kicker">Current diagram</span><strong>{document?.name ?? 'No diagram yet'}</strong><span className="card-meta">{document ? `${document.components.length} components · ${document.relationships.length} relationships` : 'Create a diagram to begin'}</span></div><SavedDiagramList onSelect={requestLoad} onDelete={requestDelete} onCreate={startNew} /></aside>
      <section className="editor-area" id="diagram-workspace" aria-label="Diagram editor"><DiagramToolbar onOpenInspector={openInspector} onToggleLibrary={() => setLibraryOpen(open => !open)} libraryOpen={libraryOpen} onToggleInspector={toggleInspector} inspectorOpen={inspectorOpen} selectedComponentIds={selectedComponentIds} />{document && adrCountStatus === 'failed' && <p className="adr-count-feedback" role="status">Decision counts are unavailable. <button type="button" className="text-action" onClick={() => void loadAdrCounts(document.id)}>Retry</button>{adrCountError ? ` ${adrCountError}` : ''}</p>}<div className={`canvas-workspace ${inspectorMode === 'adr' ? 'adr-mode' : ''} ${inspectorOpen ? 'inspector-open' : 'inspector-closed'}`}><DiagramCanvas onSelection={selectCanvasItem} selectedComponentIds={selectedComponentIds} selectedComponentId={selection?.kind === 'component' ? selection.id : null} selectedCandidateComponentId={selection?.kind === 'group-member-candidate' ? selection.componentId : null} selectedGroupId={selection?.kind === 'group' || selection?.kind === 'group-member-candidate' ? (selection.kind === 'group' ? selection.id : selection.groupId) : null} selectedRelationshipId={selection?.kind === 'relationship' ? selection.id : null} onMultiSelectionChange={updateSelectedComponentIds} groupingSelectionActive={inspectorMode === 'group'} canvasEpoch={canvasEpoch} adrCounts={adrCounts} onOpenComponentAdrs={selectLinkedComponent} /><WorkspaceInspector mode={inspectorMode} selection={selection} selectedComponentIds={selectedComponentIds} onClose={closeInspector} onSelectComponent={selectLinkedComponent} onSelectRelationship={selectLinkedRelationship} onSelectGroup={selectGroup} onOpenAdr={openLinkedAdr} /></div></section></div>
    {confirmNew && <ConfirmDialog title="Discard unsaved changes?" message="Your current diagram has changes that have not been saved. Discard them and create a new diagram?" confirmLabel="Discard and create" onConfirm={() => { startFreshDiagram(); setConfirmNew(false); }} onCancel={() => setConfirmNew(false)} />}
    {(pendingDiagramId || pendingContainerIntent) && <DiagramSwitchDialog title={pendingContainerIntent ? 'Save changes before opening the container diagram?' : undefined} message={pendingContainerIntent ? 'Your diagram or decision has unsaved changes. Save both before opening, discard both to continue, or cancel.' : undefined} saveLabel={pendingContainerIntent ? 'Save and open' : undefined} discardLabel={pendingContainerIntent ? 'Discard and open' : undefined} onSaveAndLoad={() => pendingContainerIntent ? void resolveContainerIntent('save') : void saveAndLoad()} onDiscardAndLoad={() => pendingContainerIntent ? void resolveContainerIntent('discard') : discardAndLoad()} onCancel={() => { setPendingDiagramId(null); setPendingContainerIntent(null); }} />}
    {pendingDeletionId && <DiagramDeletionUnsavedDialog onSaveAndDelete={() => void saveAndDelete()} onDiscardAndDelete={() => void discardAndDelete()} onCancel={() => setPendingDeletionId(null)} />}
  </div>;
}
