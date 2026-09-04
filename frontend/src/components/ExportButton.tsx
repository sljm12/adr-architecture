import { useState } from 'react';
import { exportClient } from '../api/export-client';
import { useDiagramStore, type SaveStatus } from '../state/diagram-store';

export function getExportBlockReason(status: SaveStatus): string | null {
  if (status === 'unsaved') return 'Save changes before exporting. Export uses the last saved diagram.';
  if (status === 'saving') return 'Wait for saving to finish before exporting.';
  if (status === 'failed') return 'Resolve the save failure before exporting.';
  return null;
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
      setMessage(error instanceof Error ? error.message : 'Mermaid export failed.');
    }
  };

  return <div className="export-control"><button className="primary-pill" type="button" onClick={() => void exportDiagram()} disabled={!document} aria-describedby="export-status">Export Mermaid</button><p id="export-status" className="export-status" role="status" aria-live="polite" aria-atomic="true">{message}</p></div>;
}
