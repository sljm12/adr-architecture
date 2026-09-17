# Research: Manage Diagram List

## Decision 1: Filter and sort the loaded active summaries in the panel

**Decision**: Apply name/date filtering and name/creation-date sorting to the active diagram
summaries already loaded by `GET /api/diagrams`. Keep the controls as transient panel state.

**Rationale**: The feature targets up to 100 active diagrams, and the current panel already loads
the complete active summary collection. Local derivation gives immediate combined filtering and
sorting without adding query syntax, pagination behavior, or a second API contract. It also keeps
view preferences out of persisted architecture artifacts.

**Alternatives considered**:

- Add server-side `name`, `createdFrom`, `createdTo`, `sort`, and `direction` query parameters:
  rejected for this scope because it adds contract and pagination complexity without a stated need
  for larger collections.
- Fetch each complete diagram before filtering:
  rejected because the list only needs summary fields and the complete documents contain unrelated
  architecture data.

## Decision 2: Add `createdAt` to the diagram summary contract

**Decision**: Extend the shared `DiagramSummary`, summary validation, backend list mapper, and
OpenAPI list response with the persisted diagram `createdAt` field.

**Rationale**: The database and complete diagram document already preserve the original creation
timestamp. The current summary omits it and exposes only `updatedAt` as “last saved”, which cannot
support the requested creation-date filter or sort. Adding the field is backward-compatible for
the existing server-side data and makes the list’s displayed date unambiguous.

**Alternatives considered**:

- Use `updatedAt` as the creation date: rejected because editing would change the apparent creation
  date and violates the feature requirement.
- Derive creation time from UUIDs: rejected because stable UUIDs are identifiers, not a documented
  creation-time source.

## Decision 3: Use existing recoverable trash for panel deletion

**Decision**: The panel’s Delete action calls the existing diagram delete route, which moves an
active diagram to trash. The panel removes the summary only after success; restore remains in the
existing recovery workflow.

**Rationale**: The repository already has active/trashed status, `trashedAt`, delete, list-trash,
and restore behavior. Reusing it satisfies the constitution’s recoverability requirement and keeps
the complete diagram—including components, relationships, groups, ADRs, links, identities, and
creation date—available for restoration.

**Alternatives considered**:

- Permanently delete the diagram and its contents: rejected because it risks irreversible loss of
  architectural knowledge and conflicts with the project constitution.
- Add a panel-only hidden flag: rejected because it would create a second deletion state outside
  the existing persistence and recovery model.

## Decision 4: Keep deletion coordination at the workspace boundary

**Decision**: Let `SavedDiagramList` emit a delete request, while `DiagramWorkspace` coordinates
confirmation and current-document unsaved changes before invoking a store deletion action.

**Rationale**: The workspace already owns current-document status, ADR status, loading protection,
and the save/discard/cancel dialog when switching diagrams. Keeping this decision at the same
boundary prevents the list from silently discarding edits and lets the panel remain reusable for
non-current entries.

**Alternatives considered**:

- Let the list call the API directly: rejected because it cannot safely inspect or resolve unsaved
  diagram and ADR edits.
- Block deletion of the current diagram entirely: rejected because it leaves a valid management
  action unavailable and provides a poorer workflow than the existing save/discard/cancel pattern.

## Decision 5: Use inclusive local-calendar date ranges and deterministic ties

**Decision**: Interpret optional start/end values as inclusive displayed calendar dates. Match names
case-insensitively after trimming. Sort equal values by normalized name, then stable UUID.

**Rationale**: Inclusive ranges match author expectations for date filters, while local calendar
dates avoid exposing timestamp/time-zone details in the primary interaction. A deterministic UUID
tie-breaker keeps duplicate names and equal timestamps independently selectable and stable across
refreshes.

**Alternatives considered**:

- Exact timestamp filtering: rejected because the requested control is a creation-date filter, not a
  timestamp query.
- Server/database collation for name matching: rejected because matching and sorting need consistent
  behavior across the browser and API and the feature is local to one loaded collection.
