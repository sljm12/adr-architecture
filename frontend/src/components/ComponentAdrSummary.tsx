import { useEffect } from 'react';
import { useAdrStore } from '../state/adr-store';

type Props = {
  diagramId: string;
  componentId: string;
  onOpenAdr: (adrId: string) => void;
};

export function ComponentAdrSummary({ diagramId, componentId, onOpenAdr }: Props) {
  const summaries = useAdrStore(state => state.componentSummaries);
  const loadedComponentId = useAdrStore(state => state.componentSummaryComponentId);
  const status = useAdrStore(state => state.componentSummaryStatus);
  const error = useAdrStore(state => state.componentSummaryError);
  const load = useAdrStore(state => state.loadComponentSummary);

  useEffect(() => { void load(diagramId, componentId); }, [diagramId, componentId, load]);

  return <section className="component-adr-summary" aria-labelledby="component-adr-summary-heading">
    <div className="component-adr-summary-heading"><div><p className="inspector-meta">Decision records</p><h3 id="component-adr-summary-heading">Linked ADRs</h3></div><span className="component-adr-summary-count" aria-label={`${loadedComponentId === componentId ? summaries.length : 0} linked ADRs`}>{loadedComponentId === componentId ? summaries.length : 0}</span></div>
    {status === 'loading' && <p className="component-adr-summary-feedback" role="status">Loading linked ADRs…</p>}
    {status === 'failed' && <p className="component-adr-summary-feedback component-adr-summary-error" role="alert">{error}</p>}
    {status === 'loaded' && loadedComponentId === componentId && summaries.length === 0 && <p className="component-adr-summary-empty" role="status">No linked ADRs for this component.</p>}
    {status === 'loaded' && loadedComponentId === componentId && summaries.length > 0 && <ul className="component-adr-summary-list">{summaries.map(summary => <li key={summary.id}><button type="button" className="component-adr-summary-row" onClick={() => onOpenAdr(summary.id)} aria-label={`Open ADR: ${summary.title}`}><span><strong>{summary.title}</strong><small>Updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(summary.updatedAt))}</small></span><b className={`adr-status adr-status-${summary.status}`}>{summary.status}</b></button></li>)}</ul>}
  </section>;
}
