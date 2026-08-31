import type { DiagramDocument, Position } from '../../../../shared/src/index'; import type { Edge, Node } from '@xyflow/react';
export type HandleSide='top'|'right'|'bottom'|'left';
export type RelationshipRouting={pairOffset:number;sourceFanOffset:number;targetFanOffset:number};
type Relationship=DiagramDocument['relationships'][number];
type RoutedRelationship={relationship:Relationship;source:HandleSide;target:HandleSide};
type Endpoint={relationshipId:string;componentId:string;peerId:string;side:HandleSide;role:'source'|'target'};
const PAIR_LANE_GAP=56;
const FAN_LANE_GAP=28;
export function nearestHandle(source:Position,target:Position):{source:HandleSide;target:HandleSide}{const dx=target.x-source.x;const dy=target.y-source.y;if(Math.abs(dx)>=Math.abs(dy))return dx>=0?{source:'right',target:'left'}:{source:'left',target:'right'};return dy>=0?{source:'bottom',target:'top'}:{source:'top',target:'bottom'};}
const compareRelationships=(a:Relationship,b:Relationship)=>a.sourceComponentId.localeCompare(b.sourceComponentId)||a.targetComponentId.localeCompare(b.targetComponentId)||a.id.localeCompare(b.id);
const pairKey=(relationship:Relationship)=>[relationship.sourceComponentId,relationship.targetComponentId].sort().join(':');
const centeredOffsets=(count:number,gap:number)=>Array.from({length:count},(_,index)=>(index-(count-1)/2)*gap);

function assignRouting(relationships:RoutedRelationship[]):Map<string,RelationshipRouting>{
  const routing=new Map(relationships.map(({relationship})=>[relationship.id,{pairOffset:0,sourceFanOffset:0,targetFanOffset:0}]));
  const pairs=new Map<string,RoutedRelationship[]>();
  const endpointGroups=new Map<string,Endpoint[]>();
  for(const routed of relationships){
    const pair=pairs.get(pairKey(routed.relationship))??[];
    pair.push(routed);pairs.set(pairKey(routed.relationship),pair);
    const endpoints:Endpoint[]=[
      {relationshipId:routed.relationship.id,componentId:routed.relationship.sourceComponentId,peerId:routed.relationship.targetComponentId,side:routed.source,role:'source'},
      {relationshipId:routed.relationship.id,componentId:routed.relationship.targetComponentId,peerId:routed.relationship.sourceComponentId,side:routed.target,role:'target'},
    ];
    for(const endpoint of endpoints){const key=`${endpoint.componentId}:${endpoint.side}`;const group=endpointGroups.get(key)??[];group.push(endpoint);endpointGroups.set(key,group);}
  }
  for(const group of pairs.values()){
    const ordered=[...group].sort((a,b)=>compareRelationships(a.relationship,b.relationship));
    const offsets=centeredOffsets(ordered.length,PAIR_LANE_GAP);
    for(const [index,routed] of ordered.entries()){
      const [firstId]=[routed.relationship.sourceComponentId,routed.relationship.targetComponentId].sort();
      const orientation=routed.relationship.sourceComponentId===firstId?1:-1;
      routing.get(routed.relationship.id)!.pairOffset=offsets[index]*orientation;
    }
  }
  for(const group of endpointGroups.values()){
    const ordered=[...group].sort((a,b)=>a.peerId.localeCompare(b.peerId)||a.role.localeCompare(b.role)||a.relationshipId.localeCompare(b.relationshipId));
    const offsets=centeredOffsets(ordered.length,FAN_LANE_GAP);
    for(const [index,endpoint] of ordered.entries()){
      const entry=routing.get(endpoint.relationshipId)!;
      if(endpoint.role==='source')entry.sourceFanOffset=offsets[index];else entry.targetFanOffset=offsets[index];
    }
  }
  return routing;
}

export function toReactFlow(document:DiagramDocument):{nodes:Node[];edges:Edge[]}{
  const components=new Map(document.components.map(c=>[c.id,c]));
  const routed=document.relationships.map(relationship=>{const source=components.get(relationship.sourceComponentId);const target=components.get(relationship.targetComponentId);const handles=source&&target?nearestHandle(source.position,target.position):{source:'right' as HandleSide,target:'left' as HandleSide};return {relationship,...handles};});
  const routing=assignRouting(routed);
  return {nodes:document.components.map(c=>({id:c.id,position:c.position,data:{label:c.name},type:'component'})),edges:routed.map(({relationship,source,target})=>({id:relationship.id,type:'relationship',source:relationship.sourceComponentId,target:relationship.targetComponentId,sourceHandle:`source-${source}`,targetHandle:`target-${target}`,label:relationship.label??undefined,data:routing.get(relationship.id),markerEnd:relationship.direction==='directed'?{type:'arrowclosed'}:undefined}))};
}
export function fromReactFlow(document:DiagramDocument,nodes:Node[]):DiagramDocument{return {...document,components:document.components.map(c=>{const n=nodes.find(x=>x.id===c.id);return n?{...c,position:n.position}:c;})};}
