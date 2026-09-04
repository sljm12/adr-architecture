import { useDiagramStore } from '../state/diagram-store';

export function SaveStatus() {
  const { status, error } = useDiagramStore();
  const message = status === 'unsaved'
    ? 'Unsaved changes'
    : status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : status === 'failed'
          ? `Save failed: ${error}`
          : 'Ready';

  return <p className={`save-status save-${status}`} role="status" aria-live="polite" aria-atomic="true"><span className="status-dot" aria-hidden="true" />{message}</p>;
}
