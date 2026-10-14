import { useEffect, useState, type FormEvent } from 'react';
import { getComponentTypeLabel, getDiagramOwnerId, type ContainerContext, type ComponentContext, type DiagramDocument } from '../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { useDiagramStore } from '../state/diagram-store';

export function ExternalParticipantPicker({ document, onClose }: { document:DiagramDocument; onClose:()=>void }) {
  const [context,setContext]=useState<ContainerContext|ComponentContext|null>(null),[source,setSource]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const contextKey = `${document.id}:${document.kind}:${retry}`;
  const [previousContextKey, setPreviousContextKey] = useState(contextKey);
  if (contextKey !== previousContextKey) { setPreviousContextKey(contextKey); setContext(null); setSource(''); setError(''); }
  useEffect(()=>{let current=true;(document.kind==='component'?diagramClient.componentContext(document.id):diagramClient.containerContext(document.id)).then(value=>{if(current)setContext(value);}).catch(error=>{if(current)setError(error instanceof Error?error.message:'Could not load parent participants.');});return()=>{current=false;};},[document.id,document.kind,retry]);
  const submit=(event:FormEvent)=>{event.preventDefault();if(!context||!useDiagramStore.getState().includeExternalParticipant(source,context)){setError(useDiagramStore.getState().error??'Choose an eligible participant.');return;}onClose();};
  const canonical=(id:string)=>{const source=context?.sources.find(c=>c.id===id);return source&&'canonicalSourceComponentId' in source?source.canonicalSourceComponentId:id;};
  const included=new Set(document.components.filter(c=>c.role==='external').map(c=>canonical(c.sourceComponentId!)));
  return <form className="inspector-form" onSubmit={submit}><p className="inspector-copy">Include {document.kind==='component'?'a sibling Application or Datastore, Person or Software System':'a Person or Software System'} from the parent. Details stay linked to the source; position and interactions belong to this diagram.</p><label htmlFor="external-participant">External participant</label><select id="external-participant" value={source} disabled={!context} onChange={e=>setSource(e.target.value)}><option value="">Choose a participant…</option>{context?.sources.filter(c=>c.id!==getDiagramOwnerId(document)).map(c=><option key={c.id} value={c.id} disabled={included.has(canonical(c.id))}>{c.name} · {getComponentTypeLabel({type:c.type,role:'external',containerType:'containerType' in c?c.containerType:null})}{'technology' in c&&c.technology?` · ${c.technology}`:''} · {c.id}{included.has(canonical(c.id))?' (already included)':''}</option>)}</select>{!context&&!error&&<p role="status">Loading parent participants…</p>}{error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}<button className="primary-pill" type="submit" disabled={!context||!source||included.has(canonical(source))}>Include participant</button><button type="button" onClick={onClose}>Cancel</button></form>;
}
