import type { NodeProps } from '@xyflow/react';

type ContainerBoundaryData = { label: string; diagramId: string };

/** Visual-only scope marker. Domain conversion deliberately has no matching artifact. */
export function ContainerBoundaryNode({ data }: NodeProps & { data: ContainerBoundaryData }) {
  return <div className="container-boundary-node" role="group" aria-label={`Software System boundary for ${data.label}`}>
    <div className="container-boundary-heading"><span aria-hidden="true">□</span><strong>{data.label}</strong><span>Container boundary</span></div>
  </div>;
}
