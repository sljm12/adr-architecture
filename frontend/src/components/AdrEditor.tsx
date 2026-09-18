import { useState } from 'react';
import { useAdrStore, adrStatuses } from '../state/adr-store';
import type { AdrStatus, Component, Relationship } from '../../../shared/src/index';
import { AdrLinkPicker } from './AdrLinkPicker';
import { AdrStatusBadge } from './AdrStatusBadge';
import { ConfirmDialog } from './ConfirmDialog';

type AdrEditorProps = {
  components?: Component[];
  relationships?: Relationship[];
  onSelectComponent?: (componentId: string) => void;
  onSelectRelationship?: (relationshipId: string) => void;
  onOpenAdr?: (adrId: string) => void;
};

export function AdrEditor({ components = [], relationships = [], onSelectComponent, onSelectRelationship, onOpenAdr }: AdrEditorProps) {
  const draft = useAdrStore(state => state.draft);
  const status = useAdrStore(state => state.status);
  const error = useAdrStore(state => state.error);
  const fieldErrors = useAdrStore(state => state.fieldErrors);
  const records = useAdrStore(state => state.records);
  const deleteStatus = useAdrStore(state => state.deleteStatus);
  const deleteError = useAdrStore(state => state.deleteError);
  const deleteBlockers = useAdrStore(state => state.deleteBlockers);
  const deleteMessage = useAdrStore(state => state.deleteMessage);
  const update = useAdrStore(state => state.update);
  const save = useAdrStore(state => state.save);
  const retry = useAdrStore(state => state.retry);
  const remove = useAdrStore(state => state.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!draft) {
    return <div className="adr-editor-empty"><p>Select a decision or create a new one.</p>{deleteMessage && <p className="adr-feedback" role="status" aria-live="polite">{deleteMessage}</p>}</div>;
  }

  const field = (name: 'title' | 'context' | 'decision' | 'consequences' | 'alternativesOrConstraints') => ({ value: draft[name] ?? '', onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(current => ({ ...current, [name]: event.target.value })) });
  const messageId = (name: string) => fieldErrors[name] ? `${name}-error` : undefined;
  const replacementCandidates = records.filter(record => record.id !== draft.id);
  const updateStatus = (nextStatus: AdrStatus) => update(current => ({ ...current, status: nextStatus, replacementAdrId: nextStatus === 'superseded' ? current.replacementAdrId ?? null : null }));

  return <>
    <form className="adr-editor" onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save(); } }} aria-labelledby="adr-editor-heading" aria-keyshortcuts="Control+Enter Meta+Enter">
      <div className="adr-editor-heading"><div><span className="eyebrow">{draft.id ? 'Edit decision' : 'New decision'}</span><h3 id="adr-editor-heading">Architecture Decision Record</h3></div><AdrStatusBadge status={draft.status} /><span className={`adr-save-state adr-save-${status}`} role="status" aria-live="polite">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'failed' ? 'Needs attention' : status === 'unsaved' ? 'Unsaved changes' : 'Draft'}</span></div>
      {error && <p className="adr-feedback adr-error" role="alert">{error}</p>}
      {deleteError && <div className="adr-feedback adr-error" role="alert" aria-live="assertive"><strong>Could not delete this decision.</strong> {deleteError}{deleteBlockers.length > 0 && <><p className="adr-blocker-heading">Dependency blocker: repair or remove these replacement references before retrying.</p><ul className="adr-blockers">{deleteBlockers.map(blocker => <li key={blocker.adrId}><span>{blocker.title} ({blocker.adrId})</span>{onOpenAdr && <button type="button" className="secondary-action" onClick={() => onOpenAdr(blocker.adrId)}>Open blocking decision</button>}</li>)}</ul></>}</div>}
      {(['title', 'context', 'decision', 'consequences'] as const).map(name => <label key={name} htmlFor={`adr-${name}`}>{name[0].toUpperCase() + name.slice(1)}<span className="required-mark"> required</span>{name === 'title' ? <input id={`adr-${name}`} {...field(name)} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={messageId(name)} /> : <textarea id={`adr-${name}`} rows={4} {...field(name)} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={messageId(name)} />}{fieldErrors[name] && <span className="field-error" id={`${name}-error`}>{fieldErrors[name]}</span>}</label>)}
      <label htmlFor="adr-alternatives">Alternatives or constraints <span>optional</span><textarea id="adr-alternatives" rows={3} {...field('alternativesOrConstraints')} aria-invalid={Boolean(fieldErrors.alternativesOrConstraints)} /></label>
      <label htmlFor="adr-status">Status<select id="adr-status" value={draft.status} onChange={event => updateStatus(event.target.value as AdrStatus)}>{adrStatuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {draft.status === 'superseded' && <div className="adr-replacement-field"><label htmlFor="adr-replacement">Replacement decision<span className="required-mark"> required for superseded decisions</span><select id="adr-replacement" value={draft.replacementAdrId ?? ''} onChange={event => update(current => ({ ...current, replacementAdrId: event.target.value || null }))} aria-invalid={Boolean(fieldErrors.replacementAdrId)} aria-describedby={fieldErrors.replacementAdrId ? 'replacement-error' : undefined}><option value="">Choose a replacement decision…</option>{replacementCandidates.map(record => <option key={record.id} value={record.id}>{record.title} · {record.status}</option>)}</select></label>{fieldErrors.replacementAdrId && <p className="field-error" id="replacement-error" role="alert">{fieldErrors.replacementAdrId}</p>}<p className="adr-status-note">This decision stays discoverable and will retain its replacement reference.</p></div>}
      {draft.status === 'rejected' && <p className="adr-status-note" role="status">Rejected decisions remain discoverable for architectural history.</p>}
      <AdrLinkPicker components={components} relationships={relationships} selectedIds={draft.componentIds} relationshipIds={draft.relationshipIds} onChange={componentIds => update(current => ({ ...current, componentIds }))} onRelationshipChange={relationshipIds => update(current => ({ ...current, relationshipIds }))} onSelectComponent={onSelectComponent} onSelectRelationship={onSelectRelationship} />
      <div className="adr-editor-actions"><button className="primary-pill" type="submit" disabled={status === 'saving' || deleteStatus === 'deleting'}>{status === 'failed' && draft.id ? 'Retry save' : 'Save decision'}</button>{status === 'failed' && <button className="secondary-action" type="button" onClick={() => void retry()}>Retry</button>}{draft.id && <button className="danger-action" type="button" onClick={() => setConfirmDelete(true)} disabled={deleteStatus === 'deleting'}>Delete decision</button>}</div>
    </form>
    {confirmDelete && <ConfirmDialog title="Delete decision?" message="This permanently removes the decision and its links. This action cannot be undone." confirmLabel="Delete decision" onConfirm={() => { setConfirmDelete(false); void remove(); }} onCancel={() => setConfirmDelete(false)} />}
  </>;
}
