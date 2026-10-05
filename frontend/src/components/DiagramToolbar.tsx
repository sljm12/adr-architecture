import { ExportButton } from './ExportButton';
import { SaveStatus } from './SaveStatus';
import { describeGroupSelection, useDiagramStore } from '../state/diagram-store';
import { getC4ArtifactTypeLabel } from '../../../shared/src/index';

export type InspectorMode = 'component' | 'relationship' | 'adr' | 'group' | 'external' | null;

export function DiagramToolbar({ onOpenInspector, onToggleLibrary, libraryOpen, onToggleInspector, inspectorOpen, selectedComponentIds = [] }: { onOpenInspector: (mode: Exclude<InspectorMode, null>) => void; onToggleLibrary: () => void; libraryOpen: boolean; onToggleInspector: () => void; inspectorOpen: boolean; selectedComponentIds?: string[] }) {
  const document = useDiagramStore(state => state.document);
  const status = useDiagramStore(state => state.status);
  const save = useDiagramStore(state => state.save);
  const update = useDiagramStore(state => state.update);
  const savePending = useDiagramStore(state => state.savePending);
  const navigationStatus = useDiagramStore(state => state.navigationStatus);
  const refreshSourceDetails = useDiagramStore(state => state.refreshContainerContext);
  const sourceContextStatus = useDiagramStore(state => state.sourceContextStatus);
  const sourceContextError = useDiagramStore(state => state.sourceContextError);
  const undo = useDiagramStore(state => state.undo);
  const redo = useDiagramStore(state => state.redo);
  const canUndo = useDiagramStore(state => state.canUndo);
  const canRedo = useDiagramStore(state => state.canRedo);
  const containerOpenStatus = useDiagramStore(state => state.containerOpenStatus);
  const containerOpenError = useDiagramStore(state => state.containerOpenError);
  const containerOpenComponentId = useDiagramStore(state => state.containerOpenComponentId);
  const selectedComponents = document?.components.filter(component => selectedComponentIds.includes(component.id)) ?? [];
  const selectionError = document ? describeGroupSelection(document, selectedComponentIds) : null;
  const canGroupSelection = selectedComponents.length >= 2 && !selectionError;
  const groupSelectionLabel = canGroupSelection ? 'Group selected systems' : selectionError ?? 'Select at least two Software System components';
  const selectionSummary = selectedComponents.length > 0
    ? `Selected for grouping: ${selectedComponents.map(component => `${component.name} (${getC4ArtifactTypeLabel(component.type)})`).join(', ')}.`
    : '';
  const missingContainerOwnerNotice = containerOpenStatus === 'failed' && Boolean(containerOpenError) && !document?.components.some(component => component.id === containerOpenComponentId);
  return <header className="command-bar">
    <div className="command-bar-title"><button className="icon-button library-toggle" type="button" onClick={onToggleLibrary} aria-label={libraryOpen ? 'Hide diagrams panel' : 'Show diagrams panel'} aria-pressed={libraryOpen}>☰</button><div><span className="eyebrow">{document?.kind === 'container' ? 'Container diagram' : 'Architecture diagram'}</span><strong id={document?.kind === 'container' ? 'container-diagram-heading' : 'diagram-heading'} tabIndex={-1}>{document?.kind === 'container' ? document.scope?.softwareSystemName ?? document.name : document?.name ?? 'Diagram studio'}</strong></div><SaveStatus /></div>
    {document && <div className="diagram-context-controls"><label htmlFor="current-diagram-name">Diagram name</label><input id="current-diagram-name" value={document.name} maxLength={200} readOnly={document.kind === 'container'} aria-describedby={document.kind === 'container' ? 'container-diagram-name-help' : undefined} onChange={event => update(current => ({ ...current, name: event.target.value }))} />{document.kind === 'container' && document.scope && <><small id="container-diagram-name-help">Follows the Software System name.</small><button type="button" className="text-action" disabled={savePending || navigationStatus === 'loading' || containerOpenStatus === 'loading'} aria-label={`Return to ${document.scope.parentDiagramName}, owner ${document.scope.softwareSystemName}`} onClick={() => window.dispatchEvent(new CustomEvent('adr:open-source-parent', { detail: { diagramId: document.scope!.parentDiagramId, componentId: document.scope!.softwareSystemId } }))}>Return to {document.scope.parentDiagramName}</button><button type="button" className="text-action" onClick={() => void refreshSourceDetails()} disabled={sourceContextStatus === 'loading'}>Refresh source details</button></>}</div>}
    <div className="command-bar-actions">{document && <><button className="secondary-action primary-action" type="button" onClick={() => onOpenInspector('component')}>Add component</button><button className="secondary-action" type="button" onClick={() => onOpenInspector('relationship')}>Connect</button>{document.kind === 'container' && <button className="secondary-action" type="button" onClick={() => onOpenInspector('external')}>Include external participant</button>}{document.kind !== 'container' && <button className="secondary-action" type="button" onClick={() => onOpenInspector('group')} disabled={!canGroupSelection} aria-describedby={selectedComponents.length > 0 ? 'group-selection-feedback' : undefined} aria-label={groupSelectionLabel} title={groupSelectionLabel}>Group selected systems</button>}<button className="secondary-action" type="button" onClick={() => onOpenInspector('adr')}>Decision</button></>}<button className="icon-button" type="button" onClick={onToggleInspector} aria-label={inspectorOpen ? 'Hide Details panel' : 'Show Details panel'} aria-pressed={inspectorOpen}>▣</button><button className="icon-button" type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">↶</button><button className="icon-button" type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">↷</button>{document && <button className="secondary-action save-action" type="button" onClick={() => void save()} disabled={status === 'saving' || savePending || navigationStatus === 'loading' || containerOpenStatus === 'loading'}>Save</button>}{document && <ExportButton />}</div>
    {sourceContextStatus === 'loading' && <p className="container-navigation-feedback" role="status">Refreshing source details…</p>}
    {sourceContextError && <p className="container-navigation-feedback" role="alert">{sourceContextError} Use Refresh source details to retry.</p>}
    {selectedComponents.length > 0 && <p id="group-selection-feedback" className={`selection-feedback${selectionError ? ' selection-feedback-error' : ''}`} role={selectionError ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">{selectionSummary} {selectionError ?? 'Ready to group these Software Systems.'}</p>}
    {document?.kind === 'container' && document.components.length === 0 && <p className="container-empty-instruction" role="status">This Software System has no containers yet. Its diagram is saved and ready to model.</p>}
    {missingContainerOwnerNotice && <p className="container-navigation-feedback" role="status" aria-live="polite">{containerOpenError}</p>}
  </header>;
}
