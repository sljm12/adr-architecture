import { useEffect, useId, useRef, type ReactNode } from 'react';
import './recovery.css';

type ConfirmDialogProps = { title: string; message: ReactNode; confirmLabel?: string | null; onConfirm?: () => void; onCancel: () => void; busy?: boolean; role?: 'dialog' | 'alertdialog'; cancelLabel?: string };
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel, busy = false, role = 'alertdialog', cancelLabel = 'Cancel' }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null), actions = useRef({ onCancel, busy });
  useEffect(() => { actions.current = { onCancel, busy }; }, [onCancel, busy]);
  const titleId = useId(), messageId = useId();
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!actions.current.busy) actions.current.onCancel(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (!items.includes(document.activeElement as HTMLElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previouslyFocused?.isConnected) previouslyFocused?.focus(); };
  }, []);
  return <div className="dialog-backdrop" role="presentation"><section ref={dialogRef} className="confirm-dialog" role={role} tabIndex={-1} aria-modal="true" aria-busy={busy} aria-labelledby={titleId} aria-describedby={messageId}>
    <h2 id={titleId}>{title}</h2><p id={messageId}>{message}</p>
    <div className="dialog-actions"><button className="recovery-button recovery-button-secondary secondary-action" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>{onConfirm && confirmLabel && <button className="recovery-button primary-pill" type="button" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>}</div>
  </section></div>;
}
