import { useEffect, useMemo, useState } from 'react';
import { useDiagramStore } from '../state/diagram-store';
import { diagramClient } from '../api/diagram-client';
import type { DiagramSummary } from '../../../shared/src/index';
import { defaultDiagramListSort, deriveDiagramList, type DiagramListSort, type DiagramListSortDirection, type DiagramListSortField } from '../state/diagram-list';
import { ConfirmDialog } from './ConfirmDialog';
import './saved-diagram-list.css';

const formatLastSaved = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const formatCreatedDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));

type SavedDiagramListProps = { onSelect: (id: string) => void; onDelete: (id: string) => void; onCreate: () => void };

export function SavedDiagramList({ onSelect, onDelete, onCreate }: SavedDiagramListProps) {
  const documents = useDiagramStore(state => state.savedDocuments);
  const currentDocument = useDiagramStore(state => state.document);
  const registerRestoredSavedDocument = useDiagramStore(state => state.registerRestoredSavedDocument);
  const status = useDiagramStore(state => state.savedDocumentsStatus);
  const error = useDiagramStore(state => state.savedDocumentsError);
  const deleteStatus = useDiagramStore(state => state.savedDocumentsDeleteStatus);
  const deleteError = useDiagramStore(state => state.savedDocumentsDeleteError);
  const deleteMessage = useDiagramStore(state => state.savedDocumentsDeleteMessage);
  const refresh = useDiagramStore(state => state.refreshSavedDocuments);
  const [nameQuery, setNameQuery] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sort, setSort] = useState<DiagramListSort>(defaultDiagramListSort);
  const [pendingDeletion, setPendingDeletion] = useState<{ id: string; name: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [trash, setTrash] = useState<DiagramSummary[]>([]);
  const [recoveryMessage, setRecoveryMessage] = useState('');

  useEffect(() => { void refresh(); }, [refresh]);

  const list = useMemo(() => deriveDiagramList(documents, { nameQuery, createdFrom, createdTo }, sort), [documents, nameQuery, createdFrom, createdTo, sort]);
  const hasFilters = Boolean(nameQuery.trim() || createdFrom || createdTo);
  const clearFilters = () => { setNameQuery(''); setCreatedFrom(''); setCreatedTo(''); };
  const sortFieldLabel = sort.field === 'name' ? 'name' : 'creation date';
  const sortDirectionLabel = sort.field === 'createdAt'
    ? sort.direction === 'ascending' ? 'oldest first' : 'newest first'
    : sort.direction === 'ascending' ? 'A to Z' : 'Z to A';

  return <section className="saved-diagrams" aria-labelledby="saved-diagrams-heading" aria-busy={deleteStatus === 'deleting'}>
    <div className="saved-diagrams-title"><span className="card-kicker">Saved work</span><h2 id="saved-diagrams-heading">Saved diagrams</h2></div>
    {status === 'loading' && <p className="saved-diagrams-status" role="status">Loading saved diagrams...</p>}
    {status === 'failed' && <p className="saved-diagrams-status saved-diagrams-error" role="status">Could not load saved diagrams: {error}</p>}
    {deleteStatus === 'deleting' && <p className="saved-diagrams-feedback" role="status" aria-live="polite">Moving diagram to recoverable trash...</p>}
    {deleteStatus === 'succeeded' && deleteMessage && <p className="saved-diagrams-feedback saved-diagrams-success" role="status" aria-live="polite">{deleteMessage}</p>}
    {deleteStatus === 'failed' && <p className="saved-diagrams-feedback saved-diagrams-error" role="alert">Could not delete the diagram: {deleteError} Refresh the list and try again if it is no longer available.</p>}
    {status === 'loaded' && documents.length === 0 && <div className="saved-diagrams-empty"><p>No saved diagrams yet.</p><button className="primary-pill" type="button" onClick={onCreate}>Create your first diagram</button></div>}
    {status === 'loaded' && documents.length > 0 && <>
      <details className="saved-diagrams-filter-disclosure" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}><summary>Filters and sort</summary><div className="saved-diagrams-filters" aria-label="Diagram filters">
        <div className="saved-diagrams-filter-field">
          <label htmlFor="saved-diagrams-name">Filter diagrams by name</label>
          <input id="saved-diagrams-name" type="search" value={nameQuery} onChange={event => setNameQuery(event.target.value)} placeholder="Search names" autoComplete="off" aria-describedby="saved-diagrams-filter-status" />
        </div>
        <div className="saved-diagrams-date-fields">
          <div className="saved-diagrams-filter-field"><label htmlFor="saved-diagrams-created-from">Created from</label><input id="saved-diagrams-created-from" type="date" value={createdFrom} onChange={event => setCreatedFrom(event.target.value)} aria-describedby="saved-diagrams-filter-status" /></div>
          <div className="saved-diagrams-filter-field"><label htmlFor="saved-diagrams-created-to">Created to</label><input id="saved-diagrams-created-to" type="date" value={createdTo} onChange={event => setCreatedTo(event.target.value)} aria-describedby="saved-diagrams-filter-status" /></div>
        </div>
        <div className="saved-diagrams-sort-fields" aria-label="Diagram sorting">
          <div className="saved-diagrams-filter-field"><label htmlFor="saved-diagrams-sort-field">Sort diagrams by</label><select id="saved-diagrams-sort-field" className="saved-diagrams-select" value={sort.field} onChange={event => { const field = event.currentTarget.value as DiagramListSortField; setSort(current => ({ ...current, field })); }} aria-describedby="saved-diagrams-sort-status"><option value="createdAt">Creation date</option><option value="name">Name</option></select></div>
          <div className="saved-diagrams-filter-field"><label htmlFor="saved-diagrams-sort-direction">Sort direction</label><select id="saved-diagrams-sort-direction" className="saved-diagrams-select" value={sort.direction} onChange={event => { const direction = event.currentTarget.value as DiagramListSortDirection; setSort(current => ({ ...current, direction })); }} aria-describedby="saved-diagrams-sort-status"><option value="descending">Descending</option><option value="ascending">Ascending</option></select></div>
        </div>
        <button className="saved-diagrams-clear" type="button" onClick={clearFilters} disabled={!hasFilters}>Clear filters</button>
      </div></details>
      <p className="saved-diagrams-feedback saved-diagrams-sort-status" id="saved-diagrams-sort-status" role="status" aria-live="polite">Sorted by {sortFieldLabel}, {sortDirectionLabel}.</p>
      {list.rangeError && <p className="saved-diagrams-feedback saved-diagrams-error" id="saved-diagrams-filter-status" role="alert">{list.rangeError}</p>}
      {!list.rangeError && <p className="saved-diagrams-feedback" id="saved-diagrams-filter-status" role="status" aria-live="polite">{hasFilters ? `${list.items.length} of ${documents.length} diagrams match the filters.` : `${documents.length} saved diagrams.`}</p>}
      {list.rangeError ? null : list.items.length === 0 ? <div className="saved-diagrams-empty saved-diagrams-no-match"><p>No diagrams match these filters.</p><button className="secondary-action" type="button" onClick={clearFilters}>Clear filters</button></div> : <ul className="saved-diagrams-list">{list.items.map(document => { const lastSaved = formatLastSaved(document.updatedAt); const created = formatCreatedDate(document.createdAt); return <li className={`saved-diagram-row${currentDocument?.id === document.id ? ' is-current' : ''}`} key={document.id}><button className="saved-diagram-button" data-diagram-id={document.id} type="button" onClick={() => onSelect(document.id)} aria-current={currentDocument?.id === document.id ? 'true' : undefined} aria-label={`${document.name}, last saved ${lastSaved}; created ${created}; diagram ${document.id}`}><strong>{document.name}</strong>{currentDocument?.id === document.id && <small className="saved-diagram-current">Current diagram</small>}<span>Created {created} - Last saved {lastSaved}</span><i aria-hidden="true">&gt;</i></button><button className="saved-diagram-delete" type="button" onClick={() => setPendingDeletion({ id: document.id, name: document.name })} disabled={deleteStatus === 'deleting'} aria-label={`Delete ${document.name}`} title={`Delete ${document.name}`}><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-.8 11.2a2 2 0 0 1-2 1.8H8.8a2 2 0 0 1-2-1.8L6 9Zm3 2v8h2v-8H9Zm4 0v8h2v-8h-2Z" /></svg></button></li>; })}</ul>}
    </>}
    <footer className="saved-diagrams-recovery"><button className="text-action" type="button" onClick={() => { setRecoveryOpen(value => !value); if (!recoveryOpen) void diagramClient.listTrash().then(setTrash).catch(error => setRecoveryMessage(error instanceof Error ? error.message : 'Could not load trash.')); }} aria-expanded={recoveryOpen}> {recoveryOpen ? 'Hide recovery' : 'Open recovery'} </button>{recoveryOpen && <div className="saved-diagrams-trash" aria-label="Recoverable diagrams">{recoveryMessage && <p className="saved-diagrams-feedback saved-diagrams-error" role="alert">{recoveryMessage}</p>}{trash.length === 0 && !recoveryMessage && <p className="saved-diagrams-feedback">No diagrams in trash.</p>}{trash.map(item => <div className="saved-diagram-trash-row" key={item.id}><span><strong>{item.name}</strong><small>Created {formatCreatedDate(item.createdAt)}</small></span><button className="text-action" type="button" onClick={() => void diagramClient.restore(item.id).then(restored => { registerRestoredSavedDocument(restored); setTrash(current => current.filter(entry => entry.id !== item.id)); setRecoveryMessage(`${restored.name} restored.`); })}>Restore</button></div>)}</div>}</footer>
    {pendingDeletion && <ConfirmDialog title={`Delete "${pendingDeletion.name}"?`} message={`This removes "${pendingDeletion.name}" from the active diagram list and moves it to recoverable trash. Its components, relationships, decisions, and links will remain available if you restore it.`} confirmLabel="Move to trash" onConfirm={() => { const id = pendingDeletion.id; setPendingDeletion(null); onDelete(id); }} onCancel={() => setPendingDeletion(null)} />}
  </section>;
}
