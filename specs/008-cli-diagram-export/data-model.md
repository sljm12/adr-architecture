# Data Model: CLI Diagram Export

The CLI adds no database tables and persists no diagram or ADR data. It reads existing API representations, validates them, and creates one local archive file.

## Diagram Summary

Represents an active diagram returned by `GET /diagrams` and shown by the list command.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Stable diagram identity; required and unique in the result set. |
| `name` | String | Required, non-empty after trimming; may be duplicated. |
| `status` | `active` or `trashed` | The active-list endpoint returns active diagrams; the client preserves and validates the returned value. |
| `createdAt` | Date-time string | Required by the shared summary schema. |
| `updatedAt` | Date-time string | Returned by the service and shown when available. |

Name filtering trims the query and performs case-insensitive substring matching against `name`. An empty query is equivalent to no filter. Filtering never changes identity or the server-side diagram record.

## Diagram Document

Represents the saved state returned by `GET /diagrams/{diagramId}`. The existing shared `diagramDocumentSchema` validates the document. Its stable diagram ID must match the requested ID, and its component, relationship, and group IDs and references must satisfy shared artifact validation. The API route only loads active diagrams and normalizes an absent group collection to an empty list.

## Architecture Decision Record

Represents one record returned by `GET /diagrams/{diagramId}/adrs/full`. The shared ADR list schema validates stable ADR and diagram IDs, lifecycle status, content, dates, replacement references, and component or relationship link IDs. The fetched list includes linked and unlinked ADRs in every lifecycle state. Every ADR's `diagramId` must match the selected diagram through shared package validation.

## Diagram Package

An ephemeral map of package-relative paths to text files produced by `buildHtmlPackage`, compressed into a ZIP. The established manifest contains `index.html`, `adrs.html`, `diagram.svg`, `styles.css`, and one `adrs/<adr-uuid>.md` per ADR. It contains no database identity changes, external network dependency, or runtime JavaScript.

The shared package builder is the authority for validation and file contents. A validation error prevents archive output and retains the affected artifact and field information for the CLI error message.

## Export Destination

The path selected by the author for the completed ZIP file. Relative paths resolve from the process working directory. Its parent directory must already exist, and the destination must not already exist. A failed write is reported as a failure and any incomplete file created by that attempt is removed when possible. The destination is the only persistent output of a successful CLI export.

## Relationships and lifecycle

- One diagram summary can identify zero or one diagram document for export.
- One diagram document is paired with all ADRs returned for that diagram.
- Components and relationships referenced by ADRs use stable IDs; display names are never used to resolve a link.
- The read snapshot and package file map exist only for the duration of one CLI operation.
- No source artifact state transition occurs; package creation is read-only with respect to the system.
