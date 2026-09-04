import { DiagramToolbar } from './DiagramToolbar';
import { DiagramCanvas } from './DiagramCanvas';
import { useDiagramStore } from '../state/diagram-store';

export function DiagramWorkspace() {
  const document = useDiagramStore(state => state.document);

  return <div className="app-shell">
    <a className="skip-link" href="#diagram-workspace">Skip to diagram workspace</a>
    <nav className="global-nav" aria-label="Global navigation">
      <a className="brand" href="/" aria-label="ADR Diagram home"><span className="brand-mark" aria-hidden="true">◇</span> ADR Diagram</a>
      <div className="global-links"><a href="#diagrams">Diagrams</a><a href="#decisions">Decisions</a><a href="#help">Help</a></div>
      <button className="nav-utility" type="button">Workspace</button>
    </nav>
    <div className="sub-nav">
      <div><span className="eyebrow">Architecture workspace</span><h1>{document?.name ?? 'Diagram studio'}</h1></div>
      <div className="sub-nav-actions"><span className="quiet-note">Single-user workspace</span><button className="primary-pill" type="button" onClick={() => document?.id && window.location.reload()}>Reload view</button></div>
    </div>
    <div className="workspace">
      <aside className="workspace-sidebar" aria-label="Diagram overview">
        <div className="sidebar-intro"><span className="eyebrow">Your artifacts</span><h2>Make structure visible.</h2><p>Shape a clear architecture map, then let every decision point back to it.</p></div>
        <div className="sidebar-card"><span className="card-kicker">Current diagram</span><strong>{document?.name ?? 'No diagram yet'}</strong><span className="card-meta">{document ? `${document.components.length} components · ${document.relationships.length} relationships` : 'Create a diagram to begin'}</span></div>
        <div className="sidebar-card sidebar-card-dark"><span className="card-kicker">Keyboard tip</span><strong>Keep moving</strong><span className="card-meta">Drag components to refine the story, then choose Save when you are ready.</span></div>
      </aside>
      <section className="editor-area" id="diagram-workspace" aria-label="Diagram editor">
        <DiagramToolbar />
        <DiagramCanvas />
      </section>
    </div>
  </div>;
}
