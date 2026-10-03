import { useEffect, useRef, useState } from 'react';
import type { RestoreImpact, TrashImpact } from '../../../shared/src/index';
import { diagramClient, DiagramApiError, formatDiagramApiError } from '../api/diagram-client';
import { useDiagramStore } from '../state/diagram-store';
import { useAdrStore } from '../state/adr-store';
import { RecoveryImpactDialog } from './RecoveryImpactDialog';
import { DiagramDeletionUnsavedDialog } from './DiagramDeletionUnsavedDialog';

type Intent = { kind: 'trash'; id: string; impact: TrashImpact } | { kind: 'restore'; id: string; impact: RestoreImpact; separate?: boolean };
export function RecoveryCoordinator({ onLoad, onExitAffected }: { onLoad: (id: string) => void; onExitAffected: () => void }) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [busy, setBusy] = useState(false), [guard, setGuard] = useState(false), [notice, setNotice] = useState('');
  const [retry, setRetry] = useState<{ kind: 'trash' | 'restore'; id: string } | null>(null);
  const [completed, setCompleted] = useState<Intent | null>(null);
  const [errorNotice, setErrorNotice] = useState(false);
  const request = useRef(0), mutating = useRef(false), callbacks = useRef({ onLoad, onExitAffected });
  callbacks.current = { onLoad, onExitAffected };
  const preview = async (kind: 'trash' | 'restore', id: string, separate = false) => {
    if (mutating.current || useDiagramStore.getState().savePending || ['loading'].includes(useDiagramStore.getState().navigationStatus) || useAdrStore.getState().status === 'saving') return;
    const token = ++request.current; setIntent(null); setCompleted(null); setErrorNotice(false); setGuard(false); setRetry(null); setBusy(true); setNotice('Checking affected diagrams…');
    try {
      const impact = kind === 'trash' ? await diagramClient.trashImpact(id) : await diagramClient.restoreImpact(id);
      if (token !== request.current) return;
      setIntent(kind === 'trash' ? { kind, id, impact: impact as TrashImpact } : { kind, id, impact: impact as RestoreImpact, separate }); setNotice('');
    } catch (error) { if (token === request.current) { setErrorNotice(true); setNotice(formatDiagramApiError(error)); setRetry({ kind, id }); } }
    finally { if (token === request.current) setBusy(false); }
  };
  const previewRef = useRef(preview); previewRef.current = preview;
  useEffect(() => {
    const listener = (event: Event) => { const detail = (event as CustomEvent<{ kind: 'trash' | 'restore'; id: string }>).detail; if (detail?.id && ['trash', 'restore'].includes(detail.kind)) void previewRef.current(detail.kind, detail.id); };
    window.addEventListener('adr:recover-diagram', listener);
    return () => { request.current++; window.removeEventListener('adr:recover-diagram', listener); };
  }, []);
  const finishRecovery = async (confirmed: Intent) => {
    await useDiagramStore.getState().refreshRecoveryLists(confirmed.impact.affectedDiagramIds);
    setCompleted(null);
    setErrorNotice(false);
    if (confirmed.kind === 'trash') useDiagramStore.setState({ savedDocumentsDeleteStatus: 'succeeded', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: 'Confirmed diagrams moved to recoverable trash.' });
    setNotice(confirmed.kind === 'trash' ? 'Confirmed diagrams moved to recoverable trash.' : 'Recovery succeeded.');
    if (confirmed.kind === 'restore') {
      if (confirmed.impact.requestedDiagramIncluded) callbacks.current.onLoad(confirmed.id);
      else {
        setNotice('Parent recovery succeeded. The independently trashed child remains in trash; confirm its separate restoration.');
        mutating.current = false; await previewRef.current('restore', confirmed.id, true);
      }
    }
  };
  const retryLists = async () => {
    if (!completed || mutating.current) return;
    mutating.current = true; setBusy(true);
    try { await finishRecovery(completed); }
    catch (error) { setNotice(`Recovery succeeded, but refreshing the lists failed: ${formatDiagramApiError(error)}`); }
    finally { mutating.current = false; setBusy(false); }
  };
  const confirm = async (discard = false) => {
    if (!intent || mutating.current) return;
    const state = useDiagramStore.getState(), adr = useAdrStore.getState();
    if (state.savePending || state.navigationStatus === 'loading' || state.containerOpenStatus === 'loading' || adr.status === 'saving') return;
    const affectsEditor = intent.impact.affectedDiagramIds.includes(state.document?.id ?? '');
    if (intent.kind === 'trash' && affectsEditor && !discard && (['unsaved', 'failed'].includes(state.status) || ['unsaved', 'failed'].includes(adr.status))) { setGuard(true); return; }
    mutating.current = true; setBusy(true); setGuard(false); setNotice(intent.kind === 'trash' ? 'Moving confirmed diagrams to trash…' : 'Restoring confirmed diagrams…');
    let mutationSucceeded = false;
    try {
      if (intent.kind === 'trash') await diagramClient.trash(intent.id, intent.impact.affectedDiagramIds);
      else await diagramClient.restore(intent.impact.restoreRootDiagramId, { confirmedDiagramIds: intent.impact.affectedDiagramIds, confirmedTrashBatchId: intent.impact.trashBatchId });
      mutationSucceeded = true; setIntent(null);
      if (intent.kind === 'trash' && affectsEditor) callbacks.current.onExitAffected();
      await finishRecovery(intent);
    } catch (error) {
      if (mutationSucceeded) { setIntent(null); setCompleted(intent); setNotice(`Recovery succeeded, but refreshing the lists failed: ${formatDiagramApiError(error)}`); }
      else if (error instanceof DiagramApiError && ['TRASH_IMPACT_CHANGED', 'RESTORE_IMPACT_CHANGED', 'PARENT_INACTIVE'].includes(String(error.details.code))) {
        mutating.current = false; await previewRef.current(intent.kind, intent.id); setNotice('The recovery impact changed. Review the fresh named set and confirm again.');
      } else { setErrorNotice(true); setNotice(`${formatDiagramApiError(error)} Refresh the list or retry the confirmation.`); }
    } finally { mutating.current = false; setBusy(false); }
  };
  const saveAndConfirm = async () => {
    const state = useDiagramStore.getState();
    if (['unsaved', 'failed'].includes(state.status)) await state.save();
    if (useDiagramStore.getState().status !== 'saved') return;
    const adr = useAdrStore.getState(); if (['unsaved', 'failed'].includes(adr.status) && !await adr.save()) return;
    if (!['idle', 'saved'].includes(useAdrStore.getState().status)) return;
    await confirm();
  };
  const cancel = () => { if (mutating.current) return; request.current++; setIntent(null); setGuard(false); setErrorNotice(false); setNotice('Recovery canceled.'); };
  return <>
    {intent && !guard && <RecoveryImpactDialog kind={intent.kind} impact={intent.impact} separate={intent.kind === 'restore' && intent.separate} busy={busy} onConfirm={() => void confirm()} onCancel={cancel} />}
    {intent && guard && <DiagramDeletionUnsavedDialog onSaveAndDelete={() => void saveAndConfirm()} onDiscardAndDelete={() => void confirm(true)} onCancel={cancel} />}
    {notice && <p className="container-navigation-feedback" role={errorNotice ? 'alert' : 'status'} aria-live="polite">{notice} {retry && <button className="text-action" type="button" onClick={() => void preview(retry.kind, retry.id)}>Retry recovery preview</button>} {completed && <button className="text-action" type="button" disabled={busy} onClick={() => void retryLists()}>Retry recovery refresh</button>}</p>}
  </>;
}
