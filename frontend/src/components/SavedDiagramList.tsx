import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagramStore } from '../state/diagram-store';
import { diagramClient } from '../api/diagram-client';
import { getComponentScope, type DiagramSummary } from '../../../shared/src/index';
import { defaultDiagramListSort, deriveDiagramGroups, deriveDiagramLibraryDisplay, type DiagramListSort, type DiagramListSortDirection, type DiagramListSortField } from '../state/diagram-list';
import './saved-diagram-list.css';
import { DiagramLibraryActions, diagramTypeLabel } from './DiagramLibraryActions';

const formatLastSaved = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const formatCreatedDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));

type SavedDiagramListProps = { onSelect: (id: string) => void; onDelete: (id: string) => void; onCreate: () => void };

const ancestors = (diagram: DiagramSummary | null) => {
  const scope = diagram && getComponentScope(diagram);
  return scope ? [scope.systemContextDiagramId, scope.parentDiagramId] : diagram?.kind === 'container' && diagram.scope ? [diagram.scope.parentDiagramId] : [];
};

export function SavedDiagramList({ onSelect, onDelete, onCreate }: SavedDiagramListProps) {
  const documents = useDiagramStore(state => state.savedDocuments);
  const recoveredTrash = useDiagramStore(state => state.trashedDocuments);
  const currentDocument = useDiagramStore(state => state.document);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set(ancestors(currentDocument)));
  const [revealedId, setRevealedId] = useState(currentDocument?.id);
  if (revealedId !== currentDocument?.id) {
    setRevealedId(currentDocument?.id);
    setExpanded(previous => new Set([...previous, ...ancestors(currentDocument)]));
  }
  const search = useRef<HTMLInputElement>(null), importButton = useRef<HTMLButtonElement>(null);
  const focusSearch = useCallback(() => (search.current ?? importButton.current)?.focus(), []);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [trash, setTrash] = useState<DiagramSummary[]>([]);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const trashRequest = useRef(0);

  useEffect(() => { void refresh(); }, [refresh]);
  const [previousRecoveredTrash, setPreviousRecoveredTrash] = useState(recoveredTrash);
  if (recoveredTrash !== previousRecoveredTrash) { setPreviousRecoveredTrash(recoveredTrash); setTrash(recoveredTrash); setRecoveryMessage(''); }
  useEffect(() => () => { trashRequest.current++; }, []);
  const toggleRecovery = () => {
    setRecoveryOpen(value => !value);
    if (recoveryOpen) return;
    const request = ++trashRequest.current;
    const current = () => request === trashRequest.current && useDiagramStore.getState().trashedDocuments === recoveredTrash;
    void diagramClient.listTrash().then(items => { if (current()) { setTrash(items); setRecoveryMessage(''); } }).catch(error => { if (current()) setRecoveryMessage(error instanceof Error ? error.message : 'Could not load trash.'); });
  };

  const list = useMemo(() => deriveDiagramGroups(deriveDiagramLibraryDisplay(documents, currentDocument), { nameQuery, createdFrom, createdTo }, sort), [documents, currentDocument, nameQuery, createdFrom, createdTo, sort]);
  const hasFilters = Boolean(nameQuery.trim() || createdFrom || createdTo);
  const isExpanded = (id: string) => hasFilters || expanded.has(id);
  const disclosure = (id: string, name: string, hasChildren: boolean) => hasChildren ? <button type="button" className="saved-diagram-disclosure" aria-label={`${isExpanded(id) ? 'Collapse' : 'Expand'} ${name}`} aria-expanded={isExpanded(id)} aria-controls={`diagram-children-${id}`} disabled={hasFilters} onClick={() => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  })}><span aria-hidden="true">{isExpanded(id) ? '⌄' : '›'}</span></button> : <span className="saved-diagram-leaf" aria-hidden="true" />;
  const clearFilters = () => { setNameQuery(''); setCreatedFrom(''); setCreatedTo(''); };
  const sortFieldLabel = sort.field === 'name' ? 'name' : 'creation date';
  const sortDirectionLabel = sort.field === 'createdAt'
    ? sort.direction === 'ascending' ? 'oldest first' : 'newest first'
    : sort.direction === 'ascending' ? 'A to Z' : 'Z to A';

  const scopeLabel = (document: DiagramSummary) => {
    const scope = getComponentScope(document);
    if (scope) return `${document.name}, Component diagram, owner ${scope.containerName}, parent Container ${scope.parentDiagramName}, Software System ${scope.softwareSystemName}; parent ${scope.parentDiagramId}; owner ${scope.containerId}`;
    return document.kind === 'container' ? `${document.name}, Container diagram, owner ${document.scope?.softwareSystemName ?? 'unavailable'}, parent ${document.scope?.parentDiagramName ?? 'unavailable'}; parent ${document.scope?.parentDiagramId ?? 'unavailable'}; owner ${document.scope?.softwareSystemId ?? 'unavailable'}` : document.name;
  };
  const renderRow = (document: DiagramSummary, hasChildren = false) => {
    const lastSaved = formatLastSaved(document.updatedAt), created = formatCreatedDate(document.createdAt);
    return <li className={`saved-diagram-row${currentDocument?.id === document.id ? ' is-current' : ''}`} key={document.id}>
      {disclosure(document.id, document.name, hasChildren)}
      <button className="saved-diagram-button" data-diagram-id={document.id} type="button" onClick={() => onSelect(document.id)} aria-current={currentDocument?.id === document.id ? 'true' : undefined} aria-label={`${scopeLabel(document)}, last saved ${lastSaved}; created ${created}; diagram ${document.id}`}>
        <strong>{document.name}</strong>
        <span>{diagramTypeLabel(document)}{currentDocument?.id === document.id && <small className="saved-diagram-current" aria-label="Current diagram"> · Current</small>}</span>
      </button>
      <DiagramLibraryActions diagram={document} busy={deleteStatus === 'deleting'} onDelete={onDelete} onRemovedFocus={focusSearch} />
    </li>;
  };

  return <section className="saved-diagrams" aria-labelledby="saved-diagrams-heading" aria-busy={deleteStatus === 'deleting'}>
    <h2 id="saved-diagrams-heading" className="visually-hidden">Saved diagrams</h2>
    {status === 'loading' && <p className="saved-diagrams-status" role="status">Loading saved diagrams...</p>}
    {status === 'failed' && <p className="saved-diagrams-status saved-diagrams-error" role="status">Could not load saved diagrams: {error}</p>}
    {deleteStatus === 'deleting' && <p className="saved-diagrams-feedback" role="status" aria-live="polite">Moving diagram to recoverable trash...</p>}
    {deleteStatus === 'succeeded' && deleteMessage && <p className="saved-diagrams-feedback saved-diagrams-success" role="status" aria-live="polite">{deleteMessage}</p>}
    {deleteStatus === 'failed' && <p className="saved-diagrams-feedback saved-diagrams-error" role="alert">Could not delete the diagram: {deleteError} Refresh the list and try again if it is no longer available.</p>}
    {status === 'loaded' && documents.length === 0 && <div className="saved-diagrams-empty"><p>No saved diagrams yet.</p><button className="primary-pill" type="button" onClick={onCreate}>Create your first diagram</button></div>}
    {status === 'loaded' && documents.length > 0 && <>
        <div className="saved-diagrams-filter-field">
          <label className="visually-hidden" htmlFor="saved-diagrams-name">Filter diagrams by name</label>
          <input ref={search} id="saved-diagrams-name" type="search" value={nameQuery} onChange={event => setNameQuery(event.target.value)} placeholder="Search diagrams…" autoComplete="off" aria-describedby="saved-diagrams-filter-status" />
        </div>
      <details className="saved-diagrams-filter-disclosure" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}><summary>Filters and sort{hasFilters ? ' · Active' : ''}</summary><div className="saved-diagrams-filters" aria-label="Diagram filters">
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
      <p className="visually-hidden" id="saved-diagrams-sort-status" role="status" aria-live="polite">Sorted by {sortFieldLabel}, {sortDirectionLabel}.</p>
      {list.rangeError && <p className="saved-diagrams-feedback saved-diagrams-error" id="saved-diagrams-filter-status" role="alert">{list.rangeError}</p>}
      {!list.rangeError && <p className="saved-diagrams-feedback" id="saved-diagrams-filter-status" role="status" aria-live="polite">{hasFilters ? `${list.items.length} of ${documents.length} diagrams match the filters.` : `${documents.length} saved diagrams.`}</p>}
      {list.rangeError ? null : list.items.length === 0 ? <div className="saved-diagrams-empty saved-diagrams-no-match"><p>No diagrams match these filters.</p><button className="secondary-action" type="button" onClick={clearFilters}>Clear filters</button></div> : <ul className="saved-diagrams-list">{list.groups.map(group => <li className="saved-diagram-group" data-parent-diagram-id={group.parentId} key={group.parentId}>
        {group.parentMatches && group.parent ? <ul className="saved-diagram-parent-row">{renderRow(group.parent, group.branches.length > 0)}</ul> : <div className="saved-diagram-context-row">{disclosure(group.parentId, group.parentName, group.branches.length > 0)}<div className="saved-diagram-parent-context"><h3>{group.parentName}</h3><p>{group.parent ? 'Parent context' : 'Parent unavailable. Refresh the library to check availability.'}</p>{!group.parent && <button type="button" className="text-action" onClick={() => void refresh()}>Refresh library</button>}</div></div>}
        {group.branches.length > 0 && <ul id={`diagram-children-${group.parentId}`} hidden={!isExpanded(group.parentId)} className="saved-diagram-children" aria-label={`Container diagrams under ${group.parentName}, parent ${group.parentId}`}>{group.branches.map(branch => <li key={branch.parentId} data-container-diagram-id={branch.parentId}>
          {branch.parentMatches && branch.parent ? <ul className="saved-diagram-container-row">{renderRow(branch.parent, branch.children.length > 0)}</ul> : <div className="saved-diagram-context-row">{disclosure(branch.parentId, branch.parentName, branch.children.length > 0)}<div className="saved-diagram-parent-context"><h4>{branch.parentName}</h4><p>{branch.parent ? 'Parent Container context' : 'Parent Container unavailable. Refresh the library to check availability.'}</p>{!branch.parent && <button type="button" className="text-action" onClick={() => void refresh()}>Refresh library</button>}</div></div>}
          {branch.children.length > 0 && <ul id={`diagram-children-${branch.parentId}`} hidden={!isExpanded(branch.parentId)} className="saved-diagram-children saved-diagram-components" aria-label={`Component diagrams under ${branch.parentName}, parent ${branch.parentId}`}>{branch.children.map(child => renderRow(child))}</ul>}
        </li>)}</ul>}
      </li>)}</ul>}
    </>}
    <footer className="saved-diagrams-recovery"><div className="saved-diagrams-footer-actions"><button ref={importButton} className="text-action" type="button" onClick={() => window.dispatchEvent(new CustomEvent('adr:archive-transfer'))}>Import diagram archive</button><button className="text-action" type="button" onClick={toggleRecovery} aria-expanded={recoveryOpen}> {recoveryOpen ? 'Hide recovery' : 'Open recovery'} </button></div>{recoveryOpen && <ul className="saved-diagrams-trash" aria-label="Recoverable diagrams">{recoveryMessage && <li className="saved-diagrams-feedback saved-diagrams-error" role="alert">{recoveryMessage}</li>}{trash.length === 0 && !recoveryMessage && <li className="saved-diagrams-feedback">No diagrams in trash.</li>}{trash.map(item => <li className="saved-diagram-trash-row" data-diagram-id={item.id} key={item.id}><span><strong>{item.name}</strong><small>{diagramTypeLabel(item)}</small></span><DiagramLibraryActions diagram={item} busy={deleteStatus === 'deleting'} onDelete={onDelete} onRemovedFocus={focusSearch} /></li>)}</ul>}</footer>
  </section>;
}
