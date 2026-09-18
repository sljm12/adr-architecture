import { Handle, NodeResizer, Position } from '@xyflow/react';
import { getC4ArtifactTypeLabel } from '../../../shared/src/index';

export function ComponentNode({ data }: { data: { id?: string; label: string; type?: string | null; isSelected?: boolean; adrCount?: number; onOpenComponentAdrs?: (componentId: string) => void } }) {
  const typeLabel = getC4ArtifactTypeLabel(data.type);
  const cue = data.type === 'person' ? '○' : data.type === 'software-system' ? '□' : '◇';
  return <div className={`component-node component-node-${data.type ?? 'unclassified'}${data.isSelected ? ' is-selected' : ''}`} role="group" tabIndex={0} aria-selected={data.isSelected ? 'true' : 'false'} aria-label={`Component ${data.label}, ${typeLabel}`}>
    <NodeResizer isVisible={Boolean(data.isSelected)} minWidth={120} minHeight={56} />
    <Handle id="target-top" type="target" position={Position.Top} aria-hidden="true" />
    <Handle id="target-right" type="target" position={Position.Right} aria-hidden="true" />
    <Handle id="target-bottom" type="target" position={Position.Bottom} aria-hidden="true" />
    <Handle id="target-left" type="target" position={Position.Left} aria-hidden="true" />
    <div className="component-type-label"><span aria-hidden="true">{cue}</span>{typeLabel}</div>
    <div className="component-label">{data.label}</div>
    {data.isSelected && <span className="component-selection-state" aria-hidden="true">Selected</span>}
    {(data.adrCount ?? 0) > 0 && <button className="component-adr-badge" type="button" onClick={event => { event.stopPropagation(); data.onOpenComponentAdrs?.(data.id ?? ''); }} onMouseDown={event => event.stopPropagation()} aria-label={`${data.adrCount} ${data.adrCount === 1 ? 'decision' : 'decisions'} linked to ${data.label}`} title="Open linked decisions"><span aria-hidden="true">⌁</span>{data.adrCount}</button>}
    <Handle id="source-top" type="source" position={Position.Top} aria-hidden="true" />
    <Handle id="source-right" type="source" position={Position.Right} aria-hidden="true" />
    <Handle id="source-bottom" type="source" position={Position.Bottom} aria-hidden="true" />
    <Handle id="source-left" type="source" position={Position.Left} aria-hidden="true" />
  </div>;
}
