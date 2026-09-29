# Quickstart: CLI Diagram Export

## Prerequisites

- Node.js 22 and npm dependencies installed with `npm ci`.
- The ADR Diagram backend is running and connected to its configured PostgreSQL database.
- At least one active, saved diagram is available. For package validation, use a diagram with components, relationships, groups, linked and unlinked ADRs, and more than one ADR status.

## Run the CLI

Set the service URL if the backend is not at its local default. In PowerShell:

```powershell
$env:ADR_DIAGRAM_API_URL = "http://localhost:3000"
```

List active diagrams in a readable table, then filter by part of a name:

```text
npm run cli -- diagrams list
npm run cli -- diagrams list --name payments
```

For scripts, request JSON:

```text
npm run cli -- diagrams list --format json
```

Copy a stable diagram ID from the list and replace the example value below before exporting it to a new ZIP file:

```text
npm run cli -- diagrams export 00000000-0000-4000-8000-000000000001 --output .\architecture.zip
```

The command prints the created path on success. Extract the archive and open `index.html` without a network connection; the archive should contain the existing package manifest and all ADR Markdown files. The source diagram and ADR data remain unchanged.

## Validate expected failures

- Repeat export to the same output path. It must fail without replacing the existing ZIP.
- Export an unknown or trashed diagram ID. It must fail and print a diagnostic to standard error.
- Stop the backend and list diagrams. It must fail with a connection diagnostic and a nonzero exit status.
- Export a diagram that the shared package builder rejects. It must identify the affected content and must not report a complete package.
- Run `npm run cli -- --help` and verify the documented operations, options, configuration, and common errors are described.

## Automated validation

Run the repository build and Vitest suite:

```text
npm run build
npm test
```

CLI tests should cover argument usage, filtering and both output formats; schema and HTTP failures; export calls using saved diagram and full ADR responses; ZIP file compatibility; output collision and write failure cleanup; and the absence of API mutation requests.
