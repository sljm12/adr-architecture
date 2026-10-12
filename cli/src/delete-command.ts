import { createInterface } from 'node:readline/promises';
import type { ApiClient } from './api-client.js';
import { ApiClientError } from './api-client.js';
import type { CliIo } from './main.js';
import type { DeletionPreview } from '../../shared/src/validation/schemas.js';

export const terminalText = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

async function confirm(): Promise<string | null> {
  const input = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    return await Promise.race([
      input.question('Continue? Type yes to confirm: ').catch(() => null),
      new Promise<null>(resolve => { input.once('close', () => resolve(null)); input.once('SIGINT', () => resolve(null)); }),
    ]);
  } finally { input.close(); }
}

export async function deleteDiagramCommand(client: ApiClient, request: DeletionPreview, yes: boolean, io: CliIo): Promise<number> {
  try {
    const preview = await client.previewDeletion(request);
    const rows = preview.affectedDiagrams.map(d => `${terminalText(d.name)} (${d.id}) [${d.status}]`).join('\n');
    io.stdout(`Mode: ${preview.mode}\nRoot: ${terminalText(preview.affectedDiagrams[0].name)} (${preview.rootDiagramId})\nAffected saved diagrams:\n${rows}\nContained components, relationships, groups, ADRs and links are included.\n`);
    io.stdout(preview.mode === 'permanent'
      ? 'Permanent deletion is irreversible. All contained artifacts, ADRs and links, including previously trashed descendants, will be removed and cannot be restored through Trash.\n'
      : 'Trash is recoverable through the application; earlier Trash batches are preserved.\n');
    if (!yes) {
      if (!(io.isTTY ?? process.stdin.isTTY)) throw new Error('Interactive confirmation is unavailable. Rerun with --yes only after reviewing the intended saved deletion scope.');
      let answer: string | null;
      try { answer = await (io.confirm ?? confirm)(); } catch { answer = null; }
      if (answer?.trim().toLowerCase() !== 'yes') throw new Error('Deletion cancelled. No deletion request was sent.');
    }
    const result = await client.executeDeletion(preview.rootDiagramId, { mode: preview.mode, confirmationToken: preview.confirmationToken });
    io.stdout(`${result.mode === 'permanent' ? 'Permanently deleted' : 'Moved to Trash'}: ${terminalText(result.affectedDiagrams[0].name)} (${result.rootDiagramId})\n${result.affectedDiagrams.map(d => `${terminalText(d.name)} (${d.id})`).join('\n')}\n`);
    return 0;
  } catch (error) {
    io.stderr(`${terminalText(error instanceof Error ? error.message : String(error))}\n`);
    if (error instanceof ApiClientError) {
      for (const d of error.detail?.candidates ?? []) io.stderr(`${terminalText(d.name)} (${d.id}) [${d.status}]\n`);
      for (const b of error.detail?.blockers ?? []) io.stderr(`${b.diagramId} / ${b.artifactId}: ${terminalText(b.reason)} ${terminalText(b.nextAction)}\n`);
    }
    return 1;
  }
}
