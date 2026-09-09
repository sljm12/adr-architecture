import { useEffect, useState } from 'react';
import { useAdrStore } from '../state/adr-store';
import type { AdrStatus } from '../../../shared/src/index';
import { AdrStatusBadge } from './AdrStatusBadge';
import './adr.css';

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function AdrList({ diagramId }: { diagramId: string }) {
  const [filterStatus, setFilterStatus] = useState<AdrStatus | 'all'>('all');
  const records = useAdrStore(state => state.records); const status = useAdrStore(state => state.status); const error = useAdrStore(state => state.error); const draft = useAdrStore(state => state.draft); const load = useAdrStore(state => state.load); const select = useAdrStore(state => state.select); const startNew = useAdrStore(state => state.startNew);
  const visibleRecords = filterStatus === 'all' ? records : records.filter(record => record.status === filterStatus);
  useEffect(() => { void load(diagramId); }, [diagramId, load]);
  return <section className="adr-list adr-list-panel" aria-labelledby="adr-list-heading">
    <div className="adr-list-heading"><div><span className="eyebrow">Decision record</span><h3 id="adr-list-heading">Decisions</h3></div><button className="primary-pill" type="button" onClick={() => startNew(diagramId)}>New decision</button></div>
    <label className="adr-filter" htmlFor="adr-status-filter">Filter by status<select id="adr-status-filter" value={filterStatus} onChange={event => setFilterStatus(event.target.value as AdrStatus | 'all')}><option value="all">All statuses</option>{['draft', 'accepted', 'superseded', 'rejected'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
    {status === 'loading' && <p className="adr-feedback" role="status">Loading decisions…</p>}
    {status === 'failed' && !draft && <p className="adr-feedback adr-error" role="status">{error}</p>}
    {status !== 'loading' && records.length === 0 && <p className="adr-feedback">No decisions yet. Create one to capture the reasoning behind this diagram.</p>}
    {status !== 'loading' && records.length > 0 && visibleRecords.length === 0 && <p className="adr-feedback" role="status">No decisions match this status.</p>}
    {visibleRecords.length > 0 && <ul className="adr-list-items">{visibleRecords.map(record => <li key={record.id}><button className={`adr-list-item ${draft?.id === record.id ? 'selected' : ''}`} type="button" onClick={() => void select(record.id)} aria-current={draft?.id === record.id ? 'true' : undefined}><strong>{record.title}</strong><span><AdrStatusBadge status={record.status} /> · Updated {formatDate(record.updatedAt)}</span></button></li>)}</ul>}
  </section>;
}
