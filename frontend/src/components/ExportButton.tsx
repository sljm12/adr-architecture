import { useState } from 'react';
import { exportClient } from '../api/export-client';
import { DiagramApiError } from '../api/diagram-client';
import { useDiagramStore, type SaveStatus } from '../state/diagram-store';

export function getExportBlockReason(status: SaveStatus): string | null {
  if (status === 'unsaved') return 'Save changes before exporting. Export uses the last saved diagram.';
  if (status === 'saving') return 'Wait for saving to finish before exporting.';
  if (status === 'failed') return 'Resolve the save failure before exporting.';
  return null;
}

export function formatExportError(error: unknown): string {
  if (error instanceof DiagramApiError && error.status === 422) {
    const fields = error.details.fields;
    const groupField = fields && typeof fields === 'object'
      ? Object.entries(fields as Record<string, unknown>).find(([field]) => field.startsWith('groups['))
      : undefined;
    return groupField ? `${error.message} (${groupField[0]}: ${String(groupField[1])})` : error.message;
  }
  return error instanceof Error ? error.message : 'Mermaid export failed.';
}

export function ExportButton() {
  const [message, setMessage] = useState('');
  const document = useDiagramStore(state => state.document);
  const status = useDiagramStore(state => state.status);

  const exportDiagram = async () => {
    if (!document) return;
    const blockReason = getExportBlockReason(status);
    if (blockReason) {
      setMessage(blockReason);
      return;
    }

    setMessage('Preparing Mermaid export…');
    try {
      await exportClient.downloadMermaid(document.id);
      setMessage('Exported Mermaid file.');
    } catch (error) {
      setMessage(formatExportError(error));
    }
  };

  return <div className="export-control"><button className="primary-pill" type="button" onClick={() => void exportDiagram()} disabled={!document} aria-describedby="export-description export-status">Export Mermaid</button><p id="export-description" className="export-description">Groups export as labeled Mermaid subgraphs. Exact canvas positions are not exported.</p><p id="export-status" className="export-status" role="status" aria-live="polite" aria-atomic="true">{message}</p></div>;
}
