import { Handle, NodeResizer, Position } from '@xyflow/react';
import { getComponentTypeLabel, getContainerComponentMinimumSize, type ComponentRole, type ContainerType } from '../../../shared/src/index';

export function ComponentNode({ data }: { data: { id?: string; label: string; type?: string | null; role?: ComponentRole; containerType?: ContainerType | null; description?: string | null; technology?: string | null; isSelected?: boolean; isCandidate?: boolean; adrCount?: number; onOpenComponentAdrs?: (componentId: string) => void; onOpenContainerDiagram?: (componentId: string) => void } }) {
  const typeLabel = getComponentTypeLabel({type:data.type??null,role:data.role,containerType:data.containerType});
  const minimum = data.role === 'container' || data.role === 'external' ? getContainerComponentMinimumSize({name:data.label,description:data.description??null,technology:data.technology??null}) : {width:120,height:56};
  const cue = data.type === 'person' ? '○' : data.type === 'software-system' ? '□' : '◇';
  return <div className={`component-node component-node-${data.type ?? 'unclassified'}${data.isSelected ? ' is-selected' : ''}${data.isCandidate ? ' is-add-candidate' : ''}`} role="group" tabIndex={0} aria-selected={data.isSelected ? 'true' : 'false'} aria-label={`Component ${data.label}, ${typeLabel}`} aria-describedby={data.isCandidate ? `${data.id ?? 'component'}-group-candidate` : undefined} onDoubleClick={event => { if (!event.shiftKey && data.id && data.onOpenContainerDiagram) { event.stopPropagation(); data.onOpenContainerDiagram(data.id); } }}>
    <NodeResizer isVisible={Boolean(data.isSelected)} minWidth={minimum.width} minHeight={minimum.height} />
    <Handle id="target-top" type="target" position={Position.Top} aria-hidden="true" />
    <Handle id="target-right" type="target" position={Position.Right} aria-hidden="true" />
    <Handle id="target-bottom" type="target" position={Position.Bottom} aria-hidden="true" />
    <Handle id="target-left" type="target" position={Position.Left} aria-hidden="true" />
    <div className="component-type-label"><span aria-hidden="true">{cue}</span>{typeLabel}</div>
    <div className="component-label">{data.label}</div>
    {data.role !== 'element' && data.description && <div className="component-responsibility">{data.description}</div>}
    {data.role === 'container' && data.technology && <div className="component-technology">Technology: {data.technology}</div>}
    {data.isCandidate ? <span id={`${data.id ?? 'component'}-group-candidate`} className="component-selection-state">Candidate for group</span> : data.isSelected && <span className="component-selection-state" aria-hidden="true">Selected</span>}
    {(data.adrCount ?? 0) > 0 && <button className="component-adr-badge" type="button" onClick={event => { event.stopPropagation(); data.onOpenComponentAdrs?.(data.id ?? ''); }} onMouseDown={event => event.stopPropagation()} aria-label={`${data.adrCount} ${data.adrCount === 1 ? 'decision' : 'decisions'} linked to ${data.label}`} title="Open linked decisions"><span aria-hidden="true">⌁</span>{data.adrCount}</button>}
    <Handle id="source-top" type="source" position={Position.Top} aria-hidden="true" />
    <Handle id="source-right" type="source" position={Position.Right} aria-hidden="true" />
    <Handle id="source-bottom" type="source" position={Position.Bottom} aria-hidden="true" />
    <Handle id="source-left" type="source" position={Position.Left} aria-hidden="true" />
  </div>;
}
