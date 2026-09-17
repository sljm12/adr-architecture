# Implementation Plan: Manage Diagram List

**Branch**: `004-manage-diagram-list` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-manage-diagram-list/spec.md`

## Summary

Extend the existing Your Artifact Diagram panel so authors can find, organize, open, and
reversibly delete active diagrams. The existing persisted diagram records already contain an
immutable `createdAt` value and the API already supports moving a diagram to trash, so this feature
adds the creation date to the lightweight summary contract, applies name/date filtering and
name/date sorting in the panel, and adds a confirmed deletion workflow that preserves recovery.

Filtering and sorting remain transient view state because the requested scale is a single-user
panel of up to 100 active diagrams and no server-side query language is needed. Deletion is routed
through the existing diagram store/API boundary, with the workspace coordinating unsaved current
diagram changes before the panel removes the deleted summary.

## Technical Context

**Language/Version**: TypeScript 5.8 strict mode; React 19.1; Node.js current LTS runtime; Vite 7

**Primary Dependencies**: React + Vite, Zustand 5, Zod 3.25, Fastify 5.4, Drizzle ORM 0.44,
PostgreSQL via `pg` 8.16, Vitest 3.2, Playwright 1.54, matching the repository manifests

**Storage**: Existing PostgreSQL `diagrams.created_at`, `updated_at`, `status`, and `trashed_at`
fields. No new tables or migration are required. Active list summaries expose the existing
creation timestamp; deletion changes status to `trashed` through the existing recovery path.

**Testing**: Vitest for shared summary validation, store/list derivation, API behavior, and error
handling; Playwright for filtering, sorting, opening duplicate names, confirmation/cancellation,
deletion, recovery, unsaved-change protection, empty states, and keyboard accessibility.

**Target Platform**: Modern desktop browser for the React frontend with the existing Fastify API
and managed PostgreSQL deployment.

**Project Type**: Existing browser-based, single-user web application with a REST backend.

**Performance Goals**: For up to 100 active diagrams, filtering and sorting should update the panel
within two seconds of a user change and must not require a network request for each keystroke or
sort selection. Deletion feedback remains within the existing request feedback conventions.

**Constraints**: Original creation dates are immutable and must not be replaced by last-saved dates.
Name matching is a trimmed, case-insensitive substring match. Date ranges are inclusive and use
displayed calendar dates. Filters and sorting are local panel state and do not need session
persistence. Diagram identity is always the stable UUID, including duplicate names. Delete means
recoverable trash, not irreversible removal. The panel must remain consistent if load or deletion
fails and must not silently discard unsaved work.

**Scale/Scope**: One active diagram list for one user; up to 100 active diagrams in the target
workflow. The feature changes the active diagram summary contract and panel workflow only. It does
not add pagination, server-side filtering, permissions, collaboration, permanent deletion, or a
new recovery model.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Architecture is a linked, versioned artifact - PASS**: The list uses stable diagram UUIDs
  for opening and deletion. Filtering and sorting do not rewrite artifact identities, and trash
  preserves the complete diagram document for recovery.
- **II. Decisions are first-class and explainable - PASS / N/A for ADR creation**: The feature does
  not change ADR content or lifecycle. It preserves ADRs and their component/relationship links
  when a diagram is moved to trash and restored.
- **III. User actions protect architectural data - PASS**: Delete requires explicit confirmation,
  is implemented through recoverable trash, protects unsaved current work, reports failures, and
  leaves the affected summary visible when deletion does not succeed.
- **IV. Artifact-boundary quality - PASS**: The summary schema, list API response, store state,
  panel rendering, trash transition, restore round trip, and end-to-end user workflows are covered
  by the design and validation artifacts below.
- **V. Simplicity and accessibility - PASS**: The design reuses the existing panel, store, API,
  confirmation dialog, status feedback, and visual tokens. Controls have readable labels, keyboard
  access, visible focus, and sufficient contrast; no new subsystem is introduced.
- **Delivery and quality gates - PASS**: Affected diagram summary and status fields, reference
  preservation, API contract changes, UI states, and automated validation are explicitly identified.

## Project Structure

### Documentation (this feature)

```text
specs/004-manage-diagram-list/
├── plan.md                 # This file ($speckit-plan command output)
├── research.md             # Phase 0 decisions and repository findings
├── data-model.md           # Phase 1 summary, view-state, and deletion model
├── quickstart.md           # Phase 1 runnable validation guide
├── contracts/
│   └── openapi.yaml        # Affected list and recoverable-delete contract
└── tasks.md                # Phase 2 output ($speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
shared/
├── src/domain/types.ts             # DiagramSummary gains createdAt
└── src/validation/schemas.ts       # Summary validation includes createdAt

backend/
├── src/api/diagram-routes.ts       # Active-list summaries include createdAt
├── src/api/recovery-routes.ts      # Trash summaries include createdAt
├── src/services/diagram-service.ts # Preserve existing trash semantics/errors
└── tests/                          # Summary, delete, and recovery API coverage

frontend/
├── src/api/diagram-client.ts       # Typed summary/trash operations
├── src/state/diagram-store.ts      # Summary normalization and deletion state/action
├── src/components/SavedDiagramList.tsx # Filter, sort, status, and delete controls
├── src/components/DiagramWorkspace.tsx  # Unsaved-change deletion orchestration
├── src/components/saved-diagram-list.css # Panel controls and states
└── tests/                          # Derived list, UI, store, and accessibility coverage

e2e/
└── tests/diagram-list-management.spec.ts # End-to-end list-management workflows
```

**Structure Decision**: Extend the existing `shared/`, `backend/`, `frontend/`, and `e2e/`
boundaries. Shared types and validation own the summary contract; the backend exposes the existing
persisted creation timestamp and recoverable deletion; Zustand owns server-backed list updates; the
React panel owns transient filter/sort presentation state; and the workspace owns unsaved-change
coordination. No new package, table, or persistence protocol is needed.

## Implementation Design

### Phase 0: Research decisions

1. Confirm the existing list boundary and summary shape. The active list is loaded from
   `GET /api/diagrams`, while complete documents already carry `createdAt`; therefore add only the
   missing summary field and avoid fetching complete documents merely to filter or sort.
2. Confirm deletion semantics. Reuse `DELETE /api/diagrams/:diagramId`, which changes an active
   diagram to `trashed`, plus the existing trash/restore workflow. Do not introduce irreversible
   deletion or a second delete endpoint.
3. Confirm transient view-state ownership. Keep name/date filters and sort field/direction inside
   `SavedDiagramList` (or a small pure helper used by it), while keep server-backed summaries and
   delete status in `useDiagramStore`. This keeps panel preferences out of the architecture
   document and avoids adding persistence for a view concern.
4. Confirm unsaved-change handling. Follow the existing `DiagramWorkspace` load/new-dialog pattern:
   when deleting the currently open diagram with unsaved diagram or ADR edits, require an explicit
   save, discard, or cancel decision before calling trash. A canceled or failed decision leaves the
   current document and active summary unchanged.

### Phase 1: Design and implementation slices

1. **Shared summary contract**: Extend `DiagramSummary` in `shared/src/domain/types.ts` with
   `createdAt`. Extend `diagramSummarySchema` in `shared/src/validation/schemas.ts` with a required
   date-time-compatible string field while retaining `id`, `name`, `status`, and `updatedAt`.
   Keep complete `Diagram` and `DiagramDocument` identity/timestamp semantics unchanged.
2. **Backend list response**: Update the summary mapper in `backend/src/api/diagram-routes.ts` and
   the trash-summary mapper in `backend/src/api/recovery-routes.ts` to return `createdAt` from the
   persisted diagram. Keep the active-only list behavior and existing delete route. Ensure
   service/repository trash and restore operations continue to preserve `createdAt`, components,
   relationships, groups, ADRs, and links. Add or update tests that prove active and trash list
   responses contain the original creation date and a delete failure does not mutate the active
   record.
3. **OpenAPI contract**: Add the affected `/diagrams` list response, `/diagrams/{diagramId}`
   delete response, `/diagrams/trash`, and `/diagrams/{diagramId}/restore` definitions to
   `contracts/openapi.yaml`. Mark `createdAt` required in `DiagramSummary`, describe delete as a
   recoverable move to trash, and document not-found/error behavior. Keep request/response IDs
   stable and avoid adding filter/sort query parameters because those operations are local.
4. **Store/client behavior**: Update `frontend/src/api/diagram-client.ts` and
   `frontend/src/state/diagram-store.ts` so summaries include `createdAt`, local summary updates
   retain it after save, and a dedicated deletion action calls the existing trash endpoint. On
   success remove only the target UUID from `savedDocuments`, expose success/error status for the
   panel, and refresh or reconcile from the API when appropriate. On failure retain the target
   summary and the last valid document state.
5. **Filtering and sorting model**: Add pure, unit-testable list derivation logic for trimmed
   case-insensitive name matching, optional inclusive start/end calendar dates, combined AND
   filtering, name/creation-date sort fields, both directions, and deterministic tie-breaking by
   normalized name then stable UUID. Use newest creation date descending as the initial order.
   Validate an end date before a start date and expose an actionable range error without silently
   returning misleading results.
6. **Panel UI**: Extend `SavedDiagramList.tsx` to show the original creation date, a labeled name
   input, start/end date controls, sort field/direction controls, and a clear-filters action. Render
   separate empty-list and no-match states, retain open buttons keyed by UUID, and add a separate
   labeled delete button for each entry. Disable or label the delete action while it is in progress;
   announce loading, errors, success, and no-match states with the existing status conventions.
   Update `saved-diagram-list.css` using `DESIGN.md` tokens, visible focus, 44px targets, readable
   spacing, and contrast that does not rely on color alone.
7. **Deletion and unsaved-work orchestration**: Add panel callbacks into `DiagramWorkspace.tsx`.
   Show a diagram-specific confirmation before deletion, naming the diagram and explaining trash
   recovery. For the current diagram, branch through the existing unsaved diagram/ADR save,
   discard, or cancel behavior before invoking the store deletion action. After successful deletion
   of the current diagram, clear or transition the editor to the existing empty/new-diagram state;
   never leave a trashed document presented as active. Preserve unrelated open documents and list
   entries.
8. **Verification**: Add shared tests for summary validation and creation-date retention; backend
   tests for list field presence, active/trashed transitions, not-found/failure behavior, and
   restore preservation; frontend tests for filter combinations, inclusive date boundaries, invalid
   ranges, sorting/ties/duplicate names, clear/reset, deletion confirmation and failure states,
   stable UUID actions, and accessibility labels/statuses; and Playwright tests for the complete
   user journeys in the feature spec, including current unsaved changes and keyboard-only use.

## Post-design Constitution Re-check

**PASS**: The design keeps diagram identity and all contained architecture references stable while
  moving only the diagram status between active and trashed. It adds no new persistence table or
  ad-hoc storage; exposes the original creation timestamp through validated shared/API contracts;
  requires explicit recoverable deletion confirmation; handles unsaved work and failures without
  silent data loss; and validates the list, store, panel, accessibility, delete, restore, and
  end-to-end boundaries. Filtering and sorting remain the smallest local view-state design needed
  for the specified scale.

## Complexity Tracking

No constitution violations require justification. The only new state is a summary creation-date
field, transient list controls, and explicit deletion status needed to satisfy the feature’s filter,
sort, confirmation, recovery, and failure-feedback requirements.
