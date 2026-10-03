import type { RestoreImpact, TrashImpact } from '../../../shared/src/index';
import { ConfirmDialog } from './ConfirmDialog';

export function RecoveryImpactDialog({ kind, impact, onConfirm, onCancel, busy = false, separate = false }: { kind: 'trash' | 'restore'; impact: TrashImpact | RestoreImpact; onConfirm: () => void; onCancel: () => void; busy?: boolean; separate?: boolean }) {
  const rootId = 'restoreRootDiagramId' in impact ? impact.restoreRootDiagramId : impact.diagramId;
  const root = impact.affectedDiagrams.find(d => d.id === rootId);
  const names = impact.affectedDiagrams.map(d => `${d.name} (${d.kind === 'container' ? `Container diagram, owner ${d.scope?.softwareSystemName}, parent ${d.scope?.parentDiagramName}` : 'General diagram'}; ${d.id})`).join('; ');
  const excluded = 'requestedDiagramIncluded' in impact && !impact.requestedDiagramIncluded;
  const childParent = 'requestedDiagramId' in impact && impact.requestedDiagramId !== rootId;
  const message = `${kind === 'trash' ? 'Move these diagrams to recoverable trash. All components, relationships, decisions and links remain available.' : childParent ? 'This child requires parent recovery. Restore the parent and exactly the diagrams from its trash batch.' : separate ? 'The parent is active. This child was independently trashed earlier; confirm its separate restoration.' : 'Restore exactly this confirmed trash batch.'} Affected diagrams: ${names}.${excluded ? ' The requested child was independently trashed earlier and will remain in trash. After parent recovery, you can confirm a separate child restore.' : ''}`;
  return <ConfirmDialog title={kind === 'trash' ? `Delete "${root?.name ?? rootId}"?` : `Restore "${root?.name ?? rootId}"${excluded && !childParent ? ' separately' : ''}?`} message={message} busy={busy} confirmLabel={busy ? 'Working…' : kind === 'trash' ? 'Move to trash' : 'Restore diagrams'} onConfirm={onConfirm} onCancel={onCancel} />;
}
