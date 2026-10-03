import type { z } from 'zod';
import { diagramSummarySchema } from '../../shared/src/validation/schemas.js';

export type DiagramSummary = z.infer<typeof diagramSummarySchema>;

export function renderDiagramTable(diagrams: DiagramSummary[], emptyMessage = 'No active diagrams found.'): string {
  if (diagrams.length === 0) return `${emptyMessage}\n`;
  const headers = ['ID', 'Name', 'Level', 'Parent', 'Owner', 'Created', 'Updated'];
  const rows = diagrams.map(diagram => [diagram.id, diagram.name, diagram.kind === 'container' ? 'Container' : 'General', diagram.scope ? `${diagram.scope.parentDiagramName} (${diagram.scope.parentDiagramId})` : '—', diagram.scope ? `${diagram.scope.softwareSystemName} (${diagram.scope.softwareSystemId})` : '—', diagram.createdAt, diagram.updatedAt || '—']);
  const widths = headers.map((header, i) => Math.max(header.length, ...rows.map(row => row[i].length)));
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  return [line(headers), line(widths.map(width => '-'.repeat(width))), ...rows.map(line)].join('\n') + '\n';
}

export function renderDiagramList(diagrams: DiagramSummary[], format: 'table' | 'json', emptyMessage?: string): string {
  if (format === 'json') return `${JSON.stringify(diagrams, null, 2)}\n`;
  return renderDiagramTable(diagrams, emptyMessage);
}

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
