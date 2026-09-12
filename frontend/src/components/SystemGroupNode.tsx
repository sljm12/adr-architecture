type SystemGroupNodeData = { label: string; groupId: string; memberCount: number };

/** A flat, labelled boundary rendered behind its Software System child nodes. */
export function SystemGroupNode({ data }: { data: SystemGroupNodeData }) {
  return <div className="system-group-node" role="group" aria-label={`System group ${data.label}, ${data.memberCount} Software System members`}>
    <div className="group-boundary-label"><span aria-hidden="true">□</span><strong>{data.label}</strong><span className="group-member-count">{data.memberCount} systems</span></div>
    <p className="group-boundary-hint">Software System boundary</p>
  </div>;
}
