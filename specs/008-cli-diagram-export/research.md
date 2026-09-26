# Research: CLI Diagram Export

## Decisions

### Use a small TypeScript CLI that runs with the existing repository toolchain

**Decision**: Add the CLI as a sibling `cli/` project, following the repository's `shared/`, `backend/`, and `frontend/` layout. Use the installed Node.js 22 runtime and existing TypeScript, `tsx`, and Vitest toolchain. Use Node's built-in `util.parseArgs`, `fetch`, and filesystem APIs rather than adding a CLI or HTTP framework. Run the first release from the repository checkout through a root npm script.

**Rationale**: The repository has no CLI project or npm workspaces, but it already uses strict TypeScript projects, shared source imports, and root scripts. This keeps the feature inside existing build and test conventions without introducing a packaging service or external dependency.

**Alternatives considered**: A published global npm package would require a package distribution decision and a separately installable shared package, neither of which is specified. A third-party CLI framework adds a dependency for two read-only commands. A one-off script outside the project structure would not fit the existing build and test workflow.

Node.js v22.17 documentation confirms `util.parseArgs` is stable and supports strict argument handling. The filesystem API supports exclusive creation (`open` with `wx`) so an existing output file cannot be replaced. See [Node.js util.parseArgs](https://nodejs.org/docs/v22.17.0/api/util.html#utilparseargsconfig), [Node.js fetch](https://nodejs.org/docs/v22.17.0/api/globals.html#fetch), and [Node.js filesystem promises](https://nodejs.org/docs/v22.17.0/api/fs.html#fspromisesopenpath-flags-mode).

### Read diagrams through the existing HTTP API

**Decision**: Configure the service root with `ADR_DIAGRAM_API_URL`, defaulting to `http://localhost:3000`. Use `GET /diagrams` for summaries, `GET /diagrams/{diagramId}` for the saved diagram, and `GET /diagrams/{diagramId}/adrs/full` for its complete ADR set. Validate returned data with shared Zod schemas. Apply the case-insensitive name substring filter in the CLI after retrieving the active diagram list.

**Rationale**: These routes already return persisted data and enforce active-diagram behavior. The list route has no name-filter query parameter, so local filtering avoids an unnecessary server contract change for the expected collection size. The CLI must not open a database connection or read unsaved browser state.

**Alternatives considered**: Adding server-side filtering or a ZIP endpoint is unnecessary for the initial scope. Connecting directly to PostgreSQL would bypass the persistence and API boundary. Using the frontend's in-memory diagram state could include edits that have not been saved and therefore would violate the specification.

Relevant existing contracts and implementation are [the diagram OpenAPI contract](../001-software-architecture-diagrams/contracts/openapi.yaml), [the package ADR contract](../007-export-interactive-html/contracts/openapi.yaml), [diagram routes](../../backend/src/api/diagram-routes.ts), and [ADR routes](../../backend/src/api/adr-routes.ts).

### Reuse the validated shared package builder and existing ZIP dependency

**Decision**: Fetch the saved diagram and full ADR list, pass them to `buildHtmlPackage` from `shared`, then archive the returned relative file map with the existing JSZip dependency using the application's current DEFLATE settings. Preserve exporter validation errors for actionable CLI diagnostics.

**Rationale**: The shared builder owns package rendering, artifact-reference checks, escaping, and the required package manifest. Reusing it prevents the CLI from drifting from browser exports. JSZip is already used by the browser export, so no new archive implementation is needed.

**Alternatives considered**: Duplicating HTML, SVG, Markdown, or validation logic in the CLI would create two package formats. Adding an API ZIP route would duplicate archive generation on the server and require a new endpoint without a requirement for it.

The package contract is [package-format.md](../007-export-interactive-html/contracts/package-format.md); the existing client flow is [export-client.ts](../../frontend/src/api/export-client.ts), and the reusable builder is [html-package.ts](../../shared/src/export/html-package.ts).

### Write local packages without replacing files or reporting partial output

**Decision**: Validate the complete snapshot and generate the ZIP bytes before opening the destination. Require an existing parent directory, create the destination exclusively, write all bytes, and report success only after the write completes. If a write fails after this invocation created the destination, remove that incomplete file and report failure.

**Rationale**: This meets the no-overwrite requirement and prevents a package validation failure from leaving a seemingly successful artifact. Exclusive file creation avoids a check-then-write race with an existing destination.

**Alternatives considered**: Writing directly with overwrite semantics can destroy a user's existing file. Opening the final path before package validation risks leaving a partial artifact when validation fails. Implicitly creating parent directories adds filesystem side effects the feature does not need.

### Keep the feature read-only and single-user

**Decision**: The CLI only reads active diagram data and writes the requested local ZIP file. It uses the existing single-user system with no account, permission, workspace, or collaboration behavior.

**Rationale**: This matches the feature specification and project architecture constraints. No database migration or server-side write route is needed.

## Validation and quality approach

- Unit-check argument parsing, name filtering, readable and JSON list output, error formatting, URL construction, and output-path handling.
- Contract-check list results against `diagramSummaryListSchema`, diagram documents against `diagramDocumentSchema`, and ADR results against `architectureDecisionRecordListSchema`.
- Exercise success and error responses from the existing GET routes, including an unknown or trashed diagram, an unavailable server, and invalid response data.
- Export representative saved diagrams and verify the ZIP manifest and offline package behavior against the existing package contract. Include unlinked and multiple ADRs, duplicate diagram names, and unsupported artifact validation.
- Verify existing output paths are preserved, write failures are reported, and no API mutation request occurs.
- Keep integration checks under the root Vitest workflow; no new database or external service is needed for command-level tests that mock the HTTP boundary.

## Risks and mitigations

- **The API must be running and reachable.** The CLI reports a connection failure with the configured service URL context and a next step; it does not attempt direct database access.
- **The current package builder rejects unsupported legacy component types.** Preserve its artifact-specific validation messages; do not drop unsupported content.
- **ZIP generation buffers the package before writing.** The selected flow matches the existing browser export's in-memory package generation and targets one diagram at a time; add streaming only if measured package sizes later require it.
- **An endpoint's response could change without matching the CLI expectation.** Shared schema validation fails closed and reports the failing response rather than exporting incomplete content.
