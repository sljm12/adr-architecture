import type { AdrStatus } from '../../../shared/src/index';
import './adr-status.css';

const labels: Record<AdrStatus, string> = {
  draft: 'Draft',
  accepted: 'Accepted',
  superseded: 'Superseded',
  rejected: 'Rejected',
};

export function AdrStatusBadge({ status }: { status: AdrStatus }) {
  return <span className={`adr-status adr-status-${status}`}>{labels[status]}</span>;
}
