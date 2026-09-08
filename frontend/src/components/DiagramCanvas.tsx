import { useCallback } from 'react';
import { ReactFlow, Background, Controls, type EdgeMouseHandler, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toReactFlow } from '../adapters/react-flow/diagram-adapter';
import { useDiagramStore } from '../state/diagram-store';
import { ComponentNode } from './ComponentNode';
import { RelationshipEdge } from './RelationshipEdge';
import type { CanvasSelection } from './WorkspaceInspector';

const nodeTypes = { component: ComponentNode }; const edgeTypes = { relationship: RelationshipEdge };
export function DiagramCanvas({ onSelection, selectedComponentId = null }: { onSelection: (selection: CanvasSelection) => void; selectedComponentId?: string | null }) {
  const document = useDiagramStore(s => s.document); const update = useDiagramStore(s => s.update); const visual = document ? toReactFlow(document) : { nodes: [], edges: [] };
  const nodes = visual.nodes.map(node => ({ ...node, selected: node.id === selectedComponentId }));
  const onNodeDragStop = useCallback((_: unknown, node: any) => update(current => ({ ...current, components: current.components.map(component => component.id === node.id ? { ...component, position: node.position } : component) })), [update]);
  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => onSelection({ kind: 'component', id: node.id }), [onSelection]);
  const onEdgeClick = useCallback<EdgeMouseHandler>((_, edge) => onSelection({ kind: 'relationship', id: edge.id }), [onSelection]);
  return <main id="diagram-canvas" tabIndex={-1} aria-label="Architecture diagram canvas"><ReactFlow key={document?.id ?? 'empty'} nodes={nodes} edges={visual.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={() => undefined} onEdgesChange={() => undefined} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={() => onSelection(null)} fitView><Background aria-hidden="true" /><Controls aria-label="Canvas zoom controls" /></ReactFlow></main>;
}
