import { DEFAULT_COMPONENT_SIZE, fitGroupBoundsAfterLayout, getAbsoluteMemberPosition, getRelativeMemberPosition, type DiagramDocument, type Position } from '../../../../shared/src/index'; import type { Edge, Node } from '@xyflow/react';
export type HandleSide='top'|'right'|'bottom'|'left';
export type RelationshipRouting={pairOffset:number;sourceFanOffset:number;targetFanOffset:number};
type Relationship=DiagramDocument['relationships'][number];
type RoutedRelationship={relationship:Relationship;source:HandleSide;target:HandleSide};
type Endpoint={relationshipId:string;componentId:string;peerId:string;side:HandleSide;role:'source'|'target'};
const PAIR_LANE_GAP=56;
const FAN_LANE_GAP=28;
export type ComponentSize={width:number;height:number};
export type ComponentSizeMap=ReadonlyMap<string,ComponentSize>;
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

const positiveDimension=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:fallback;
export function getReactFlowNodeSize(node:Pick<Node,'measured'|'width'|'height'|'style'>,fallback=DEFAULT_COMPONENT_SIZE):ComponentSize{
  const style=node.style??{};
  const styleWidth=typeof style.width==='number'?style.width:undefined;
  const styleHeight=typeof style.height==='number'?style.height:undefined;
  return {width:positiveDimension(node.measured?.width??node.width??styleWidth,fallback.width),height:positiveDimension(node.measured?.height??node.height??styleHeight,fallback.height)};
}
export function toReactFlow(document:DiagramDocument,sizes?:ComponentSizeMap):{nodes:Node[];edges:Edge[]}{
  const components=new Map(document.components.map(c=>[c.id,c]));
  const routed=document.relationships.map(relationship=>{const source=components.get(relationship.sourceComponentId);const target=components.get(relationship.targetComponentId);const handles=source&&target?nearestHandle(source.position,target.position):{source:'right' as HandleSide,target:'left' as HandleSide};return {relationship,...handles};});
  const routing=assignRouting(routed);
  const groups=[...(document.groups??[])].sort((a,b)=>a.id.localeCompare(b.id));
  const membership=new Map<string,string>();
  for(const group of groups)for(const componentId of group.memberComponentIds)membership.set(componentId,group.id);
  const groupNodes:Node[]=groups.map(group=>({
    id:group.id,
    position:group.position,
    data:{label:group.name,groupId:group.id,memberCount:group.memberComponentIds.length},
    type:'systemGroup',
    className:'system-group-node',
    style:{width:group.size.width,height:group.size.height},
    zIndex:-1,
    selectable:true,
    draggable:true,
    connectable:false,
    deletable:false,
  }));
  const componentNodes:Node[]=document.components.map(c=>{
    const groupId=membership.get(c.id); const group=groupId?groups.find(item=>item.id===groupId):undefined;
    const size=sizes?.get(c.id)??DEFAULT_COMPONENT_SIZE;
    const node:Node={id:c.id,position:group?getRelativeMemberPosition(c.position,group.position):c.position,data:{label:c.name},type:'component',style:{width:size.width,height:size.height}};
    node.data={...node.data,type:c.type,groupId};
    if(group){node.parentId=group.id;node.extent='parent';node.expandParent=true;}
    return node;
  });
  const nodes=[...groupNodes,...componentNodes];
  return {nodes,edges:routed.map(({relationship,source,target})=>({id:relationship.id,type:'relationship',source:relationship.sourceComponentId,target:relationship.targetComponentId,sourceHandle:`source-${source}`,targetHandle:`target-${target}`,label:relationship.label??undefined,data:routing.get(relationship.id),markerEnd:relationship.direction==='directed'?{type:'arrowclosed'}:undefined}))};
}
export function fromReactFlow(document:DiagramDocument,nodes:Node[]):DiagramDocument{
  const nodeById=new Map(nodes.map(node=>[node.id,node]));
  const groupsWithPositions=(document.groups??[]).map(group=>{const node=nodeById.get(group.id);return node?{...group,position:{x:node.position.x,y:node.position.y}}:group;});
  const groupByMember=new Map<string,typeof groupsWithPositions[number]>();
  for(const group of groupsWithPositions)for(const componentId of group.memberComponentIds)groupByMember.set(componentId,group);
  const components=document.components.map(component=>{
    const node=nodeById.get(component.id); if(!node)return component;
    const group=groupByMember.get(component.id);
    const absolute=group?getAbsoluteMemberPosition(node.position,group.position):node.position;
    return {...component,position:absolute};
  });
  const groups=groupsWithPositions.map(group=>{
    if(!nodeById.has(group.id))return group;
    const members=group.memberComponentIds.flatMap(componentId=>{
      const component=components.find(item=>item.id===componentId);
      if(!component)return [];
      return [{position:component.position,size:getReactFlowNodeSize(nodeById.get(componentId)??{})}];
    });
    return {...group,...fitGroupBoundsAfterLayout(members)};
  });
  return {...document,groups,components};
}
