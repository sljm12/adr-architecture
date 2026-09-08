import { useAdrStore, adrStatuses } from '../state/adr-store';

export function AdrEditor() {
  const draft = useAdrStore(state => state.draft); const status = useAdrStore(state => state.status); const error = useAdrStore(state => state.error); const fieldErrors = useAdrStore(state => state.fieldErrors); const update = useAdrStore(state => state.update); const save = useAdrStore(state => state.save); const retry = useAdrStore(state => state.retry);
  if (!draft) return <div className="adr-editor-empty"><p>Select a decision or create a new one.</p></div>;
  const field = (name: 'title' | 'context' | 'decision' | 'consequences' | 'alternativesOrConstraints') => ({ value: draft[name] ?? '', onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(current => ({ ...current, [name]: event.target.value })) });
  const messageId = (name: string) => fieldErrors[name] ? `${name}-error` : undefined;
  return <form className="adr-editor" onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save(); } }} aria-labelledby="adr-editor-heading" aria-keyshortcuts="Control+Enter Meta+Enter">
    <div className="adr-editor-heading"><div><span className="eyebrow">{draft.id ? 'Edit decision' : 'New decision'}</span><h3 id="adr-editor-heading">Architecture Decision Record</h3></div><span className={`adr-save-state adr-save-${status}`} role="status">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'failed' ? 'Needs attention' : status === 'unsaved' ? 'Unsaved changes' : 'Draft'}</span></div>
    {error && <p className="adr-feedback adr-error" role="alert">{error}</p>}
    {(['title', 'context', 'decision', 'consequences'] as const).map(name => <label key={name} htmlFor={`adr-${name}`}>{name[0].toUpperCase() + name.slice(1)}<span className="required-mark"> required</span>{name === 'title' ? <input id={`adr-${name}`} {...field(name)} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={messageId(name)} /> : <textarea id={`adr-${name}`} rows={4} {...field(name)} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={messageId(name)} />}{fieldErrors[name] && <span className="field-error" id={`${name}-error`}>{fieldErrors[name]}</span>}</label>)}
    <label htmlFor="adr-alternatives">Alternatives or constraints <span>optional</span><textarea id="adr-alternatives" rows={3} {...field('alternativesOrConstraints')} aria-invalid={Boolean(fieldErrors.alternativesOrConstraints)} /></label>
    <label htmlFor="adr-status">Status<select id="adr-status" value={draft.status} onChange={event => update(current => ({ ...current, status: event.target.value as typeof current.status }))}>{adrStatuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    {fieldErrors.replacementAdrId && <p className="field-error" role="alert">{fieldErrors.replacementAdrId}</p>}
    <div className="adr-editor-actions"><button className="primary-pill" type="submit" disabled={status === 'saving'}>{status === 'failed' && draft.id ? 'Retry save' : 'Save decision'}</button>{status === 'failed' && <button className="secondary-action" type="button" onClick={() => void retry()}>Retry</button>}</div>
  </form>;
}
