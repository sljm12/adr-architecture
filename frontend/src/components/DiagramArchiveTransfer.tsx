import { useEffect, useRef, useState } from 'react';
import type { ArchiveImportPreview, ArchiveImportResult, PreparedArchive } from '../../../shared/src/index';
import { ArchiveApiError, archiveClient, downloadArchive, readArchiveFile } from '../api/archive-client';
import { invalidateArchiveDiagrams, useDiagramStore } from '../state/diagram-store';
import { invalidateArchiveAdrs, useAdrStore } from '../state/adr-store';
import { ArchiveReviewDialog, type ArchiveConsent } from './ArchiveReviewDialog';
import { DiagramSwitchDialog } from './DiagramSwitchDialog';

type Review = { kind: 'export'; id: string; prepared: PreparedArchive } | { kind: 'import'; text: string; preview: ArchiveImportPreview };
const dirty = (status: string) => ['unsaved', 'failed'].includes(status);
function draftsIn(ids: string[]) {
  const diagram = useDiagramStore.getState(), adr = useAdrStore.getState();
  return Boolean(ids.includes(diagram.document?.id ?? '') && dirty(diagram.status) || ids.includes(adr.draft?.diagramId ?? '') && dirty(adr.status));
}
function operationPending() {
  const d = useDiagramStore.getState(), a = useAdrStore.getState();
  return d.recoveryPending || d.savePending || d.navigationStatus === 'loading' || d.containerOpenStatus === 'loading' || d.componentOpenStatus === 'loading' || d.savedDocumentsDeleteStatus === 'deleting' || a.savePending || a.status === 'loading' || a.status === 'saving' || a.deleteStatus === 'deleting';
}

export function DiagramArchiveTransfer({ onActiveChange, onImported }: { onActiveChange: (active: boolean) => void; onImported: () => void }) {
  const [review, setReview] = useState<Review | null>(null), [guard, setGuard] = useState(false), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(''), [failed, setFailed] = useState(false), [completed, setCompleted] = useState<ArchiveImportResult | null>(null);
  const [exportName, setExportName] = useState<string | null>(null);
  const [transferActive, setTransferActive] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null), sequence = useRef(0), mutating = useRef(false), active = useRef(false);
  const origin = useRef<HTMLElement | null>(null);
  const refreshTarget = useRef<string | null>(null);
  const consent = useRef<ArchiveConsent>({ overrideExisting: false, recoverySaved: false });
  const callbacks = useRef({ onActiveChange, onImported });
  useEffect(() => { callbacks.current = { onActiveChange, onImported }; }, [onActiveChange, onImported]);
  const activate = (value: boolean) => {
    active.current = value; setTransferActive(value); callbacks.current.onActiveChange(value);
    useDiagramStore.setState({ archiveTransferActive: value });
    if (!value) window.requestAnimationFrame(() => { if (origin.current?.isConnected) origin.current.focus(); });
  };
  const cancel = () => { if (mutating.current) return; sequence.current++; setReview(null); setGuard(false); setBusy(false); setFailed(false); setNotice('Archive transfer canceled.'); activate(false); };
  const start = () => {
    if (active.current || operationPending() || document.querySelector('[aria-modal="true"]')) return false;
    origin.current = document.activeElement as HTMLElement | null;
    activate(true); setExportName(null); setCompleted(null); setUncertain(false); setFailed(false); setNotice('Preparing archive review…'); setBusy(true); return true;
  };
  const prepare = async (id: string, alreadyActive = false, name?: string) => {
    if (!alreadyActive && !start()) return;
    if (!alreadyActive) setExportName(name ?? id);
    const token = ++sequence.current; setBusy(true); setFailed(false); setReview(null); setGuard(false);
    try {
      const prepared = await archiveClient.prepare(id);
      if (token !== sequence.current) return;
      setReview({ kind: 'export', id, prepared }); setGuard(draftsIn(prepared.scope.map(d => d.id))); setNotice('');
    } catch (error) { if (token === sequence.current) { setNotice(error instanceof Error ? error.message : 'Export preparation failed. Retry from the saved diagram.'); setFailed(true); activate(false); } }
    finally { if (token === sequence.current) setBusy(false); }
  };
  const preview = async (text: string) => {
    consent.current = { overrideExisting: false, recoverySaved: false };
    const token = ++sequence.current; setBusy(true); setReview(null); setGuard(false); setFailed(false);
    try {
      const result = await archiveClient.preview(text);
      if (token !== sequence.current) return;
      setReview({ kind: 'import', text, preview: result }); setNotice('');
    } catch (error) { if (token === sequence.current) { setNotice(error instanceof Error ? error.message : 'Import review failed. Select the file again.'); setFailed(true); activate(false); } }
    finally { if (token === sequence.current) setBusy(false); }
  };
  const actions = useRef({ prepare }); useEffect(() => { actions.current = { prepare }; });
  useEffect(() => {
    const requests = sequence;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; name?: string }>).detail;
      if (detail?.id) void actions.current.prepare(detail.id, false, detail.name);
      else if (!active.current && !operationPending() && !document.querySelector('[aria-modal="true"]')) { origin.current = document.activeElement as HTMLElement | null; fileInput.current?.click(); }
    };
    window.addEventListener('adr:archive-transfer', handler);
    return () => { requests.current++; window.removeEventListener('adr:archive-transfer', handler); useDiagramStore.setState({ archiveTransferActive: false }); callbacks.current.onActiveChange(false); };
  }, []);
  const refresh = async (result: ArchiveImportResult) => {
    await useDiagramStore.getState().refreshRecoveryLists(result.affectedDiagramIds);
    const target = refreshTarget.current, current = useDiagramStore.getState().document;
    if (target && (!current || current.id === target)) {
      if (!await useDiagramStore.getState().loadSavedDocument(target)) throw new Error('The imported view could not be reloaded.');
      useAdrStore.getState().switchDiagram(target);
      callbacks.current.onImported();
    }
    refreshTarget.current = null;
    setCompleted(null); setFailed(false); setNotice(`Import succeeded: ${result.includedDiagrams.map(d => `${d.name} (${d.id})`).join('; ')}. ${result.totals.added} records added, ${result.totals.replaced} replaced, ${result.totals.removed} removed, ${result.totals.unchanged} unchanged.`);
  };
  const commit = async (discard = false) => {
    if (review?.kind !== 'import' || mutating.current || operationPending()) return;
    if (!discard && draftsIn(review.preview.includedDiagrams.map(d => d.id))) { setGuard(true); return; }
    mutating.current = true; setBusy(true); setGuard(false); setFailed(false); setNotice('Importing reviewed saved records…');
    let result: ArchiveImportResult | null = null;
    try {
      result = await archiveClient.import({ archiveText: review.text, previewedAt: review.preview.previewedAt, previewToken: review.preview.previewToken, ...consent.current, recoveryFileSha256: review.preview.recovery?.fileSha256 ?? null });
      const currentId = useDiagramStore.getState().document?.id;
      refreshTarget.current = currentId && result.affectedDiagramIds.includes(currentId) ? currentId : null;
      setReview(null); invalidateArchiveDiagrams(result.affectedDiagramIds); invalidateArchiveAdrs(result.affectedDiagramIds);
      await refresh(result);
    } catch (error) {
      setFailed(true);
      if (result) { setCompleted(result); setNotice(`Import succeeded; refresh failed. ${error instanceof Error ? error.message : 'Retry refreshing the library.'}`); }
      else { setReview(null); setUncertain(!(error instanceof ArchiveApiError)); setNotice(error instanceof Error ? error.message : 'Import outcome is uncertain. Inspect saved data before retrying.'); }
      if (error instanceof ArchiveApiError && error.detail.code === 'ARCHIVE_PREVIEW_CHANGED') setNotice(`${error.message} Select the file again for a fresh review.`);
    } finally { mutating.current = false; setBusy(false); activate(false); }
  };
  const saveAndReview = async () => {
    if (!review || mutating.current || operationPending()) return;
    const ids = review.kind === 'export' ? review.prepared.scope.map(d => d.id) : review.preview.includedDiagrams.map(d => d.id);
    setBusy(true); setFailed(false);
    try {
      const d = useDiagramStore.getState();
      if (ids.includes(d.document?.id ?? '') && dirty(d.status)) { await d.save(); if (useDiagramStore.getState().status !== 'saved') throw new Error(useDiagramStore.getState().error ?? 'Diagram save failed. Retry or continue with saved data.'); }
      const a = useAdrStore.getState();
      if (ids.includes(a.draft?.diagramId ?? '') && dirty(a.status) && !await a.save()) throw new Error(useAdrStore.getState().error ?? 'Decision save failed. Retry or continue with saved data.');
      if (review.kind === 'export') await prepare(review.id, true); else await preview(review.text);
    } catch (error) { setFailed(true); setNotice(error instanceof Error ? error.message : 'Save failed. Your drafts remain available.'); }
    finally { setBusy(false); }
  };
  return <>
    <input ref={fileInput} type="file" accept=".adr.json,application/json" aria-label="Select diagram archive" hidden onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file || !start()) return;
      const token = ++sequence.current;
      void readArchiveFile(file).then(text => { if (token === sequence.current) return preview(text); }).catch(error => { if (token === sequence.current) { setFailed(true); setNotice(error instanceof Error ? error.message : 'Could not read archive. Select the file again.'); setBusy(false); activate(false); } });
    }} />
    {review && !guard && <ArchiveReviewDialog prepared={review.kind === 'export' ? review.prepared : undefined} preview={review.kind === 'import' ? review.preview : undefined} busy={busy} onCancel={cancel} onConfirm={approval => {
      if (review.kind === 'import') { consent.current = approval; void commit(); return; }
      try { downloadArchive(review.prepared, review.id); setReview(null); setNotice('Archive download started from the approved saved snapshot.'); setFailed(false); activate(false); }
      catch (error) { setFailed(true); setNotice(error instanceof Error ? error.message : 'Download failed. Retry the approved download.'); }
    }} />}
    {review && guard && <DiagramSwitchDialog title={review.kind === 'export' ? 'Export saved data or save your drafts?' : 'Save changes before importing?'} message={review.kind === 'export' ? 'Included diagrams or decisions have unsaved changes. Save and review a fresh snapshot, continue with saved data, or cancel.' : 'This import affects an open diagram or decision draft. Save and review again, discard affected drafts after successful import, or cancel.'} saveLabel="Save and review again" discardLabel={review.kind === 'export' ? 'Continue with saved data' : 'Discard and import'} busy={busy} onSaveAndLoad={() => void saveAndReview()} onDiscardAndLoad={() => { if (review.kind === 'export') setGuard(false); else void commit(true); }} onCancel={cancel} />}
    {notice && <div className="archive-transfer-notice" role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'} aria-busy={busy}>{exportName && `${exportName}: `}{notice}{uncertain && <button type="button" className="text-action" disabled={busy} onClick={() => {
      setBusy(true); activate(true); void useDiagramStore.getState().refreshRecoveryLists().then(() => setNotice('Import outcome is uncertain. Saved lists refreshed; inspect saved diagrams before reviewing another import.')).catch(() => setNotice('Import outcome is uncertain. Saved lists could not refresh. Retry refresh and inspect saved data before importing again.')).finally(() => { setBusy(false); activate(false); });
    }}>Refresh saved diagrams</button>}{transferActive && !review && !completed && !uncertain && <button type="button" className="text-action" onClick={cancel}>Cancel archive review</button>}{completed && <button type="button" className="text-action" disabled={busy} onClick={() => {
      setBusy(true); activate(true); void refresh(completed).catch(error => { setFailed(true); setNotice(`Import succeeded; refresh failed. ${error instanceof Error ? error.message : 'Retry refresh.'}`); }).finally(() => { setBusy(false); activate(false); });
    }}>Retry import refresh</button>}{!transferActive && !completed && <button type="button" className="text-action" onClick={() => setNotice('')}>Dismiss archive message</button>}</div>}
  </>;
}
