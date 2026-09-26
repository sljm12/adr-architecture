# CLI Contract: Diagram Listing and Package Export

The first release runs from the repository checkout through the root npm script. The CLI makes read-only requests to the configured ADR Diagram service.

## Configuration

- `ADR_DIAGRAM_API_URL` sets the service root. It defaults to `http://localhost:3000`, matching the local backend port. The value must be an absolute HTTP or HTTPS URL without query or fragment; the CLI appends the documented route paths.
- The initial single-user service does not require a CLI credential. Authentication is outside this feature.
- The backend must be available for list and export commands. The CLI does not connect to PostgreSQL directly.

## Commands

```text
npm run cli -- diagrams list [--name <text>] [--format table|json]
npm run cli -- diagrams export <diagram-id> --output <path.zip>
npm run cli -- --help
npm run cli -- diagrams --help
```

`--name` trims surrounding whitespace and performs a case-insensitive substring match. Omitting it or supplying only whitespace lists all returned active diagrams. `--format` defaults to `table`; `json` emits a JSON array of the validated diagram summaries. An empty result is a successful query and emits an empty table state or `[]`.

The table format includes stable ID, name, creation date, and update date when available. Duplicate names are allowed and remain distinguishable by ID.

The export command requires a stable diagram UUID and an output path ending in `.zip`. Relative output paths resolve from the current working directory. The parent directory must exist. Existing destination files are never overwritten.

## Service reads

| Operation | Request | Expected result |
|---|---|---|
| List diagrams | `GET /diagrams` | Active diagram summary array validated with `diagramSummaryListSchema`; the CLI applies the optional name filter locally. |
| Load selected diagram | `GET /diagrams/{diagramId}` | Persisted active diagram document validated with `diagramDocumentSchema`. |
| Load full ADR set | `GET /diagrams/{diagramId}/adrs/full` | All ADRs for the selected diagram, including unlinked records and all statuses, validated with `architectureDecisionRecordListSchema`. |

No API write request is permitted. Export input comes from persisted server state, not unsaved browser state. The validated diagram and ADR list go to `buildHtmlPackage`; JSZip then creates the archive with the same file manifest and compression settings as the application package export.

## Output and errors

- Successful table and JSON list output goes to standard output. JSON output contains only the result array so scripts can parse it.
- Successful export prints the resulting destination path only after a complete ZIP has been written.
- Diagnostics go to standard error. They identify usage, connection, HTTP, schema or package validation, and local path or write failures without exposing credentials.
- Exit status `0` means the requested operation succeeded, including an empty list. Status `1` means a service, validation, or filesystem operation failed. Status `2` means command usage or argument validation failed.
- Invalid IDs, missing or trashed diagrams, inaccessible services, malformed responses, unsupported content, invalid package references, existing output paths, and unwritable destinations never produce a success status.
- Package validation completes before the output file is opened. The destination is created exclusively; if writing fails after creation, the CLI removes its incomplete output when possible and reports failure.

## Package compatibility

The archive must conform to [the established ZIP package contract](../../../specs/007-export-interactive-html/contracts/package-format.md). No new HTTP endpoint or package format is introduced.
