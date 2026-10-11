import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createApiClient } from './api-client.js';
import { listDiagramsCommand } from './diagrams-command.js';
import { formatError } from './output.js';
import { exportDiagramCommand } from './export-command.js';
import { deleteDiagramCommand } from './delete-command.js';
import { deletionPreviewSchema } from '../../shared/src/validation/schemas.js';

const helpText = `ADR Diagram CLI

Usage:
  npm run cli -- diagrams list [--name <text>] [--format table|json]
  npm run cli -- diagrams export <diagram-id> --output <path.zip>
  npm run cli -- diagrams delete (--id <uuid> | --name <exact-name>) (--trash | --permanent) [--yes]
  npm run cli -- --help

Commands:
  diagrams list   List active diagrams. --name filters by a case-insensitive name substring.
                  --format table (default) or json selects readable or script-friendly output.
  diagrams export <diagram-id> --output <path.zip>
                  Export the saved diagram and its complete ADR set by stable UUID to a ZIP.
                  The destination must end in .zip, its parent must exist, and existing files
                  are never overwritten.
  diagrams delete Select one UUID or exact, case/whitespace-sensitive saved name. Duplicate
                  names require --id. Preview includes the root and recursively owned children.
                  --trash is recoverable; --permanent is reserved and currently unavailable.
                  Type yes interactively or use --yes for scripts. Cancellation changes nothing.
                  Changed saved contents require a fresh preview. Verify active/Trash state in
                  the application before retrying an uncertain execution outcome.

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
  isTTY?: boolean;
  confirm?: () => Promise<string | null>;
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
      tokens: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        name: { type: 'string' },
        format: { type: 'string' },
        output: { type: 'string' },
        id: { type: 'string' },
        trash: { type: 'boolean' },
        permanent: { type: 'boolean' },
        yes: { type: 'boolean' },
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
  if (positionals[0] !== 'diagrams' || positionals.length < 2) throw usage('Expected a diagrams list, export or delete command.');

  const command = positionals[1];
  if (command === 'delete') {
    if (positionals.length !== 2) throw usage('Delete requires one explicit --id or --name selector; positional roots are not accepted.');
    const seen = new Set<string>();
    for (const token of parsed.tokens ?? []) if (token.kind === 'option') { if (seen.has(token.name)) throw usage(`Repeated --${token.name} is not allowed for delete.`); seen.add(token.name); }
    if (values.format !== undefined || values.output !== undefined) throw usage('--format and --output are not valid for delete.');
    if ((values.id !== undefined) === (values.name !== undefined)) throw usage('Delete requires exactly one --id or --name.');
    if (Boolean(values.trash) === Boolean(values.permanent)) throw usage('Delete requires exactly one --trash or --permanent mode.');
    const request = deletionPreviewSchema.safeParse({ selector: values.id !== undefined ? { id: values.id } : { name: values.name }, mode: values.trash ? 'trash' : 'permanent' });
    if (!request.success) throw usage('Delete requires a valid UUID or non-blank literal name.');
    return deleteDiagramCommand(client ?? createApiClient(), request.data, Boolean(values.yes), io);
  }
  if (values.id !== undefined || values.trash !== undefined || values.permanent !== undefined || values.yes !== undefined) throw usage('--id, --trash, --permanent and --yes are only valid for delete.');
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
