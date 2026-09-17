# Data Model: Manage Diagram List

## Existing persisted entity: Diagram

The feature uses the existing diagram record and does not add a database table or migration.

| Field | Type | Required | Rules and use |
|---|---|---:|---|
| `id` | UUID | Yes | Stable identity used for opening, deleting, filtering results, and list keys. |
| `name` | String | Yes | Human-readable name; name filtering uses a trimmed, case-insensitive substring. |
| `status` | `active \| trashed` | Yes | Active records appear in the panel; successful delete transitions the record to `trashed`. |
| `createdAt` | Date-time string | Yes | Original creation timestamp; immutable across edits, trash, restore, and summary refresh. |
| `updatedAt` | Date-time string | Yes | Last change timestamp; displayed separately from creation date when useful, but never used as the creation date. |
| `trashedAt` | Nullable date-time string | Yes | Existing recovery metadata; set when moved to trash and cleared on restore. |

## API view entity: DiagramSummary

`DiagramSummary` is the lightweight representation returned by the active list endpoint and held in
the frontend saved-document collection.

| Field | Type | Required | Rules and use |
|---|---|---:|---|
| `id` | UUID | Yes | Must remain stable and unique even when names are duplicated. |
| `name` | String | Yes | Displayed and used by the name filter. |
| `status` | `active \| trashed` | Yes | Active-list responses contain active summaries; status remains explicit for contract clarity. |
| `createdAt` | Date-time string | Yes | Displayed and used by date filtering and creation-date sorting. |
| `updatedAt` | Date-time string | Yes | Existing last-saved metadata; not substituted for `createdAt`. |

The summary is derived from the complete diagram and must never create a second identity or a
different timestamp. Saving a loaded document replaces or inserts its summary by `id` while
retaining the server-provided `createdAt`.

## Transient Diagram List View

The panel derives its rendered list from `DiagramSummary[]` and the following non-persisted state:

| State | Type | Default | Validation/behavior |
|---|---|---|---|
| `nameQuery` | String | Empty | Trim before matching; empty/whitespace means no name filter. |
| `createdFrom` | Local calendar date or empty | Empty | Inclusive lower bound when present. |
| `createdTo` | Local calendar date or empty | Empty | Inclusive upper bound when present. |
| `sortField` | `name \| createdAt` | `createdAt` | Initial order is creation date descending. |
| `sortDirection` | `ascending \| descending` | `descending` | Applies to the selected sort field. |
| `rangeError` | String or empty | Empty | Set when `createdTo` precedes `createdFrom`; no misleading filtered result is rendered. |

Derivation order is:

1. Trim and case-fold the name query.
2. Reject an invalid date range before deriving results.
3. Keep summaries whose names match and whose original creation calendar date is within every
   supplied bound.
4. Sort the filtered results by the selected field and direction.
5. Resolve ties by normalized name, then stable UUID, using the same deterministic rule on every
   refresh.

Filters and sort choices are view state only. They do not change the complete diagram, its saved
timestamps, or the persisted artifact.

## Deletion State and Transitions

```text
active summary
    │ author selects Delete
    ▼
confirmation pending ── cancel ──► active summary unchanged
    │ confirm
    ▼
deletion in progress ── failure ──► active summary + actionable error
    │ success
    ▼
trashed diagram / summary removed from active panel
    │ existing recovery action
    ▼
active diagram restored with original contents, IDs, and createdAt
```

If the target is the current diagram with unsaved diagram or ADR changes, the transition first
enters the existing save/discard/cancel resolution flow. Cancel or failed save keeps the current
document and active summary unchanged; only an explicit resolution permits the trash request.

## Reference Integrity

- Filtering and sorting operate only on summaries and never rewrite diagram or contained-artifact
  IDs.
- Moving a diagram to trash changes diagram lifecycle metadata only; components, relationships,
  system groups, ADRs, component links, relationship links, and their IDs remain intact.
- Restoring a diagram reactivates the same diagram identity and returns its original `createdAt`.
- Duplicate names and dates are valid; all actions resolve by UUID rather than list index or name.

## Validation Rules

- Active list summaries must include a valid stable UUID, non-empty name, explicit status, original
  `createdAt`, and `updatedAt`.
- `createdAt` must be present in list responses and must equal the persisted diagram creation value.
- A name query is case-insensitive substring matching after trimming.
- A date range accepts either boundary alone; when both are present, the end date must not precede
  the start date and both boundaries are inclusive.
- Deletion requires explicit confirmation and must use the existing recoverable active-to-trashed
  transition.
- A failed delete must not remove the summary from the active list or change unrelated summaries.
