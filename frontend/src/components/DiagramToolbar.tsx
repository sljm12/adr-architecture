import { ExportButton } from './ExportButton';
import { SaveStatus } from './SaveStatus';
import { describeGroupSelection, useDiagramStore } from '../state/diagram-store';
import { getC4ArtifactTypeLabel } from '../../../shared/src/index';

export type InspectorMode = 'component' | 'relationship' | 'adr' | 'group' | null;

export function DiagramToolbar({ onOpenInspector, onToggleLibrary, libraryOpen, selectedComponentIds = [] }: { onOpenInspector: (mode: Exclude<InspectorMode, null>) => void; onToggleLibrary: () => void; libraryOpen: boolean; selectedComponentIds?: string[] }) {
  const document = useDiagramStore(state => state.document);
  const status = useDiagramStore(state => state.status);
  const save = useDiagramStore(state => state.save);
  const undo = useDiagramStore(state => state.undo);
  const redo = useDiagramStore(state => state.redo);
  const canUndo = useDiagramStore(state => state.canUndo);
  const canRedo = useDiagramStore(state => state.canRedo);
  const selectedComponents = document?.components.filter(component => selectedComponentIds.includes(component.id)) ?? [];
  const selectionError = document ? describeGroupSelection(document, selectedComponentIds) : null;
  const canGroupSelection = selectedComponents.length >= 2 && !selectionError;
  const groupSelectionLabel = canGroupSelection ? 'Group selected systems' : selectionError ?? 'Select at least two Software System components';
  const selectionSummary = selectedComponents.length > 0
    ? `Selected for grouping: ${selectedComponents.map(component => `${component.name} (${getC4ArtifactTypeLabel(component.type)})`).join(', ')}.`
    : '';
  return <header className="command-bar">
    <div className="command-bar-title"><button className="icon-button library-toggle" type="button" onClick={onToggleLibrary} aria-label={libraryOpen ? 'Hide diagrams panel' : 'Show diagrams panel'} aria-pressed={libraryOpen}>☰</button><div><span className="eyebrow">Architecture diagram</span><strong>{document?.name ?? 'Diagram studio'}</strong></div><SaveStatus /></div>
    <div className="command-bar-actions">{document && <><button className="secondary-action" type="button" onClick={() => onOpenInspector('component')}>Add component</button><button className="secondary-action" type="button" onClick={() => onOpenInspector('relationship')}>Connect</button><button className="secondary-action" type="button" onClick={() => onOpenInspector('group')} disabled={!canGroupSelection} aria-describedby={selectedComponents.length > 0 ? 'group-selection-feedback' : undefined} aria-label={groupSelectionLabel} title={groupSelectionLabel}>Group selected systems</button><button className="secondary-action" type="button" onClick={() => onOpenInspector('adr')}>Decision</button></>}<button className="icon-button" type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button><button className="icon-button" type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">↷</button>{document && <button className="primary-pill" type="button" onClick={() => void save()} disabled={status === 'saving'}>Save</button>}{document && <ExportButton />}</div>
    {selectedComponents.length > 0 && <p id="group-selection-feedback" className={`selection-feedback${selectionError ? ' selection-feedback-error' : ''}`} role={selectionError ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">{selectionSummary} {selectionError ?? 'Ready to group these Software Systems.'}</p>}
  </header>;
}
