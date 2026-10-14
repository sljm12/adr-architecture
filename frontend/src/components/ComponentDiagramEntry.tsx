import { useEffect, useState } from 'react';
import type { Component, ComponentAvailability, DiagramDocument } from '../../../shared/src/index';
import { isContainerType } from '../../../shared/src/index';
import { diagramClient, formatDiagramApiError } from '../api/diagram-client';
import { useDiagramStore } from '../state/diagram-store';

export function canEnterComponentDiagram(document: DiagramDocument, component: Component): boolean {
  return component.type === 'container' && isContainerType(component.containerType) && (document.kind === 'container' ? component.role === 'container' : document.kind === 'component' && component.role === 'external' && !!component.sourceComponentId);
}

export function ComponentDiagramEntry({ document, component }: { document: DiagramDocument; component: Component }) {
  const status = useDiagramStore(state => state.status);
  const openStatus = useDiagramStore(state => state.componentOpenStatus);
  const openError = useDiagramStore(state => state.componentOpenError);
  const targetId = useDiagramStore(state => state.componentOpenComponentId);
  const resolved = useDiagramStore(state => state.componentAvailability);
  const [availability, setAvailability] = useState<ComponentAvailability | null>(null);
  const [checking, setChecking] = useState(status === 'saved');
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const availabilityKey = `${document.id}:${component.id}:${component.sourceComponentId}:${status}:${retry}`;
  const [previousAvailabilityKey, setPreviousAvailabilityKey] = useState(availabilityKey);
  if (availabilityKey !== previousAvailabilityKey) { setPreviousAvailabilityKey(availabilityKey); setAvailability(null); setError(null); setChecking(status === 'saved'); }
  useEffect(() => {
    if (status !== 'saved') return;
    let current = true;
    diagramClient.componentAvailability(document.id, component.id).then(value => { if (current) setAvailability(value); }).catch(error => { if (current) setError(formatDiagramApiError(error)); }).finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, [document.id, component.id, component.sourceComponentId, status, retry]);
  const current = targetId === component.id && resolved ? resolved : availability;
  const busy = checking && !current || openStatus === 'loading';
  const activate = () => {
    if (current?.availability === 'trashed' && current.diagram) window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind: 'restore', id: current.diagram.id } }));
    else window.dispatchEvent(new CustomEvent('adr:open-component-diagram', { detail: { componentId: component.id } }));
  };
  return <section className="container-diagram-entry" aria-label="Create or open component diagram">
    <button type="button" className="secondary-action" disabled={busy} onClick={activate}>{checking && !current ? 'Checking component diagram…' : current?.availability === 'active' ? 'Open component diagram' : current?.availability === 'trashed' ? 'Restore component diagram' : 'Create component diagram'}</button>
    {current?.availability === 'trashed' && <p className="container-entry-feedback" role="status">Restore “{current.diagram?.name ?? component.name}” from Trash to reopen its Component diagram.</p>}
    {error && <p className="container-entry-feedback" role="status">{error} <button type="button" className="text-action" onClick={() => setRetry(value => value + 1)}>Retry availability</button></p>}
    {targetId === component.id && openStatus === 'loading' && <p className="container-entry-feedback" role="status" aria-live="polite">Opening the canonical Component diagram…</p>}
    {targetId === component.id && openStatus === 'failed' && <p className="container-entry-feedback" role="alert">{openError} <button type="button" className="text-action" onClick={activate}>Retry</button></p>}
  </section>;
}
