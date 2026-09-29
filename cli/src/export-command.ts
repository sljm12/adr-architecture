import { open, stat, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import { buildHtmlPackage } from '../../shared/src/export/html-package.js';
import { uuidSchema } from '../../shared/src/validation/schemas.js';
import type { ApiClient } from './api-client.js';

type ExportFileOps = {
  openFile?: (path: string, flags: string) => Promise<FileHandle>;
  removeFile?: (path: string) => Promise<void>;
  statPath?: (path: string) => Promise<{ isDirectory(): boolean }>;
};

export async function exportDiagramCommand(
  client: Pick<ApiClient, 'getDiagram' | 'listFullAdrs'>,
  diagramId: string,
  outputPath: string,
  options: ExportFileOps & { cwd?: string; write?: (text: string) => void } = {},
): Promise<void> {
  if (!uuidSchema.safeParse(diagramId).success) throw new Error(`Invalid diagram ID "${diagramId}". Provide a valid UUID.`);
  if (!outputPath.trim() || !outputPath.toLowerCase().endsWith('.zip')) throw new Error('The export destination must be a file path ending in .zip.');

  const destination = resolve(options.cwd ?? process.cwd(), outputPath);
  const parent = dirname(destination);
  let parentInfo: { isDirectory(): boolean };
  try {
    parentInfo = await (options.statPath ?? stat)(parent);
  } catch (cause) {
    throw new Error(`The output directory does not exist or cannot be accessed: ${parent}`, { cause });
  }
  if (!parentInfo.isDirectory()) throw new Error(`The output parent path is not a directory: ${parent}`);

  const diagram = await client.getDiagram(diagramId);
  if (diagram.id !== diagramId) throw new Error(`The service returned diagram ${diagram.id}, which does not match requested ID ${diagramId}.`);
  if (diagram.status !== 'active') throw new Error(`Diagram ${diagramId} is not active and cannot be exported.`);
  const adrs = await client.listFullAdrs(diagramId);
  const files = buildHtmlPackage({ diagram, adrs });
  const zip = new JSZip();
  for (const [path, contents] of Object.entries(files)) zip.file(path, contents);
  const bytes = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const openFile = options.openFile ?? ((path, flags) => open(path, flags));
  const removeFile = options.removeFile ?? unlink;
  let handle: FileHandle | undefined;
  let created = false;
  try {
    handle = await openFile(destination, 'wx');
    created = true;
    await handle.writeFile(bytes);
    await handle.close();
    handle = undefined;
  } catch (cause) {
    if (handle) await handle.close().catch(() => undefined);
    if (created) await removeFile(destination).catch(() => undefined);
    const detail = cause instanceof Error ? cause.message : String(cause);
    if ((cause as NodeJS.ErrnoException)?.code === 'EEXIST') throw new Error(`The output file already exists and was not changed: ${destination}`, { cause });
    throw new Error(`Could not write export file ${destination}: ${detail}`, { cause });
  }
  (options.write ?? (text => process.stdout.write(text)))(`Exported diagram to ${destination}\n`);
}
