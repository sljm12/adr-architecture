import { useEffect, useId, useRef } from 'react';
import './recovery.css';

export function DiagramDeletionUnsavedDialog({ onSaveAndDelete, onDiscardAndDelete, onCancel }: { onSaveAndDelete: () => void; onDiscardAndDelete: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previouslyFocused?.focus(); };
  }, [onCancel]);

  return <div className="dialog-backdrop" role="presentation"><section ref={dialogRef} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
    <h2 id={titleId}>Resolve unsaved changes before deletion</h2>
    <p id={messageId}>This is the current diagram. Save your diagram and ADR changes, discard them, or cancel deletion. The diagram will move to recoverable trash only after you choose a resolution.</p>
    <div className="dialog-actions"><button className="recovery-button recovery-button-secondary" type="button" onClick={onCancel}>Cancel</button><button className="recovery-button recovery-button-secondary" type="button" onClick={onDiscardAndDelete}>Discard and delete</button><button className="recovery-button" type="button" onClick={onSaveAndDelete}>Save and delete</button></div>
  </section></div>;
}
