import { useEffect, useState, type FormEvent } from 'react';
import { getC4ArtifactTypeLabel, type ContainerContext, type DiagramDocument } from '../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { useDiagramStore } from '../state/diagram-store';

export function ExternalParticipantPicker({ document, onClose }: { document:DiagramDocument; onClose:()=>void }) {
  const [context,setContext]=useState<ContainerContext|null>(null),[source,setSource]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let current=true;setContext(null);setSource('');setError('');diagramClient.containerContext(document.id).then(value=>{if(current)setContext(value);}).catch(error=>{if(current)setError(error instanceof Error?error.message:'Could not load parent participants.');});return()=>{current=false;};},[document.id,retry]);
  const submit=(event:FormEvent)=>{event.preventDefault();if(!context||!useDiagramStore.getState().includeExternalParticipant(source,context)){setError(useDiagramStore.getState().error??'Choose an eligible participant.');return;}onClose();};
  const included=new Set(document.components.filter(c=>c.role==='external').map(c=>c.sourceComponentId));
  return <form className="inspector-form" onSubmit={submit}><p className="inspector-copy">Include a Person or Software System from the parent. Its details stay linked to the source; its position belongs to this diagram.</p><label htmlFor="external-participant">External participant</label><select id="external-participant" value={source} disabled={!context} onChange={e=>setSource(e.target.value)}><option value="">Choose a participant…</option>{context?.sources.filter(c=>c.id!==document.scope?.softwareSystemId).map(c=><option key={c.id} value={c.id} disabled={included.has(c.id)}>{c.name} · {getC4ArtifactTypeLabel(c.type)} · {c.id}{included.has(c.id)?' (already included)':''}</option>)}</select>{!context&&!error&&<p role="status">Loading parent participants…</p>}{error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}<button className="primary-pill" type="submit" disabled={!context||!source||included.has(source)}>Include participant</button><button type="button" onClick={onClose}>Cancel</button></form>;
}
