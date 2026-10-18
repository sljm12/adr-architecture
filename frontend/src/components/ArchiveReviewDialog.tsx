import { useEffect, useId, useRef } from 'react';
import type { ArchiveImportPreview, PreparedArchive } from '../../../shared/src/index';
import './recovery.css';
import './archive-transfer.css';

type Props = { prepared?: PreparedArchive; preview?: ArchiveImportPreview; busy?: boolean; onConfirm: () => void; onCancel: () => void };
export function ArchiveReviewDialog({ prepared, preview, busy = false, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLElement>(null), actions = useRef({ busy, onCancel });
  const titleId = useId(), messageId = useId();
  useEffect(() => { actions.current = { busy, onCancel }; }, [busy, onCancel]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!actions.current.busy) actions.current.onCancel(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
      if (!items.length) { event.preventDefault(); ref.current?.focus(); return; }
      if (!items.includes(document.activeElement as HTMLElement) || event.shiftKey && document.activeElement === items[0] || !event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  const included = prepared?.scope ?? preview?.includedDiagrams ?? [];
  return <div className="dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}><section className="confirm-dialog archive-review" ref={ref} role="dialog" tabIndex={-1} aria-modal="true" aria-busy={busy} aria-labelledby={titleId} aria-describedby={messageId}>
    <h2 id={titleId}>{prepared ? 'Review archive export' : 'Review archive import'}</h2>
    <p id={messageId}>{prepared ? 'Download this saved snapshot, including the complete top-level hierarchy, Trash, and required dependencies.' : 'Import all records in this file with their original identities and saved values. Existing identities are blocked in this release.'}</p>
    <div className="dialog-actions"><button type="button" className="secondary-action" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="primary-pill" onClick={onConfirm} disabled={busy || Boolean(preview?.requiresOverride)}>{busy ? 'Importing…' : prepared ? 'Download archive' : 'Import archive'}</button></div>
    <div className="archive-review-content" tabIndex={0} aria-label="Included diagrams and record counts"><h3>Included diagrams ({included.length})</h3><ul>{included.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.kind} · {item.status} · {item.reason}</span><code>{item.id}</code></li>)}</ul>
      {prepared && <><h3>Saved record counts</h3><dl>{Object.entries(prepared.counts).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl><p>{prepared.byteLength} bytes · SHA-256 <code>{prepared.fileSha256}</code></p></>}
      {preview && <><p>{preview.totals.added} added · {preview.totals.replaced} replaced · {preview.totals.removed} removed · {preview.totals.unchanged} unchanged</p><h3>All record changes</h3><ul>{preview.changes.map(change => <li key={`${change.collection}/${change.identity.join('/')}`}><strong>{change.collection}: {change.name ?? change.action}</strong><span>{change.action} · diagram {change.diagramId}</span><code>{change.identity.join(' / ')}</code></li>)}</ul></>}
    </div>
    {busy && <p role="status">Importing the reviewed snapshot. Wait for the saved result.</p>}
  </section></div>;
}
