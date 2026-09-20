type SystemGroupNodeData = { label: string; groupId: string; memberCount: number; isSelected?: boolean };

/** A flat, labelled boundary rendered behind its Software System child nodes. */
export function SystemGroupNode({ data }: { data: SystemGroupNodeData }) {
  return <div className={`system-group-node${data.isSelected ? ' is-selected' : ''}`} role="group" tabIndex={0} aria-selected={data.isSelected ? 'true' : 'false'} aria-label={`System group ${data.label}, ${data.memberCount} Software System members`} aria-describedby={data.isSelected ? `${data.groupId}-group-selection` : undefined}>
    <div className="group-boundary-label"><span aria-hidden="true">□</span><strong>{data.label}</strong><span className="group-member-count">{data.memberCount} systems</span>{data.isSelected && <span id={`${data.groupId}-group-selection`} className="group-selection-state">Selected target group</span>}</div>
    <p className="group-boundary-hint">Software System boundary</p>
  </div>;
}
