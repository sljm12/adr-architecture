import { useCallback, useState } from 'react';
import { DiagramToolbar, type InspectorMode } from './DiagramToolbar';
import { DiagramCanvas } from './DiagramCanvas';
import { useDiagramStore } from '../state/diagram-store';
import { ConfirmDialog } from './ConfirmDialog';
import { DiagramSwitchDialog } from './DiagramSwitchDialog';
import { SavedDiagramList } from './SavedDiagramList';
import { WorkspaceInspector, type CanvasSelection } from './WorkspaceInspector';
import { useAdrStore } from '../state/adr-store';

const sameSelection = (left: CanvasSelection, right: CanvasSelection) => {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'components' && right.kind === 'components') return left.ids.length === right.ids.length && left.ids.every((id, index) => id === right.ids[index]);
  return 'id' in left && 'id' in right && left.id === right.id;
};

export function DiagramWorkspace() {
  const document = useDiagramStore(state => state.document); const status = useDiagramStore(state => state.status); const startNew = useDiagramStore(state => state.startNew); const save = useDiagramStore(state => state.save); const loadSavedDocument = useDiagramStore(state => state.loadSavedDocument); const adrStatus = useAdrStore(state => state.status); const saveAdr = useAdrStore(state => state.save); const selectAdr = useAdrStore(state => state.select);
  const [confirmNew, setConfirmNew] = useState(false); const [pendingDiagramId, setPendingDiagramId] = useState<string | null>(null); const [libraryOpen, setLibraryOpen] = useState(true); const [inspectorMode, setInspectorMode] = useState<InspectorMode>(null); const [selection, setSelection] = useState<CanvasSelection>(null); const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const updateSelectedComponentIds = useCallback((nextIds: string[]) => setSelectedComponentIds(current => current.length === nextIds.length && current.every((id, index) => id === nextIds[index]) ? current : nextIds), []);
  const requestNewDiagram = () => { if (!document || status === 'saving' || adrStatus === 'saving') return; if (status === 'unsaved' || status === 'failed' || adrStatus === 'unsaved' || adrStatus === 'failed') { setConfirmNew(true); return; } startNew(); };
  const load = async (id: string) => { await loadSavedDocument(id); };
  const requestLoad = (id: string) => { if (status === 'saving' || adrStatus === 'saving') return; if (document && document.id !== id && (status === 'unsaved' || status === 'failed' || adrStatus === 'unsaved' || adrStatus === 'failed')) { setPendingDiagramId(id); return; } void load(id); };
  const saveAndLoad = async () => { if (!pendingDiagramId) return; await save(); if (useDiagramStore.getState().status === 'saved' && (adrStatus !== 'unsaved' && adrStatus !== 'failed' || await saveAdr())) { const id = pendingDiagramId; setPendingDiagramId(null); await load(id); } };
  const discardAndLoad = () => { if (!pendingDiagramId) return; const id = pendingDiagramId; setPendingDiagramId(null); void load(id); };
  const selectCanvasItem = (next: CanvasSelection) => { setSelection(current => sameSelection(current, next) ? current : next); updateSelectedComponentIds(next?.kind === 'components' ? next.ids : next?.kind === 'component' ? [next.id] : []); setInspectorMode(null); };
  const selectLinkedComponent = (componentId: string) => { setSelectedComponentIds([componentId]); setSelection({ kind: 'component', id: componentId }); setInspectorMode(null); };
  const selectLinkedRelationship = (relationshipId: string) => { setSelection({ kind: 'relationship', id: relationshipId }); setInspectorMode(null); };
  const openLinkedAdr = (adrId: string) => { setSelection(null); setInspectorMode('adr'); void selectAdr(adrId); };
  const openInspector = (mode: Exclude<InspectorMode, null>) => { setSelection(null); setInspectorMode(mode); };
  const closeInspector = () => { setSelection(null); setSelectedComponentIds([]); setInspectorMode(null); };
  return <div className={`app-shell ${libraryOpen ? 'library-open' : 'library-closed'}`}>
    <a className="skip-link" href="#diagram-workspace">Skip to diagram workspace</a>
    <nav className="global-nav" aria-label="Global navigation"><a className="brand" href="/" aria-label="ADR Diagram home"><span className="brand-mark" aria-hidden="true">◇</span> ADR Diagram</a><div className="global-links"><a href="#diagrams">Diagrams</a><a href="#decisions" onClick={event => { event.preventDefault(); if (document) openInspector('adr'); }}>Decisions</a><a href="#help">Help</a></div><button className="nav-utility" type="button">Workspace</button></nav>
    <div className="sub-nav"><div><span className="eyebrow">Architecture workspace</span><h1>Make structure visible.</h1></div><div className="sub-nav-actions"><span className="quiet-note">Single-user workspace</span><button className="primary-pill" type="button" onClick={requestNewDiagram} disabled={!document || status === 'saving'}>New diagram</button></div></div>
    <div className="workspace"><aside className="workspace-sidebar" aria-label="Diagram overview"><div className="library-heading"><div><span className="eyebrow">Your artifacts</span><h2>Diagrams</h2></div><button className="icon-button" type="button" onClick={() => setLibraryOpen(false)} aria-label="Close diagrams panel">×</button></div><div className="current-diagram"><span className="card-kicker">Current diagram</span><strong>{document?.name ?? 'No diagram yet'}</strong><span className="card-meta">{document ? `${document.components.length} components · ${document.relationships.length} relationships` : 'Create a diagram to begin'}</span></div><SavedDiagramList onSelect={requestLoad} onCreate={startNew} /></aside>
      <section className="editor-area" id="diagram-workspace" aria-label="Diagram editor"><DiagramToolbar onOpenInspector={openInspector} onToggleLibrary={() => setLibraryOpen(open => !open)} libraryOpen={libraryOpen} selectedComponentIds={selectedComponentIds} /><div className={`canvas-workspace ${inspectorMode === 'adr' ? 'adr-mode' : ''}`}><DiagramCanvas onSelection={selectCanvasItem} selectedComponentIds={selectedComponentIds} selectedComponentId={selection?.kind === 'component' ? selection.id : null} selectedGroupId={selection?.kind === 'group' ? selection.id : null} selectedRelationshipId={selection?.kind === 'relationship' ? selection.id : null} onMultiSelectionChange={updateSelectedComponentIds} /><WorkspaceInspector mode={inspectorMode} selection={selection} selectedComponentIds={selectedComponentIds} onClose={closeInspector} onSelectComponent={selectLinkedComponent} onSelectRelationship={selectLinkedRelationship} onOpenAdr={openLinkedAdr} /></div></section></div>
    {confirmNew && <ConfirmDialog title="Discard unsaved changes?" message="Your current diagram has changes that have not been saved. Discard them and create a new diagram?" confirmLabel="Discard and create" onConfirm={() => { startNew(); setConfirmNew(false); }} onCancel={() => setConfirmNew(false)} />}
    {pendingDiagramId && <DiagramSwitchDialog onSaveAndLoad={() => void saveAndLoad()} onDiscardAndLoad={discardAndLoad} onCancel={() => setPendingDiagramId(null)} />}
  </div>;
}
