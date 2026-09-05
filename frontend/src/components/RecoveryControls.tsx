import { useState } from 'react';
import { DiagramApiError, diagramClient } from '../api/diagram-client';
import { useDiagramStore } from '../state/diagram-store';
import { ConfirmDialog } from './ConfirmDialog';
import './recovery.css';

type Selection = { kind: 'component' | 'relationship'; id: string } | null;

export function RecoveryControls({ selection }: { selection: Selection }) {
  const document = useDiagramStore(state => state.document);
  const update = useDiagramStore(state => state.update);
  const removeRelationship = useDiagramStore(state => state.removeRelationship);
  const [removal, setRemoval] = useState<{ componentId: string; name: string; relationshipCount: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState('');
  const [trash, setTrash] = useState<{ id: string; name: string }[]>([]);
  if (!document) return null;
  const component = selection?.kind === 'component' ? document.components.find(item => item.id === selection.id) : undefined;
  const relationship = selection?.kind === 'relationship' ? document.relationships.find(item => item.id === selection.id) : undefined;
  const requestComponentRemoval = async () => {
    if (!component) return;
    setChecking(true); setRemoval(null); setNotice('Checking component relationships…');
    try { const count = await diagramClient.dependencyCount(document.id, component.id); setRemoval({ componentId: component.id, name: component.name, relationshipCount: count.relationshipCount }); setNotice(''); }
    catch (error) { setNotice(error instanceof Error ? `Could not check relationships: ${error.message}` : 'Could not check relationships. Try again.'); }
    finally { setChecking(false); }
  };
  const removeComponent = async () => {
    if (!removal || removing) return;
    setRemoving(true);
    try { const result = await diagramClient.removeComponent(document.id, removal.componentId); update(() => result.document); setRemoval(null); setNotice(`${component?.name ?? 'Component'} removed. Undo available.`); }
    catch (error) { setNotice(error instanceof DiagramApiError && error.status === 409 ? `Cannot remove ${removal.name}: ${error.message}` : error instanceof Error ? `Could not remove ${removal.name}: ${error.message}` : `Could not remove ${removal.name}.`); setRemoval(null); }
    finally { setRemoving(false); }
  };
  const moveToTrash = async () => { await diagramClient.trash(document.id); setNotice('Diagram moved to trash.'); setTrash(await diagramClient.listTrash()); };
  const restore = async (id: string) => { const restored = await diagramClient.restore(id); setTrash(await diagramClient.listTrash()); setNotice(`${restored.name} restored.`); };
  const endpointName = (id: string) => document.components.find(item => item.id === id)?.name ?? 'Unknown component';
  return <section className="inspector-recovery" aria-label="Selected item actions">
    {component && <><p className="inspector-meta">Component</p><h2>{component.name}</h2><p className="inspector-copy">Select and drag this building block on the canvas to refine its position.</p><button className="danger-action" type="button" onClick={() => void requestComponentRemoval()} disabled={checking}>{checking ? 'Checking…' : 'Delete component'}</button></>}
    {relationship && <><p className="inspector-meta">Relationship</p><h2>{endpointName(relationship.sourceComponentId)} <span aria-hidden="true">→</span> {endpointName(relationship.targetComponentId)}</h2><dl className="relationship-details"><div><dt>Label</dt><dd>{relationship.label || 'No label'}</dd></div><div><dt>Direction</dt><dd>{relationship.direction}</dd></div></dl><button className="danger-action" type="button" onClick={() => { removeRelationship(relationship.id); setNotice('Relationship removed. Undo available.'); }}>Delete relationship</button></>}
    {!selection && <><p className="inspector-meta">Nothing selected</p><h2>Choose an item</h2><p className="inspector-copy">Select a component or relationship on the canvas to view its details and actions.</p></>}
    <details className="diagram-management"><summary>Diagram management</summary><div><button className="text-action" type="button" onClick={() => void diagramClient.listTrash().then(setTrash)}>View trash</button><button className="danger-action" type="button" onClick={() => void moveToTrash()}>Move diagram to trash</button></div>{trash.map(item => <div className="trash-item" key={item.id}><span>{item.name}</span><button className="text-action" type="button" onClick={() => void restore(item.id)}>Restore</button></div>)}</details>
    <output className="recovery-notice" aria-live="polite">{notice}</output>
    {removal && (removal.relationshipCount > 0 ? <ConfirmDialog title="Remove relationships first" message={`${removal.name} has ${removal.relationshipCount} attached relationship${removal.relationshipCount === 1 ? '' : 's'}. Remove those relationships separately before removing this component.`} onCancel={() => setRemoval(null)} /> : <ConfirmDialog title="Remove component" message={`Remove ${removal.name}? This component has no attached relationships.`} confirmLabel={removing ? 'Removing…' : 'Remove component'} onConfirm={() => void removeComponent()} onCancel={() => { if (!removing) setRemoval(null); }} />)}
  </section>;
}
