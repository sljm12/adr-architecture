import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createApiClient } from './api-client.js';
import { listDiagramsCommand } from './diagrams-command.js';
import { formatError } from './output.js';
import { exportDiagramCommand } from './export-command.js';

const helpText = `ADR Diagram CLI

Usage:
  npm run cli -- diagrams list [--name <text>] [--format table|json]
  npm run cli -- diagrams export <diagram-id> --output <path.zip>
  npm run cli -- --help

Commands:
  diagrams list   List active diagrams. --name filters by a case-insensitive name substring.
                  --format table (default) or json selects readable or script-friendly output.
  diagrams export <diagram-id> --output <path.zip>
                  Export the saved diagram and its complete ADR set by stable UUID to a ZIP.
                  The destination must end in .zip, its parent must exist, and existing files
                  are never overwritten.

Configuration:
  ADR_DIAGRAM_API_URL  Service root URL (default: http://localhost:3000).

Common errors:
  Check that the service is running and ADR_DIAGRAM_API_URL is correct. Confirm the diagram ID,
  package validity, and that the output directory exists and is writable. Diagnostics go to
  standard error; exit status 1 indicates an operation failure and 2 indicates invalid usage.
`;

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

function usage(message: string): UsageError {
  return new UsageError(`${message}\nRun with --help for usage.`);
}

export async function runCli(argv: string[], io: CliIo = {
  stdout: text => process.stdout.write(text),
  stderr: text => process.stderr.write(text),
}, client?: ReturnType<typeof createApiClient>): Promise<number> {
  try {
    return await runCliCommand(argv, io, client);
  } catch (error) {
    io.stderr(`${formatError(error)}\n`);
    return error instanceof UsageError ? 2 : 1;
  }
}

async function runCliCommand(argv: string[], io: CliIo, client?: ReturnType<typeof createApiClient>): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        name: { type: 'string' },
        format: { type: 'string' },
        output: { type: 'string' },
      },
    });
  } catch (error) {
    throw usage(formatError(error));
  }
  const { positionals, values } = parsed;
  if (values.help) {
    io.stdout(helpText);
    return 0;
  }
  if (positionals[0] !== 'diagrams' || positionals.length < 2) throw usage('Expected a diagrams list or export command.');

  const command = positionals[1];
  if (command === 'list') {
    if (positionals.length !== 2) throw usage('The list command does not accept positional arguments.');
    if (values.output !== undefined) throw usage('--output is only valid for export.');
    const format = values.format ?? 'table';
    if (format !== 'table' && format !== 'json') throw usage('--format must be table or json.');
    await listDiagramsCommand(client ?? createApiClient(), { name: typeof values.name === 'string' ? values.name : undefined, format, write: io.stdout });
    return 0;
  }
  if (command === 'export') {
    if (positionals.length !== 3) throw usage('Export requires exactly one diagram UUID.');
    if (values.name !== undefined || values.format !== undefined) throw usage('--name and --format are only valid for list.');
    if (typeof values.output !== 'string' || !values.output.trim()) throw usage('Export requires --output <path.zip>.');
    await exportDiagramCommand(client ?? createApiClient(), positionals[2], values.output, { write: io.stdout });
    return 0;
  }
  throw usage(`Unknown diagrams command: ${command}.`);
}

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
