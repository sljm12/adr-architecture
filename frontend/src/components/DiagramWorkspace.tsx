import { DiagramToolbar } from './DiagramToolbar';
import { DiagramCanvas } from './DiagramCanvas';
import { useDiagramStore } from '../state/diagram-store';
import { ConfirmDialog } from './ConfirmDialog';
import { DiagramSwitchDialog } from './DiagramSwitchDialog';
import { SavedDiagramList } from './SavedDiagramList';
import { useState } from 'react';

export function DiagramWorkspace() {
  const document = useDiagramStore(state => state.document);
  const status = useDiagramStore(state => state.status);
  const startNew = useDiagramStore(state => state.startNew);
  const save = useDiagramStore(state => state.save);
  const loadSavedDocument = useDiagramStore(state => state.loadSavedDocument);
  const [confirmNew, setConfirmNew] = useState(false);
  const [pendingDiagramId, setPendingDiagramId] = useState<string | null>(null);
  const requestNewDiagram = () => {
    if (!document || status === 'saving') return;
    if (status === 'unsaved' || status === 'failed') {
      setConfirmNew(true);
      return;
    }
    startNew();
  };
  const load = async (id: string) => { await loadSavedDocument(id); };
  const requestLoad = (id: string) => { if (status === 'saving') return; if (document && document.id !== id && (status === 'unsaved' || status === 'failed')) { setPendingDiagramId(id); return; } void load(id); };
  const saveAndLoad = async () => { if (!pendingDiagramId) return; await save(); if (useDiagramStore.getState().status === 'saved') { const id = pendingDiagramId; setPendingDiagramId(null); await load(id); } };
  const discardAndLoad = () => { if (!pendingDiagramId) return; const id = pendingDiagramId; setPendingDiagramId(null); void load(id); };

  return <div className="app-shell">
    <a className="skip-link" href="#diagram-workspace">Skip to diagram workspace</a>
    <nav className="global-nav" aria-label="Global navigation">
      <a className="brand" href="/" aria-label="ADR Diagram home"><span className="brand-mark" aria-hidden="true">◇</span> ADR Diagram</a>
      <div className="global-links"><a href="#diagrams">Diagrams</a><a href="#decisions">Decisions</a><a href="#help">Help</a></div>
      <button className="nav-utility" type="button">Workspace</button>
    </nav>
    <div className="sub-nav">
      <div><span className="eyebrow">Architecture workspace</span><h1>{document?.name ?? 'Diagram studio'}</h1></div>
      <div className="sub-nav-actions"><span className="quiet-note">Single-user workspace</span><button className="primary-pill" type="button" onClick={requestNewDiagram} disabled={!document || status === 'saving'}>New Diagram</button></div>
    </div>
    <div className="workspace">
      <aside className="workspace-sidebar" aria-label="Diagram overview">
        <div className="sidebar-intro"><span className="eyebrow">Your artifacts</span><h2>Make structure visible.</h2><p>Shape a clear architecture map, then let every decision point back to it.</p></div>
        <div className="sidebar-card"><span className="card-kicker">Current diagram</span><strong>{document?.name ?? 'No diagram yet'}</strong><span className="card-meta">{document ? `${document.components.length} components · ${document.relationships.length} relationships` : 'Create a diagram to begin'}</span></div>
        <div className="sidebar-card sidebar-card-dark"><span className="card-kicker">Keyboard tip</span><strong>Keep moving</strong><span className="card-meta">Drag components to refine the story, then choose Save when you are ready.</span></div>
        <SavedDiagramList onSelect={requestLoad} onCreate={startNew} />
      </aside>
      <section className="editor-area" id="diagram-workspace" aria-label="Diagram editor">
        <DiagramToolbar />
        <DiagramCanvas />
      </section>
    </div>
    {confirmNew && <ConfirmDialog title="Discard unsaved changes?" message="Your current diagram has changes that have not been saved. Discard them and create a new diagram?" confirmLabel="Discard and create" onConfirm={() => { startNew(); setConfirmNew(false); }} onCancel={() => setConfirmNew(false)} />}
    {pendingDiagramId && <DiagramSwitchDialog onSaveAndLoad={() => void saveAndLoad()} onDiscardAndLoad={discardAndLoad} onCancel={() => setPendingDiagramId(null)} />}
  </div>;
}
