import { useEffect } from 'react';
import { useAdrStore } from '../state/adr-store';
import type { Relationship } from '../../../shared/src/index';

type Props = {
  diagramId: string;
  relationship: Relationship;
  componentNames: Map<string, string>;
  onOpenAdr: (adrId: string) => void;
};

export function RelationshipAdrSummary({ diagramId, relationship, componentNames, onOpenAdr }: Props) {
  const summaries = useAdrStore(state => state.relationshipSummaries);
  const loadedRelationshipId = useAdrStore(state => state.relationshipSummaryRelationshipId);
  const status = useAdrStore(state => state.relationshipSummaryStatus);
  const error = useAdrStore(state => state.relationshipSummaryError);
  const load = useAdrStore(state => state.loadRelationshipSummary);
  const source = componentNames.get(relationship.sourceComponentId) ?? 'Unknown component';
  const target = componentNames.get(relationship.targetComponentId) ?? 'Unknown component';

  useEffect(() => { void load(diagramId, relationship.id); }, [diagramId, relationship.id, load]);

  return <section className="relationship-adr-summary" aria-labelledby="relationship-adr-summary-heading">
    <div className="relationship-adr-summary-heading"><div><p className="inspector-meta">Decision records</p><h3 id="relationship-adr-summary-heading">Linked ADRs</h3><p className="relationship-adr-summary-detail">{source} → {target}{relationship.label ? ` · ${relationship.label}` : ''}</p></div><span className="relationship-adr-summary-count" aria-label={`${loadedRelationshipId === relationship.id ? summaries.length : 0} linked ADRs`}>{loadedRelationshipId === relationship.id ? summaries.length : 0}</span></div>
    {status === 'loading' && <p className="relationship-adr-summary-feedback" role="status">Loading linked ADRs…</p>}
    {status === 'failed' && <p className="relationship-adr-summary-feedback relationship-adr-summary-error" role="alert">{error}</p>}
    {status === 'loaded' && loadedRelationshipId === relationship.id && summaries.length === 0 && <p className="relationship-adr-summary-empty" role="status">No linked ADRs for this relationship.</p>}
    {status === 'loaded' && loadedRelationshipId === relationship.id && summaries.length > 0 && <ul className="relationship-adr-summary-list">{summaries.map(summary => <li key={summary.id}><button type="button" className="relationship-adr-summary-row" onClick={() => onOpenAdr(summary.id)} aria-label={`Open ADR: ${summary.title}`}><span><strong>{summary.title}</strong><small>Updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(summary.updatedAt))}</small></span><b className={`adr-status adr-status-${summary.status}`}>{summary.status}</b></button></li>)}</ul>}
  </section>;
}
