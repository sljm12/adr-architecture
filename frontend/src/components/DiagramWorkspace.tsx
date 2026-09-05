import { DiagramToolbar, type InspectorMode } from './DiagramToolbar';
import { DiagramCanvas } from './DiagramCanvas';
import { useDiagramStore } from '../state/diagram-store';
import { ConfirmDialog } from './ConfirmDialog';
import { DiagramSwitchDialog } from './DiagramSwitchDialog';
import { SavedDiagramList } from './SavedDiagramList';
import { WorkspaceInspector, type CanvasSelection } from './WorkspaceInspector';
import { useState } from 'react';

export function DiagramWorkspace() {
  const document = useDiagramStore(state => state.document); const status = useDiagramStore(state => state.status); const startNew = useDiagramStore(state => state.startNew); const save = useDiagramStore(state => state.save); const loadSavedDocument = useDiagramStore(state => state.loadSavedDocument);
  const [confirmNew, setConfirmNew] = useState(false); const [pendingDiagramId, setPendingDiagramId] = useState<string | null>(null); const [libraryOpen, setLibraryOpen] = useState(true); const [inspectorMode, setInspectorMode] = useState<InspectorMode>(null); const [selection, setSelection] = useState<CanvasSelection>(null);
  const requestNewDiagram = () => { if (!document || status === 'saving') return; if (status === 'unsaved' || status === 'failed') { setConfirmNew(true); return; } startNew(); };
  const load = async (id: string) => { await loadSavedDocument(id); };
  const requestLoad = (id: string) => { if (status === 'saving') return; if (document && document.id !== id && (status === 'unsaved' || status === 'failed')) { setPendingDiagramId(id); return; } void load(id); };
  const saveAndLoad = async () => { if (!pendingDiagramId) return; await save(); if (useDiagramStore.getState().status === 'saved') { const id = pendingDiagramId; setPendingDiagramId(null); await load(id); } };
  const discardAndLoad = () => { if (!pendingDiagramId) return; const id = pendingDiagramId; setPendingDiagramId(null); void load(id); };
  const selectCanvasItem = (next: CanvasSelection) => { setSelection(next); setInspectorMode(null); };
  const openInspector = (mode: Exclude<InspectorMode, null>) => { setSelection(null); setInspectorMode(mode); };
  const closeInspector = () => { setSelection(null); setInspectorMode(null); };
  return <div className={`app-shell ${libraryOpen ? 'library-open' : 'library-closed'}`}>
    <a className="skip-link" href="#diagram-workspace">Skip to diagram workspace</a>
    <nav className="global-nav" aria-label="Global navigation"><a className="brand" href="/" aria-label="ADR Diagram home"><span className="brand-mark" aria-hidden="true">◇</span> ADR Diagram</a><div className="global-links"><a href="#diagrams">Diagrams</a><a href="#decisions">Decisions</a><a href="#help">Help</a></div><button className="nav-utility" type="button">Workspace</button></nav>
    <div className="sub-nav"><div><span className="eyebrow">Architecture workspace</span><h1>Make structure visible.</h1></div><div className="sub-nav-actions"><span className="quiet-note">Single-user workspace</span><button className="primary-pill" type="button" onClick={requestNewDiagram} disabled={!document || status === 'saving'}>New diagram</button></div></div>
    <div className="workspace"><aside className="workspace-sidebar" aria-label="Diagram overview"><div className="library-heading"><div><span className="eyebrow">Your artifacts</span><h2>Diagrams</h2></div><button className="icon-button" type="button" onClick={() => setLibraryOpen(false)} aria-label="Close diagrams panel">×</button></div><div className="current-diagram"><span className="card-kicker">Current diagram</span><strong>{document?.name ?? 'No diagram yet'}</strong><span className="card-meta">{document ? `${document.components.length} components · ${document.relationships.length} relationships` : 'Create a diagram to begin'}</span></div><SavedDiagramList onSelect={requestLoad} onCreate={startNew} /></aside>
      <section className="editor-area" id="diagram-workspace" aria-label="Diagram editor"><DiagramToolbar onOpenInspector={openInspector} onToggleLibrary={() => setLibraryOpen(open => !open)} libraryOpen={libraryOpen} /><div className="canvas-workspace"><DiagramCanvas onSelection={selectCanvasItem} /><WorkspaceInspector mode={inspectorMode} selection={selection} onClose={closeInspector} /></div></section></div>
    {confirmNew && <ConfirmDialog title="Discard unsaved changes?" message="Your current diagram has changes that have not been saved. Discard them and create a new diagram?" confirmLabel="Discard and create" onConfirm={() => { startNew(); setConfirmNew(false); }} onCancel={() => setConfirmNew(false)} />}
    {pendingDiagramId && <DiagramSwitchDialog onSaveAndLoad={() => void saveAndLoad()} onDiscardAndLoad={discardAndLoad} onCancel={() => setPendingDiagramId(null)} />}
  </div>;
}
