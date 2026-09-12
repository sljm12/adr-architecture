import { useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, type EdgeMouseHandler, type NodeMouseHandler, type Node, type OnSelectionChangeFunc } from '@xyflow/react';
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
  groupingSelectionActive?: boolean;
  canvasEpoch?: number;
};

export function DiagramCanvas({ onSelection, selectedComponentIds = [], selectedComponentId = null, selectedGroupId = null, selectedRelationshipId = null, onMultiSelectionChange, groupingSelectionActive = false, canvasEpoch = 0 }: DiagramCanvasProps) {
  const document = useDiagramStore(state => state.document);
  const moveGroup = useDiagramStore(state => state.moveGroup);
  const moveComponent = useDiagramStore(state => state.moveComponent);
  const visual = document ? toReactFlow(document) : { nodes: [], edges: [] };
  const selectedIds = new Set(selectedComponentIds.length ? selectedComponentIds : selectedComponentId ? [selectedComponentId] : []);
  const nodes = visual.nodes.map(node => ({ ...node, data: { ...node.data, isSelected: node.type === 'systemGroup' ? node.id === selectedGroupId : selectedIds.has(node.id) } }));
  const edges = visual.edges.map(edge => ({ ...edge, data: { ...edge.data, isSelected: edge.id === selectedRelationshipId } }));
  const selectionSignature = useRef('');
  const suppressNextSelectionChange = useRef(false);
  const suppressSelectionChangeOnce = () => {
    suppressNextSelectionChange.current = true;
    window.requestAnimationFrame(() => { suppressNextSelectionChange.current = false; });
  };
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

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes, edges: selectedEdges }) => {
    if (groupingSelectionActive) return;
    if (suppressNextSelectionChange.current) {
      suppressNextSelectionChange.current = false;
      return;
    }
    const selectedGroup = selectedNodes.find(node => node.type === 'systemGroup');
    if (selectedGroup) {
      onMultiSelectionChange?.([]);
      emitSelection({ kind: 'group', id: selectedGroup.id }, `group:${selectedGroup.id}`);
      return;
    }
    const componentIds = selectedNodes.filter(node => node.type === 'component').map(node => node.id);
    onMultiSelectionChange?.(componentIds);
    if (selectedEdges.length > 0 && componentIds.length === 0) {
      emitSelection({ kind: 'relationship', id: selectedEdges[0].id }, `relationship:${selectedEdges[0].id}`);
    } else if (componentIds.length > 1) {
      emitSelection({ kind: 'components', ids: componentIds }, `components:${[...componentIds].sort().join(',')}`);
    } else if (componentIds.length === 1) {
      emitSelection({ kind: 'component', id: componentIds[0] }, `component:${componentIds[0]}`);
    } else {
      emitSelection(null, '');
    }
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange]);

  const onNodeClick = useCallback<NodeMouseHandler>((event, node) => {
    if (groupingSelectionActive) return;
    if ((event.shiftKey || event.metaKey || event.ctrlKey) && node.type !== 'component') return;
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      suppressSelectionChangeOnce();
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
    suppressSelectionChangeOnce();
    onMultiSelectionChange?.(node.type === 'component' ? [node.id] : []);
    if (node.type === 'systemGroup') emitSelection({ kind: 'group', id: node.id }, `group:${node.id}`);
    else emitSelection({ kind: 'component', id: node.id }, `component:${node.id}`);
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange, selectedIds]);
  const onEdgeClick = useCallback<EdgeMouseHandler>((_, edge) => {
    if (groupingSelectionActive) return;
    onMultiSelectionChange?.([]);
    emitSelection({ kind: 'relationship', id: edge.id }, `relationship:${edge.id}`);
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange]);

  return <main id="diagram-canvas" tabIndex={-1} aria-label="Architecture diagram canvas"><ReactFlow key={`${document?.id ?? 'empty'}:${visual.nodes.length}:${canvasEpoch}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={() => undefined} onEdgesChange={() => undefined} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onSelectionChange={handleSelectionChange} onPaneClick={() => { selectionSignature.current = ''; onMultiSelectionChange?.([]); onSelection(null); }} selectionOnDrag selectionKeyCode={null} multiSelectionKeyCode="Shift" selectionMode="full" fitView><Background aria-hidden="true" /><Controls aria-label="Canvas zoom controls" /></ReactFlow></main>;
}
