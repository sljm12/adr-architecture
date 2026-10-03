import { useEffect, useId, useRef } from 'react';
import './recovery.css';

export function DiagramSwitchDialog({ onSaveAndLoad, onDiscardAndLoad, onCancel, busy = false, title = 'Save changes before loading?', message = 'Your diagram or decision has unsaved changes.', saveLabel = 'Save and load', discardLabel = 'Discard and load' }: { onSaveAndLoad: () => void; onDiscardAndLoad: () => void; onCancel: () => void; busy?: boolean; title?: string; message?: string; saveLabel?: string; discardLabel?: string }) {
  const dialogRef = useRef<HTMLElement>(null);
  const actions = useRef({ onCancel, busy }); actions.current = { onCancel, busy };
  const titleId = useId(), messageId = useId();
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !actions.current.busy) { event.preventDefault(); actions.current.onCancel(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!buttons.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === buttons.length - 1) {
        event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
      }
    };
    document.addEventListener('keydown', onKey); dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); if (previouslyFocused?.isConnected) previouslyFocused?.focus(); };
  }, []);
  return <div className="dialog-backdrop" role="presentation"><section ref={dialogRef} className="confirm-dialog" role="alertdialog" tabIndex={-1} aria-modal="true" aria-busy={busy} aria-labelledby={titleId} aria-describedby={messageId}>
    <h2 id={titleId}>{title}</h2><p id={messageId}>{message}</p>
    <div className="dialog-actions"><button className="recovery-button recovery-button-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="recovery-button recovery-button-secondary" type="button" onClick={onDiscardAndLoad} disabled={busy}>{discardLabel}</button><button className="recovery-button" type="button" onClick={onSaveAndLoad} disabled={busy}>{saveLabel}</button></div>
  </section></div>;
}
