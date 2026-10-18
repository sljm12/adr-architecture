import { useEffect, useId, useRef, useState } from 'react';
import type { ArchiveImportPreview, PreparedArchive } from '../../../shared/src/index';
import { downloadArchive } from '../api/archive-client';
import './recovery.css';
import './archive-transfer.css';

export type ArchiveConsent = { overrideExisting: boolean; recoverySaved: boolean };
type Props = { prepared?: PreparedArchive; preview?: ArchiveImportPreview; busy?: boolean; onConfirm: (consent: ArchiveConsent) => void; onCancel: () => void };
export function ArchiveReviewDialog({ prepared, preview, busy = false, onConfirm, onCancel }: Props) {
  const [overrideExisting, setOverride] = useState(false), [recoverySaved, setSaved] = useState(false), [downloaded, setDownloaded] = useState(false), [downloadError, setDownloadError] = useState('');
  const ref = useRef<HTMLElement>(null), actions = useRef({ busy, onCancel });
  const titleId = useId(), messageId = useId();
  useEffect(() => { actions.current = { busy, onCancel }; }, [busy, onCancel]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!actions.current.busy) actions.current.onCancel(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
      if (!items.length) { event.preventDefault(); ref.current?.focus(); return; }
      if (!items.includes(document.activeElement as HTMLElement) || event.shiftKey && document.activeElement === items[0] || !event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  const included = prepared?.scope ?? preview?.includedDiagrams ?? [];
  return <div className="dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}><section className="confirm-dialog archive-review" ref={ref} role="dialog" tabIndex={-1} aria-modal="true" aria-busy={busy} aria-labelledby={titleId} aria-describedby={messageId}>
    <h2 id={titleId}>{prepared ? 'Review archive export' : 'Review archive import'}</h2>
    <p id={messageId}>{prepared ? 'Download this saved snapshot, including the complete top-level hierarchy, Trash, and required dependencies.' : 'Import all records in this file with their original identities and saved values. Matching diagrams receive the complete file snapshot, including the listed removals.'}</p>
    <div className="dialog-actions"><button type="button" className="secondary-action" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="primary-pill" onClick={() => onConfirm({ overrideExisting, recoverySaved })} disabled={busy || Boolean(preview?.requiresOverride && !overrideExisting) || Boolean(preview?.requiresRecovery && (!downloaded || !recoverySaved))}>{busy ? 'Importing…' : prepared ? 'Download archive' : 'Import archive'}</button></div>
    {preview?.requiresOverride && <label><input type="checkbox" checked={overrideExisting} disabled={busy} onChange={event => setOverride(event.target.checked)} /> Approve override of all matching identities in this file</label>}
    {preview?.recovery && <div><p>Recovery restores overwritten contents, keeps newly added diagrams, and can be blocked by their dependencies. A download does not prove the file was saved; keep it somewhere safe.</p><button type="button" className="secondary-action" disabled={busy} onClick={() => {
      try { const recovery = preview.recovery!; downloadArchive(recovery, JSON.parse(recovery.archiveText).selectedDiagramId); setDownloaded(true); setDownloadError(''); }
      catch { setDownloadError('Recovery download failed. Retry the download before importing.'); }
    }}>Download recovery archive</button><label><input type="checkbox" checked={recoverySaved} disabled={busy || !downloaded} onChange={event => setSaved(event.target.checked)} /> I saved the recovery file</label>{downloadError && <p role="alert">{downloadError}</p>}</div>}
    <div className="archive-review-content" tabIndex={0} aria-label="Included diagrams and record counts"><h3>Included diagrams ({included.length})</h3><ul>{included.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.kind} · {item.status} · {item.reason}</span><code>{item.id}</code></li>)}</ul>
      {prepared && <><h3>Saved record counts</h3><dl>{Object.entries(prepared.counts).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl><p>{prepared.byteLength} bytes · SHA-256 <code>{prepared.fileSha256}</code></p></>}
      {preview && <><p>{preview.totals.added} added · {preview.totals.replaced} replaced · {preview.totals.removed} removed · {preview.totals.unchanged} unchanged</p><h3>All record changes</h3><ul>{preview.changes.map(change => <li key={`${change.collection}/${change.identity.join('/')}`}><strong>{change.collection}: {change.name ?? change.action}</strong><span>{change.action} · diagram {change.diagramId}</span><code>{change.identity.join(' / ')}</code></li>)}</ul></>}
    </div>
    {busy && <p role="status">Importing the reviewed snapshot. Wait for the saved result.</p>}
  </section></div>;
}
