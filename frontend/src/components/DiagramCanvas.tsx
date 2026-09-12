import { useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, type EdgeMouseHandler, type NodeMouseHandler, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fromReactFlow, toReactFlow } from '../adapters/react-flow/diagram-adapter';
import { useDiagramStore } from '../state/diagram-store';
import { ComponentNode } from './ComponentNode';
import { RelationshipEdge } from './RelationshipEdge';
import { SystemGroupNode } from './SystemGroupNode';
import { constrainMemberPosition } from '../../../shared/src/index';
import type { CanvasSelection } from './WorkspaceInspector';

const nodeTypes = { component: ComponentNode, systemGroup: SystemGroupNode };
const edgeTypes = { relationship: RelationshipEdge };

type DiagramCanvasProps = {
  onSelection: (selection: CanvasSelection) => void;
  selectedComponentIds?: string[];
  selectedComponentId?: string | null;
  selectedGroupId?: string | null;
  selectedRelationshipId?: string | null;
  onMultiSelectionChange?: (componentIds: string[]) => void;
};

export function DiagramCanvas({ onSelection, selectedComponentIds = [], selectedComponentId = null, selectedGroupId = null, selectedRelationshipId = null, onMultiSelectionChange }: DiagramCanvasProps) {
  const document = useDiagramStore(state => state.document);
  const moveGroup = useDiagramStore(state => state.moveGroup);
  const moveComponent = useDiagramStore(state => state.moveComponent);
  const visual = document ? toReactFlow(document) : { nodes: [], edges: [] };
  const selectedIds = new Set(selectedComponentIds.length ? selectedComponentIds : selectedComponentId ? [selectedComponentId] : []);
  const nodes = visual.nodes.map(node => ({ ...node, selected: node.type === 'systemGroup' ? node.id === selectedGroupId : selectedIds.has(node.id) }));
  const edges = visual.edges.map(edge => ({ ...edge, selected: edge.id === selectedRelationshipId }));
  const selectionSignature = useRef('');
  const emitSelection = useCallback((next: CanvasSelection, signature: string) => {
    if (selectionSignature.current === signature) return;
    selectionSignature.current = signature;
    onSelection(next);
  }, [onSelection]);

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    if (!document) return;
    const nextDocument = fromReactFlow(document, visual.nodes.map(item => item.id === node.id ? { ...item, position: node.position } : item));
    if (node.type === 'systemGroup') {
      const group = nextDocument.groups.find(item => item.id === node.id);
      if (group) moveGroup(group.id, group.position);
      return;
    }
    const component = nextDocument.components.find(item => item.id === node.id);
    if (component) {
      const group = nextDocument.groups.find(item => item.memberComponentIds.includes(component.id));
      moveComponent(component.id, group ? constrainMemberPosition(group, component.position) : component.position);
    }
  }, [document, moveComponent, moveGroup, visual.nodes]);

  const onNodeClick = useCallback<NodeMouseHandler>((event, node) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      if (node.type !== 'component') return;
      const nextSelected = new Set(selectedIds);
      if (nextSelected.has(node.id)) nextSelected.delete(node.id);
      else nextSelected.add(node.id);
      const nextIds = [...nextSelected];
      onMultiSelectionChange?.(nextIds);
      if (nextIds.length > 1) emitSelection({ kind: 'components', ids: nextIds }, `components:${[...nextIds].sort().join(',')}`);
      else if (nextIds.length === 1) emitSelection({ kind: 'component', id: nextIds[0] }, `component:${nextIds[0]}`);
      else emitSelection(null, '');
      return;
    }
    if (node.type === 'systemGroup') emitSelection({ kind: 'group', id: node.id }, `group:${node.id}`);
    else emitSelection({ kind: 'component', id: node.id }, `component:${node.id}`);
  }, [emitSelection, onMultiSelectionChange, selectedIds]);
  const onEdgeClick = useCallback<EdgeMouseHandler>((_, edge) => emitSelection({ kind: 'relationship', id: edge.id }, `relationship:${edge.id}`), [emitSelection]);

  return <main id="diagram-canvas" tabIndex={-1} aria-label="Architecture diagram canvas"><ReactFlow key={document?.id ?? 'empty'} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={() => undefined} onEdgesChange={() => undefined} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onSelectionChange={() => undefined} onPaneClick={() => { selectionSignature.current = ''; onMultiSelectionChange?.([]); onSelection(null); }} selectionOnDrag multiSelectionKeyCode="Shift" selectionMode="full" fitView><Background aria-hidden="true" /><Controls aria-label="Canvas zoom controls" /></ReactFlow></main>;
}
