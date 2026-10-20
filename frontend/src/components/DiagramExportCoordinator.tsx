import { useEffect, useState } from 'react';
import { exportClient } from '../api/export-client';
import { DiagramApiError } from '../api/diagram-client';
import { getRetainedExportDiagrams, useDiagramStore, type SaveStatus } from '../state/diagram-store';
import { getRetainedExportAdrDrafts, useAdrStore, type AdrDraft, type AdrSaveStatus } from '../state/adr-store';
import type { DiagramDocument, HtmlExportInput, HtmlPackageCapture } from '../../../shared/src/index';

export function captureHtmlExportInput(diagram: DiagramDocument, draft: AdrDraft | null): HtmlExportInput {
  return structuredClone({ diagram, adrs: [], draft });
}

export function captureHtmlPackage(diagram: DiagramDocument | null, draft: AdrDraft | null, entryDiagramId = diagram!.id): HtmlPackageCapture {
  const retained = getRetainedExportDiagrams(), decisions = getRetainedExportAdrDrafts();
  const overrides: HtmlPackageCapture['overrides'] = Object.fromEntries(Object.entries(retained).map(([id, document]) => [id, { diagram: document, draft: decisions[id] ?? null }]));
  if (diagram) overrides[diagram.id] = { diagram, draft: draft?.diagramId === diagram.id ? draft : null };
  return structuredClone({ entryDiagramId, capturedAt: new Date().toISOString(),
    overrides });
}

export function getHtmlExportBlockReason(diagramStatus: SaveStatus, adrStatus: AdrSaveStatus, exporting = false): string | null {
  if (exporting) return 'An HTML package export is already in progress.';
  if (diagramStatus === 'saving' || adrStatus === 'saving') return 'Wait for diagram or ADR saving to finish before exporting.';
  return null;
}

export function getHtmlExportDraft(adrStatus: AdrSaveStatus, draft: AdrDraft | null, diagramId: string): AdrDraft | null {
  if (adrStatus !== 'unsaved' && adrStatus !== 'failed' && adrStatus !== 'saved') return null;
  return draft?.diagramId === diagramId ? draft : null;
}

export async function runHtmlPackageExport<T extends HtmlExportInput | HtmlPackageCapture>(
  input: T,
  download: (snapshot: T) => Promise<void> = exportClient.downloadHtmlPackage,
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

type ExportRequest = { id: string; name: string; format: 'html' | 'mermaid' };

export function createDiagramExportHandler(report: (format: ExportRequest['format'], message: string) => void) {
  let htmlExporting = false, mermaidExporting = false;
  return async ({ id, name, format }: ExportRequest) => {
    const say = (message: string) => report(format, `${name}: ${message}`);
    const diagramState = useDiagramStore.getState(), adrState = useAdrStore.getState();
    if (format === 'mermaid') {
      const reason = diagramState.document?.id === id
        ? getExportBlockReason(diagramState.savePending ? 'saving' : diagramState.status) : null;
      if (reason) { say(reason); return; }
      if (mermaidExporting) { say('A Mermaid export is already in progress.'); return; }
      mermaidExporting = true;
      say('Preparing Mermaid export…');
      try {
        await exportClient.downloadMermaid(id);
        say('Exported Mermaid file.');
      } catch (error) { say(formatExportError(error)); }
      finally { mermaidExporting = false; }
      return;
    }
    const reason = getHtmlExportBlockReason(diagramState.savePending ? 'saving' : diagramState.status, adrState.savePending ? 'saving' : adrState.status, htmlExporting);
    if (reason) { say(reason); return; }
    const current = diagramState.document;
    const draft = current ? getHtmlExportDraft(adrState.status, adrState.draft, current.id) : null;
    const snapshot = captureHtmlPackage(current, draft, id);
    htmlExporting = true;
    try {
      const result = await runHtmlPackageExport(snapshot, captured => exportClient.downloadHtmlPackage(captured, stage => {
        say(({ gathering: 'Gathering saved diagrams and ADRs…', validating: 'Validating captured diagrams and ADRs…', rendering: 'Rendering offline package…', archiving: 'Creating ZIP archive…' })[stage]);
      }));
      say(result.message);
    } finally { htmlExporting = false; }
  };
}

export function DiagramExportCoordinator() {
  const [message, setMessage] = useState('');
  const [htmlMessage, setHtmlMessage] = useState('');
  useEffect(() => {
    const run = createDiagramExportHandler((format, message) => (format === 'html' ? setHtmlMessage : setMessage)(message));
    const handler = (event: Event) => { void run((event as CustomEvent<ExportRequest>).detail); };
    window.addEventListener('adr:export-diagram', handler);
    return () => window.removeEventListener('adr:export-diagram', handler);
  }, []);
  return <div className="workspace-export-feedback"><p id="html-export-status" role="status" aria-live="polite" aria-atomic="true">{htmlMessage}</p><p id="export-status" role="status" aria-live="polite" aria-atomic="true">{message}</p></div>;
}
