import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { applyNodeChanges, SelectionMode, ReactFlow, Background, Controls, type EdgeMouseHandler, type NodeMouseHandler, type Node, type NodeChange, type OnSelectionChangeFunc } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fromReactFlow, toReactFlow } from '../adapters/react-flow/diagram-adapter';
import { useDiagramStore } from '../state/diagram-store';
import { ComponentNode } from './ComponentNode';
import { RelationshipEdge } from './RelationshipEdge';
import { SystemGroupNode } from './SystemGroupNode';
import { ContainerBoundaryNode } from './ContainerBoundaryNode';
import type { CanvasSelection } from './WorkspaceInspector';

const nodeTypes = { component: ComponentNode, systemGroup: SystemGroupNode, containerBoundary: ContainerBoundaryNode };
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
  onOpenContainerDiagram?: (componentId: string) => void;
  onCreateInteraction?: (source: string, target: string) => void;
};

export function DiagramCanvas({ onSelection, selectedComponentIds = [], selectedComponentId = null, selectedCandidateComponentId = null, selectedGroupId = null, selectedRelationshipId = null, onMultiSelectionChange, groupingSelectionActive = false, canvasEpoch = 0, adrCounts = {}, onOpenComponentAdrs, onOpenContainerDiagram, onCreateInteraction }: DiagramCanvasProps) {
  const document = useDiagramStore(state => state.document);
  const update = useDiagramStore(state => state.update);
  const applyComponentGeometry = useDiagramStore(state => state.applyComponentGeometry);
  const layoutError = useDiagramStore(state => state.error);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const requestContainerOpen = useCallback((componentId: string) => {
    if (onOpenContainerDiagram) onOpenContainerDiagram(componentId);
    else window.dispatchEvent(new CustomEvent('adr:open-container-diagram', { detail: { componentId } }));
  }, [onOpenContainerDiagram]);
  const visual = useMemo(() => document ? toReactFlow(document, undefined, adrCounts, onOpenComponentAdrs, requestContainerOpen) : { nodes: [], edges: [] }, [document, adrCounts, onOpenComponentAdrs, requestContainerOpen]);
  const [interactiveNodes, setInteractiveNodes] = useState<Node[]>([]);
  useEffect(() => setInteractiveNodes(previous => document?.kind === 'container' ? visual.nodes.map(node=>({...node,selected:previous.find(item=>item.id===node.id)?.selected??false})) : visual.nodes), [visual, document?.kind]);
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
    dragging.current = false;
    if (!document) return;
    // Grouped members intentionally bypass constrainMemberPosition: the adapter fits the boundary
    // around their new absolute position instead of trapping them at the old edge.
    const nextDocument = fromReactFlow(document, interactiveNodes.map(item => item.id === node.id ? { ...item, position: node.position } : item));
    if (document.kind === 'container') {
      const accepted = applyComponentGeometry(nextDocument.components.map(c=>({id:c.id,position:c.position,size:c.size})));
      if (!accepted) setInteractiveNodes(visual.nodes);
      return;
    }
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
  }, [document, interactiveNodes, update, applyComponentGeometry, visual.nodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!document) return;
    const currentNodes = interactiveNodes.length ? interactiveNodes : visual.nodes;
    const layoutChanges = changes.filter(change => change.type === 'position' || change.type === 'dimensions' || document.kind === 'container' && change.type === 'select');
    const nextNodes = applyNodeChanges<Node>(layoutChanges, currentNodes);
    const dimensionChanges = changes.filter((change): change is Extract<NodeChange, { type: 'dimensions' }> => change.type === 'dimensions' && change.resizing !== undefined && Boolean(change.dimensions) && currentNodes.some(node => node.id === change.id && node.type === 'component'));
    setInteractiveNodes(nextNodes);
    if (document.kind === 'container') {
      if (dimensionChanges.some(change=>change.type==='dimensions'&&change.resizing===true)) resizing.current=true;
      const finishedResize=dimensionChanges.some(change=>change.type==='dimensions'&&change.resizing===false);
      const keyboardMove=changes.some(change=>change.type==='position'&&change.position&&change.dragging!==true)&&!dragging.current&&!resizing.current;
      if (finishedResize || keyboardMove) {
        resizing.current=false;
        const next=fromReactFlow(document,nextNodes);
        const accepted=applyComponentGeometry(next.components.filter(c=>changes.some(change=>'id' in change && change.id===c.id)).map(c=>({id:c.id,position:c.position,size:c.size})));
        if (!accepted) setInteractiveNodes(visual.nodes);
      }
      return;
    }
    if (!dimensionChanges.length) return;
    if (dimensionChanges.some(change => change.type === 'dimensions' && change.resizing !== false)) return;
    const resizedNodes = nextNodes.map(node => {
      const change = dimensionChanges.find(item => item.id === node.id);
      if (!change || change.type !== 'dimensions' || !change.dimensions) return node;
      return { ...node, measured: change.dimensions, width: change.dimensions.width, height: change.dimensions.height, style: { ...node.style, width: change.dimensions.width, height: change.dimensions.height } };
    });
    const nextDocument = fromReactFlow(document, resizedNodes);
    update(() => nextDocument);
  }, [document, interactiveNodes, update, visual.nodes, applyComponentGeometry]);

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

  const selectNode = useCallback((shiftKey: boolean, node: Node) => {
    if (groupingSelectionActive) return;
    if (shiftKey && node.type !== 'component') return;
    if (shiftKey && selectedGroupId && node.type === 'component') {
      suppressSelectionChangeOnce();
      if (node.id === selectedCandidateComponentId) emitSelection({ kind: 'group', id: selectedGroupId }, `group:${selectedGroupId}`);
      else emitSelection({ kind: 'group-member-candidate', groupId: selectedGroupId, componentId: node.id }, `group-member-candidate:${selectedGroupId}:${node.id}`);
      onMultiSelectionChange?.([]);
      return;
    }
    if (shiftKey) {
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
  const onNodeClick = useCallback<NodeMouseHandler>((event, node) => selectNode(event.shiftKey, node), [selectNode]);
  const onNodeKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    // Child select changes already reach the controlled inspector and keyboard geometry path.
    if (document?.kind === 'container') return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('button,input,textarea,select,a')) return;
    const nodeId = target.closest('.react-flow__node')?.getAttribute('data-id');
    const node = nodes.find(item => item.id === nodeId);
    if (!node || (node.type !== 'component' && node.type !== 'systemGroup')) return;
    // Match pointer selection in the controlled editor; leave arrow movement to React Flow.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation(); selectNode(event.shiftKey, node);
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      suppressSelectionChangeOnce(); onMultiSelectionChange?.([]); emitSelection(null, '');
    }
  }, [document?.kind, nodes, selectNode, emitSelection, onMultiSelectionChange]);
  const onNodeDoubleClick = useCallback<NodeMouseHandler>((event, node) => {
    if (groupingSelectionActive || event.shiftKey || node.type !== 'component') return;
    const component = document?.components.find(item => item.id === node.id);
    const eligible = component?.type === 'software-system' && (document?.kind === 'container' ? component.role === 'external' : (component.role ?? 'element') === 'element');
    if (!eligible) return;
    if (onOpenContainerDiagram) onOpenContainerDiagram(node.id);
    else window.dispatchEvent(new CustomEvent('adr:open-container-diagram', { detail: { componentId: node.id } }));
  }, [document, groupingSelectionActive, onOpenContainerDiagram]);
  const onEdgeClick = useCallback<EdgeMouseHandler>((_, edge) => {
    if (groupingSelectionActive) return;
    onMultiSelectionChange?.([]);
    emitSelection({ kind: 'relationship', id: edge.id }, `relationship:${edge.id}`);
  }, [emitSelection, groupingSelectionActive, onMultiSelectionChange]);

  return <main id="diagram-canvas" tabIndex={-1} aria-label="Architecture diagram canvas" onKeyDownCapture={onNodeKeyDown}><ReactFlow key={`${document?.id ?? 'empty'}:${visual.nodes.length}:${canvasEpoch}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onConnect={({source,target})=>{const a=document?.components.find(c=>c.id===source),b=document?.components.find(c=>c.id===target);if(!a||!b||source===target||document?.kind==='container'&&a.role!=='container'&&b.role!=='container'){useDiagramStore.setState({error:'Choose two different local components, including an internal container.'});return;}onCreateInteraction?.(source,target);}} onEdgesChange={() => undefined} onNodeDragStart={() => { dragging.current = true; }} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} onEdgeClick={onEdgeClick} onSelectionChange={handleSelectionChange} onPaneClick={() => { selectionSignature.current = ''; onMultiSelectionChange?.([]); onSelection(null); }} selectionOnDrag={false} selectionKeyCode="Shift" multiSelectionKeyCode="Shift" selectionMode={SelectionMode.Full} fitView fitViewOptions={{ padding: 0.4 }}><Background aria-hidden="true" /><Controls aria-label="Canvas zoom controls" /></ReactFlow>{document?.kind === 'container' && layoutError && <p className="canvas-edit-feedback" role="alert" aria-live="assertive">{layoutError}</p>}</main>;
}
