import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyNodeChanges, ReactFlow, Background, Controls, type EdgeMouseHandler, type NodeMouseHandler, type Node, type NodeChange, type OnSelectionChangeFunc } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fromReactFlow, toReactFlow } from '../adapters/react-flow/diagram-adapter';
import { useDiagramStore } from '../state/diagram-store';
import { ComponentNode } from './ComponentNode';
import { RelationshipEdge } from './RelationshipEdge';
import { SystemGroupNode } from './SystemGroupNode';
import type { CanvasSelection } from './WorkspaceInspector';

const nodeTypes = { component: ComponentNode, systemGroup: SystemGroupNode };
const edgeTypes = { relationship: RelationshipEdge };

type DiagramCanvasProps = {
  onSelection: (selection: CanvasSelection) => void;
  selectedComponentIds?: string[];
  selectedComponentId?: string | null;
  selectedCandidateComponentId?: string | null;
  selectedGroupId?: string | null;
  selectedRelationshipId?: string | null;
  onMultiSelectionChange?: (componentIds: string[]) => void;
  groupingSelectionActive?: boolean;
  canvasEpoch?: number;
  adrCounts?: Record<string, number>;
  onOpenComponentAdrs?: (componentId: string) => void;
};

export function DiagramCanvas({ onSelection, selectedComponentIds = [], selectedComponentId = null, selectedCandidateComponentId = null, selectedGroupId = null, selectedRelationshipId = null, onMultiSelectionChange, groupingSelectionActive = false, canvasEpoch = 0, adrCounts = {}, onOpenComponentAdrs }: DiagramCanvasProps) {
  const document = useDiagramStore(state => state.document);
  const update = useDiagramStore(state => state.update);
  const visual = useMemo(() => document ? toReactFlow(document, undefined, adrCounts, onOpenComponentAdrs) : { nodes: [], edges: [] }, [document, adrCounts, onOpenComponentAdrs]);
  const [interactiveNodes, setInteractiveNodes] = useState<Node[]>([]);
  useEffect(() => setInteractiveNodes(visual.nodes), [visual]);
  const selectedIds = useMemo(() => new Set(selectedComponentIds.length ? selectedComponentIds : selectedComponentId ? [selectedComponentId] : selectedCandidateComponentId ? [selectedCandidateComponentId] : []), [selectedCandidateComponentId, selectedComponentId, selectedComponentIds]);
  const renderedNodes = interactiveNodes.length || visual.nodes.length === 0 ? interactiveNodes : visual.nodes;
  const nodes = renderedNodes.map(node => ({ ...node, data: { ...node.data, isSelected: node.type === 'systemGroup' ? node.id === selectedGroupId : selectedIds.has(node.id), isCandidate: node.type === 'component' && node.id === selectedCandidateComponentId } }));
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
    // Grouped members intentionally bypass constrainMemberPosition: the adapter fits the boundary
    // around their new absolute position instead of trapping them at the old edge.
    const nextDocument = fromReactFlow(document, interactiveNodes.map(item => item.id === node.id ? { ...item, position: node.position } : item));
    if (node.type === 'systemGroup') {
      const group = nextDocument.groups.find(item => item.id === node.id);
      if (group) update(() => nextDocument);
      return;
    }
    const component = nextDocument.components.find(item => item.id === node.id);
    if (component) {
      const group = nextDocument.groups.find(item => item.memberComponentIds.includes(component.id));
      update(() => nextDocument);
    }
  }, [document, interactiveNodes, update]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!document) return;
    const currentNodes = interactiveNodes.length ? interactiveNodes : visual.nodes;
    const layoutChanges = changes.filter(change => change.type === 'position' || change.type === 'dimensions');
    const nextNodes = applyNodeChanges(layoutChanges, currentNodes);
    const dimensionChanges = changes.filter(change => change.type === 'dimensions' && change.resizing !== undefined && change.dimensions && currentNodes.some(node => node.id === change.id && node.type === 'component'));
    setInteractiveNodes(nextNodes);
    if (!dimensionChanges.length) return;
    if (dimensionChanges.some(change => change.type === 'dimensions' && change.resizing !== false)) return;
    const resizedNodes = nextNodes.map(node => {
      const change = dimensionChanges.find(item => item.id === node.id);
      if (!change || change.type !== 'dimensions' || !change.dimensions) return node;
      return { ...node, measured: change.dimensions, width: change.dimensions.width, height: change.dimensions.height, style: { ...node.style, width: change.dimensions.width, height: change.dimensions.height } };
    });
    const nextDocument = fromReactFlow(document, resizedNodes);
    update(() => nextDocument);
  }, [document, interactiveNodes, update, visual.nodes]);

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes, edges: selectedEdges }) => {
    if (groupingSelectionActive) return;
    if (suppressNextSelectionChange.current) {
      suppressNextSelectionChange.current = false;
      return;
    }
    const selectedGroup = selectedNodes.find(node => node.type === 'systemGroup');
    const selectedComponents = selectedNodes.filter(node => node.type === 'component');
    if (selectedGroup) {
      onMultiSelectionChange?.([]);
      if (selectedComponents.length === 1) {
        emitSelection({ kind: 'group-member-candidate', groupId: selectedGroup.id, componentId: selectedComponents[0].id }, `group-member-candidate:${selectedGroup.id}:${selectedComponents[0].id}`);
        return;
      }
      emitSelection({ kind: 'group', id: selectedGroup.id }, `group:${selectedGroup.id}`);
      return;
    }
    const componentIds = selectedComponents.map(node => node.id);
    if (selectedEdges.length > 0 && componentIds.length === 0) {
      onMultiSelectionChange?.([]);
      emitSelection({ kind: 'relationship', id: selectedEdges[0].id }, `relationship:${selectedEdges[0].id}`);
    } else if (componentIds.length > 1) {
      onMultiSelectionChange?.(componentIds);
      emitSelection({ kind: 'components', ids: componentIds }, `components:${[...componentIds].sort().join(',')}`);
    } else if (componentIds.length === 1) {
      onMultiSelectionChange?.([]);
      emitSelection({ kind: 'component', id: componentIds[0] }, `component:${componentIds[0]}`);
    } else {
      onMultiSelectionChange?.([]);
      emitSelection(null, '');
    }
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange]);

  const onNodeClick = useCallback<NodeMouseHandler>((event, node) => {
    if (groupingSelectionActive) return;
    if (event.shiftKey && node.type !== 'component') return;
    if (event.shiftKey && selectedGroupId && node.type === 'component') {
      suppressSelectionChangeOnce();
      if (node.id === selectedCandidateComponentId) emitSelection({ kind: 'group', id: selectedGroupId }, `group:${selectedGroupId}`);
      else emitSelection({ kind: 'group-member-candidate', groupId: selectedGroupId, componentId: node.id }, `group-member-candidate:${selectedGroupId}:${node.id}`);
      onMultiSelectionChange?.([]);
      return;
    }
    if (event.shiftKey) {
      suppressSelectionChangeOnce();
      const nextSelected = new Set(selectedIds);
      if (nextSelected.has(node.id)) nextSelected.delete(node.id);
      else nextSelected.add(node.id);
      const nextIds = [...nextSelected];
      if (nextIds.length > 1) emitSelection({ kind: 'components', ids: nextIds }, `components:${[...nextIds].sort().join(',')}`);
      else if (nextIds.length === 1) emitSelection({ kind: 'component', id: nextIds[0] }, `component:${nextIds[0]}`);
      else emitSelection(null, '');
      onMultiSelectionChange?.(nextIds.length > 1 ? nextIds : []);
      return;
    }
    suppressSelectionChangeOnce();
    onMultiSelectionChange?.([]);
    if (node.type === 'systemGroup') emitSelection({ kind: 'group', id: node.id }, `group:${node.id}`);
    else emitSelection({ kind: 'component', id: node.id }, `component:${node.id}`);
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange, selectedCandidateComponentId, selectedGroupId, selectedIds]);
  const onEdgeClick = useCallback<EdgeMouseHandler>((_, edge) => {
    if (groupingSelectionActive) return;
    onMultiSelectionChange?.([]);
    emitSelection({ kind: 'relationship', id: edge.id }, `relationship:${edge.id}`);
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange]);

  return <main id="diagram-canvas" tabIndex={-1} aria-label="Architecture diagram canvas"><ReactFlow key={`${document?.id ?? 'empty'}:${visual.nodes.length}:${canvasEpoch}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onEdgesChange={() => undefined} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onSelectionChange={handleSelectionChange} onPaneClick={() => { selectionSignature.current = ''; onMultiSelectionChange?.([]); onSelection(null); }} selectionOnDrag={false} selectionKeyCode="Shift" multiSelectionKeyCode="Shift" selectionMode="full" fitView fitViewOptions={{ padding: 0.4 }}><Background aria-hidden="true" /><Controls aria-label="Canvas zoom controls" /></ReactFlow></main>;
}
