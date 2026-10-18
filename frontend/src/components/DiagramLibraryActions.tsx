import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getComponentScope, type DiagramSummary } from '../../../shared/src/index';
import { ConfirmDialog } from './ConfirmDialog';

export const diagramTypeLabel = (diagram: DiagramSummary) => diagram.kind === 'component' ? 'Component diagram' : diagram.kind === 'container' ? 'Container diagram' : 'General diagram';

type Props = { diagram: DiagramSummary; busy: boolean; onDelete: (id: string) => void; onRemovedFocus: () => void };

const menuPosition = (rect: DOMRect) => ({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 152)), left: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 228)) });

export function DiagramLibraryActions({ diagram, busy, onDelete, onRemovedFocus }: Props) {
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const menuOpen = position !== null;
  const menuId = useId();
  const trashed = diagram.status === 'trashed';
  const close = () => { trigger.current?.focus(); setPosition(null); };

  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: Event) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const reposition = () => { if (trigger.current) setPosition(menuPosition(trigger.current.getBoundingClientRect())); };
    const onScroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) reposition(); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [menuOpen]);

  useEffect(() => () => {
    // Deletion or collapsing a branch can remove the original focus target.
    if (document.activeElement === document.body) onRemovedFocus();
  }, [onRemovedFocus]);

  const action = (run: () => void) => { close(); run(); };
  const scope = getComponentScope(diagram);
  const fullDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return <>
    <button ref={trigger} className="saved-diagram-actions" type="button" aria-label={`Actions for ${diagram.name}; diagram ${diagram.id}`} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? menuId : undefined} onClick={() => {
      if (position) { close(); return; }
      setPosition(menuPosition(trigger.current!.getBoundingClientRect()));
    }}>⋯</button>
    {position && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={`Actions for ${diagram.name}`} className="saved-diagram-menu" style={position} onKeyDown={event => {
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); close(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    }}>
      <button type="button" role="menuitem" onClick={() => action(() => setDetailsOpen(true))}>Details…</button>
      <button type="button" role="menuitem" onClick={() => action(() => window.dispatchEvent(new CustomEvent('adr:archive-transfer', { detail: { id: diagram.id } })))}>Export archive…</button>
      <button type="button" role="menuitem" className={trashed ? undefined : 'saved-diagram-delete'} disabled={busy} onClick={() => action(() => trashed ? window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind: 'restore', id: diagram.id } })) : onDelete(diagram.id))}>{trashed ? 'Restore' : 'Move to trash…'}</button>
    </div>, document.body)}
    {detailsOpen && createPortal(<ConfirmDialog role="dialog" title="Diagram details" cancelLabel="Close" onCancel={() => setDetailsOpen(false)} message={<span className="saved-diagram-details">
      <strong>{diagram.name}</strong>{'\n'}{diagramTypeLabel(diagram)}
      {diagram.kind === 'container' && `\nSoftware System: ${diagram.scope?.softwareSystemName ?? 'Unavailable'}\nParent: ${diagram.scope?.parentDiagramName ?? 'Unavailable'}\nParent ID: ${diagram.scope?.parentDiagramId ?? 'Unavailable'}\nOwner ID: ${diagram.scope?.softwareSystemId ?? 'Unavailable'}`}
      {scope && `\nContainer: ${scope.containerName}\nParent Container: ${scope.parentDiagramName}\nSoftware System: ${scope.softwareSystemName}\nParent ID: ${scope.parentDiagramId}\nOwner ID: ${scope.containerId}\nSystem Context ID: ${scope.systemContextDiagramId}`}
      {'\n'}Diagram ID: {diagram.id}{'\n'}Created: {fullDate(diagram.createdAt)}{'\n'}Last saved: {fullDate(diagram.updatedAt)}
    </span>} />, document.body)}
  </>;
}
