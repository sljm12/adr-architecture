import { useState } from 'react';
import { exportClient } from '../api/export-client';
import { DiagramApiError } from '../api/diagram-client';
import { useDiagramStore, type SaveStatus } from '../state/diagram-store';
import { useAdrStore, type AdrDraft, type AdrSaveStatus } from '../state/adr-store';
import type { DiagramDocument, HtmlExportInput } from '../../../shared/src/index';

export function captureHtmlExportInput(diagram: DiagramDocument, draft: AdrDraft | null): HtmlExportInput {
  return structuredClone({ diagram, adrs: [], draft });
}

export function getHtmlExportBlockReason(diagramStatus: SaveStatus, adrStatus: AdrSaveStatus): string | null {
  if (diagramStatus === 'saving' || adrStatus === 'saving') return 'Wait for diagram or ADR saving to finish before exporting.';
  return null;
}

export function getHtmlExportDraft(adrStatus: AdrSaveStatus, draft: AdrDraft | null, diagramId: string): AdrDraft | null {
  if (adrStatus !== 'unsaved' && adrStatus !== 'failed' && adrStatus !== 'saved') return null;
  return draft?.diagramId === diagramId ? draft : null;
}

export async function runHtmlPackageExport(
  input: HtmlExportInput,
  download: (snapshot: HtmlExportInput) => Promise<void> = exportClient.downloadHtmlPackage,
): Promise<{ success: boolean; message: string }> {
  try {
    await download(input);
    return { success: true, message: 'HTML package downloaded.' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'HTML package export failed.' };
  }
}

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
  const [htmlMessage, setHtmlMessage] = useState('');
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

  const exportHtmlPackage = async () => {
    const diagramState = useDiagramStore.getState();
    const adrState = useAdrStore.getState();
    const currentDiagram = diagramState.document;
    if (!currentDiagram) return;

    const blockReason = getHtmlExportBlockReason(diagramState.status, adrState.status);
    if (blockReason) {
      setHtmlMessage(blockReason);
      return;
    }

    const draft = getHtmlExportDraft(adrState.status, adrState.draft, currentDiagram.id);
    const snapshot = captureHtmlExportInput(currentDiagram, draft);
    setHtmlMessage('Preparing HTML package…');
    const result = await runHtmlPackageExport(snapshot);
    setHtmlMessage(result.message);
  };

  return <div className="export-control"><button className="secondary-action" type="button" onClick={() => void exportHtmlPackage()} disabled={!document} aria-describedby="html-export-description html-export-status">Export HTML package</button><button className="primary-pill" type="button" onClick={() => void exportDiagram()} disabled={!document} aria-describedby="export-description export-status">Export Mermaid</button><p id="html-export-description" className="export-status">Download an offline, interactive diagram with its linked ADRs.</p><p id="export-description" className="export-description">Groups export as labeled Mermaid subgraphs. Exact canvas positions are not exported.</p><p id="html-export-status" className="export-status" role="status" aria-live="polite" aria-atomic="true">{htmlMessage}</p><p id="export-status" className="export-status" role="status" aria-live="polite" aria-atomic="true">{message}</p></div>;
}
