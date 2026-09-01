import { useState } from 'react';
import { DiagramApiError, diagramClient } from '../api/diagram-client';
import { useDiagramStore } from '../state/diagram-store';
import { ConfirmDialog } from './ConfirmDialog';
import './recovery.css';

export function RecoveryControls() {
  const document = useDiagramStore(state => state.document);
  const update = useDiagramStore(state => state.update);
  const undo = useDiagramStore(state => state.undo);
  const redo = useDiagramStore(state => state.redo);
  const removeRelationship = useDiagramStore(state => state.removeRelationship);
  const canUndo = useDiagramStore(state => state.canUndo);
  const canRedo = useDiagramStore(state => state.canRedo);
  const [componentId, setComponentId] = useState('');
  const [relationshipId, setRelationshipId] = useState('');
  const [removal, setRemoval] = useState<{ componentId: string; name: string; relationshipCount: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState('');
  const [trash, setTrash] = useState<{ id: string; name: string }[]>([]);

  if (!document) return null;
  const requestComponentRemoval = async () => {
    if (!componentId) return;
    const selectedId = componentId;
    const component = document.components.find(item => item.id === selectedId);
    if (!component) return;
    setChecking(true); setRemoval(null); setNotice('Checking component relationships…');
    try {
      const count = await diagramClient.dependencyCount(document.id, selectedId);
      setRemoval({ componentId: selectedId, name: component.name, relationshipCount: count.relationshipCount });
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not check relationships: ${error.message}` : 'Could not check relationships. Try again.');
    } finally { setChecking(false); }
  };
  const removeComponent = async () => {
    if (!removal || removing) return;
    setRemoving(true);
    try {
      const result = await diagramClient.removeComponent(document.id, removal.componentId);
      update(() => result.document); setComponentId(''); setRemoval(null);
      setNotice(`${removal.name} removed. Undo available.`);
    } catch (error) {
      const message = error instanceof DiagramApiError && error.status === 409
        ? `Cannot remove ${removal.name}: ${error.message}`
        : error instanceof Error ? `Could not remove ${removal.name}: ${error.message}` : `Could not remove ${removal.name}. Try again.`;
      setRemoval(null); setNotice(message);
    } finally { setRemoving(false); }
  };
  const removeSelectedRelationship = () => {
    const relationship = document.relationships.find(item => item.id === relationshipId);
    if (!relationship) return;
    removeRelationship(relationship.id); setRelationshipId('');
    setNotice(`Relationship${relationship.label ? ` “${relationship.label}”` : ''} removed. Undo available.`);
  };
  const moveToTrash = async () => { await diagramClient.trash(document.id); setNotice('Diagram moved to trash.'); setTrash(await diagramClient.listTrash()); };
  const restore = async (id: string) => { const restored = await diagramClient.restore(id); setTrash(await diagramClient.listTrash()); setNotice(`${restored.name} restored.`); };

  return <section className="recovery-controls" aria-label="Recovery controls">
    <div className="recovery-actions">
      <button className="recovery-button recovery-button-secondary" type="button" onClick={undo} disabled={!canUndo}>Undo</button>
      <button className="recovery-button recovery-button-secondary" type="button" onClick={redo} disabled={!canRedo}>Redo</button>
      <select className="recovery-select" aria-label="Component to remove" value={componentId} onChange={event => setComponentId(event.target.value)}><option value="">Remove component…</option>{document.components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}</select>
      <button className="recovery-button" type="button" onClick={() => void requestComponentRemoval()} disabled={!componentId || checking}>{checking ? 'Checking…' : 'Remove component'}</button>
      <button className="recovery-button" type="button" onClick={() => void moveToTrash()}>Move diagram to trash</button>
    </div>
    <div className="recovery-actions">
      <select className="recovery-select" aria-label="Relationship to remove" value={relationshipId} onChange={event => setRelationshipId(event.target.value)}><option value="">Remove relationship…</option>{document.relationships.map(relationship => <option key={relationship.id} value={relationship.id}>{relationship.label ?? `${relationship.sourceComponentId.slice(0, 8)} → ${relationship.targetComponentId.slice(0, 8)}`}</option>)}</select>
      <button className="recovery-button recovery-button-secondary" type="button" onClick={removeSelectedRelationship} disabled={!relationshipId}>Remove relationship</button>
    </div>
    <button className="recovery-button recovery-button-secondary" type="button" onClick={() => void diagramClient.listTrash().then(setTrash)}>View trash</button>
    {trash.map(item => <div className="trash-item" key={item.id}><span>{item.name}</span><button className="recovery-button recovery-button-secondary" type="button" onClick={() => void restore(item.id)}>Restore</button></div>)}
    <output className="recovery-notice" aria-live="polite">{notice}</output>
    {checking && <p className="recovery-notice" role="status">Checking relationships before removal…</p>}
    {removal && (removal.relationshipCount > 0
      ? <ConfirmDialog title="Remove relationships first" message={`${removal.name} has ${removal.relationshipCount} attached relationship${removal.relationshipCount === 1 ? '' : 's'}. Remove those relationships separately before removing this component.`} onCancel={() => setRemoval(null)} />
      : <ConfirmDialog title="Remove component" message={`Remove ${removal.name}? This component has no attached relationships.`} confirmLabel={removing ? 'Removing…' : 'Remove component'} onConfirm={() => void removeComponent()} onCancel={() => { if (!removing) setRemoval(null); }} />)}
  </section>;
}
