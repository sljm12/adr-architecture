import { useEffect, useState } from 'react';
import { getComponentScope, getComponentTypeLabel, type Component, type ComponentContext, type DiagramDocument } from '../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';

export function SupportingParticipantDetails({ document, component }: { document: DiagramDocument; component: Component }) {
  const [context, setContext] = useState<ComponentContext | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true; setContext(null); setError('');
    if (document.kind === 'component') diagramClient.componentContext(document.id).then(value => { if (current) setContext(value); }).catch(error => { if (current) setError(error instanceof Error ? error.message : 'Could not resolve the source.'); });
    return () => { current = false; };
  }, [document.id, document.kind, component.id, component.sourceComponentId, retry]);
  const source = context?.sources.find(source => source.id === component.sourceComponentId);
  const details = source ? { ...component, ...source, role: 'external' as const } : component;
  const destination = document.kind === 'component' ? source?.sourceDiagramId : document.scope?.parentDiagramId;
  const sourceId = document.kind === 'component' ? source?.canonicalSourceComponentId : component.sourceComponentId;
  const openSource = () => { if (destination && sourceId) window.dispatchEvent(new CustomEvent('adr:open-source-parent', { detail: { diagramId: destination, componentId: sourceId } })); };
  return <section className="artifact-edit-panel" aria-label="External participant details">
    <h3>{details.name}</h3><p>{getComponentTypeLabel(details)} · Supporting participant</p>
    <p className="component-responsibility">{details.description}</p>{details.technology && <p>Technology: {details.technology}</p>}
    <p>Source details are read-only. Edit them in {document.kind === 'component' && source?.sourceDiagramId === getComponentScope(document)?.systemContextDiagramId ? 'System Context' : document.scope?.parentDiagramName}.</p>
    <p className="inspector-meta">Immediate source: {component.sourceComponentId}</p>{source && <p className="inspector-meta">Canonical source: {source.canonicalSourceComponentId}</p>}
    {document.kind === 'component' && !context && !error && <p role="status">Resolving source…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry source lookup</button></p>}
    {context && !source && <p role="alert">The immediate source is no longer eligible. Repair it in the parent Container.</p>}
    <button type="button" className="text-action" disabled={!destination || !sourceId} onClick={openSource}>{document.kind === 'component' ? 'Edit source' : 'Edit source in parent'}</button>
  </section>;
}
