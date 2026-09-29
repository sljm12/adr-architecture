import type { ApiClient } from './api-client.js';
import { renderDiagramList } from './output.js';

export async function listDiagramsCommand(
  client: Pick<ApiClient, 'listDiagrams'>,
  options: { name?: string; format?: 'table' | 'json'; write?: (text: string) => void } = {},
): Promise<void> {
  const diagrams = await client.listDiagrams();
  const filter = options.name?.trim().toLocaleLowerCase();
  const filtered = filter ? diagrams.filter(diagram => diagram.name.toLocaleLowerCase().includes(filter)) : diagrams;
  const emptyMessage = filter ? `No diagrams match "${options.name?.trim()}".` : 'No active diagrams found.';
  (options.write ?? (text => process.stdout.write(text)))(renderDiagramList(filtered, options.format ?? 'table', emptyMessage));
}
