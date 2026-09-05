import { ExportButton } from './ExportButton';
import { SaveStatus } from './SaveStatus';
import { useDiagramStore } from '../state/diagram-store';

export type InspectorMode = 'component' | 'relationship' | null;

export function DiagramToolbar({ onOpenInspector, onToggleLibrary, libraryOpen }: { onOpenInspector: (mode: Exclude<InspectorMode, null>) => void; onToggleLibrary: () => void; libraryOpen: boolean }) {
  const document = useDiagramStore(state => state.document);
  const status = useDiagramStore(state => state.status);
  const save = useDiagramStore(state => state.save);
  const undo = useDiagramStore(state => state.undo);
  const redo = useDiagramStore(state => state.redo);
  const canUndo = useDiagramStore(state => state.canUndo);
  const canRedo = useDiagramStore(state => state.canRedo);

  return <header className="command-bar">
    <div className="command-bar-title">
      <button className="icon-button library-toggle" type="button" onClick={onToggleLibrary} aria-label={libraryOpen ? 'Hide diagrams panel' : 'Show diagrams panel'} aria-pressed={libraryOpen}>☰</button>
      <div><span className="eyebrow">Architecture diagram</span><strong>{document?.name ?? 'Diagram studio'}</strong></div>
      <SaveStatus />
    </div>
    <div className="command-bar-actions">
      {document && <><button className="secondary-action" type="button" onClick={() => onOpenInspector('component')}>Add component</button><button className="secondary-action" type="button" onClick={() => onOpenInspector('relationship')}>Connect</button></>}
      <button className="icon-button" type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button>
      <button className="icon-button" type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">↷</button>
      {document && <button className="primary-pill" type="button" onClick={() => void save()} disabled={status === 'saving'}>Save</button>}
      {document && <ExportButton />}
    </div>
  </header>;
}
