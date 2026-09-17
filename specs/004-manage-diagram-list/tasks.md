---

description: "Actionable implementation tasks for Manage Diagram List"

---

# Tasks: Manage Diagram List

**Input**: Design documents from `/specs/004-manage-diagram-list/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), and
[quickstart.md](./quickstart.md)

**Tests**: Included because the project constitution requires automated coverage at artifact,
validation, persistence, rendering, and user-workflow boundaries.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as
an independently demonstrable increment after the shared foundation.

## Task line format

- **[P]**: Can run in parallel with other tasks in the same dependency level.
- **Story labels**: Map user-story tasks to a user story from [spec.md](./spec.md).
- Every task includes the exact repository file path(s) it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish focused fixtures and browser mock boundaries for the feature. The existing
project, dependencies, and test runners are reused; no new package or database migration is needed.

- [ ] T001 [P] Add reusable diagram-list fixtures covering active diagrams, duplicate names, equal creation dates, date-range boundaries, and a populated recoverable document in `frontend/tests/diagram-list-fixtures.ts`.
- [ ] T002 [P] Add Playwright API route helpers for active summaries, trash/restore responses, successful deletion, deletion failure, and refresh races in `e2e/tests/diagram-list-management.spec.ts`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Expose the immutable creation date consistently and establish the typed list derivation
boundary used by filtering, sorting, opening, and deletion. All user-story work depends on this
phase.

- [ ] T003 [P] Extend `DiagramSummary` with required `createdAt` and update summary validation in `shared/src/domain/types.ts` and `shared/src/validation/schemas.ts` without changing complete-document identity or timestamp semantics.
- [ ] T004 [P] Include persisted `createdAt` in active and trashed summary responses in `backend/src/api/diagram-routes.ts` and `backend/src/api/recovery-routes.ts`, preserving existing active-only and recoverable-trash behavior.
- [ ] T005 [P] Preserve `createdAt` when summaries are loaded, replaced after save, or normalized in `frontend/src/api/diagram-client.ts` and `frontend/src/state/diagram-store.ts`.
- [ ] T006 Create the typed list-view derivation boundary in `frontend/src/state/diagram-list.ts` for trimmed case-insensitive name matching, inclusive optional date bounds, invalid-range reporting, and deterministic name/creation-date sorting inputs.
- [ ] T007 [P] Add shared/API regression coverage for required summary `createdAt`, original creation-date retention through edit/trash/restore, active and trash list responses, and failed deletion immutability in `shared/tests/validation.test.ts`, `backend/tests/diagrams.test.ts`, and `backend/tests/recovery.test.ts`.
- [ ] T008 [P] Synchronize the affected OpenAPI list, trash, delete, and restore contract with the implementation in `specs/004-manage-diagram-list/contracts/openapi.yaml`, including required `createdAt`, recoverable deletion semantics, and not-found/conflict responses.

**Checkpoint**: The shared summary contract, API responses, persisted timestamp semantics, and pure
list-view boundary are ready; user-story implementation can proceed without adding new storage.

## Phase 3: User Story 1 - Find Diagrams by Name or Creation Date (Priority: P1) 🎯 MVP

**Goal**: Let authors filter the active diagram panel by name, creation-date range, or both, with
clear empty/no-match/error feedback and a way to restore the full list.

**Independent Test**: Seed diagrams with distinct names and dates, apply name-only, date-only, and
combined filters, verify inclusive boundaries and case-insensitive matching, then clear filters and
verify the complete active list returns. Verify invalid ranges and no matches have actionable states.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add unit coverage for trimmed case-insensitive substring matching, optional inclusive start/end dates, combined AND filtering, invalid date ranges, empty queries, empty collections, no-match results, and creation-date display data in `frontend/tests/diagram-list.test.ts`.
- [ ] T010 [P] [US1] Add Playwright coverage for name filtering, date-boundary filtering, combined filters, invalid-range feedback, no-match messaging, clear-filters behavior, and the empty active-list state in `e2e/tests/diagram-list-management.spec.ts`.

### Implementation for User Story 1

- [ ] T011 [US1] Implement the filtered list derivation and panel controls for name, start date, end date, clear filters, and creation-date display in `frontend/src/components/SavedDiagramList.tsx` using `frontend/src/state/diagram-list.ts`.
- [ ] T012 [P] [US1] Add panel layout, input, select, empty-state, no-match, error, and focus styles for the filter workflow in `frontend/src/components/saved-diagram-list.css` according to `DESIGN.md`.
- [ ] T013 [US1] Add accessible labels, keyboard order, visible focus, range validation feedback, live status announcements, and distinct empty-list/no-match states for the filter controls in `frontend/src/components/SavedDiagramList.tsx`.

**Checkpoint**: US1 is independently usable as the MVP: authors can identify a diagram by name or
creation date, combine and clear filters, understand no-result/error states, and still open a result.

## Phase 4: User Story 2 - Sort Diagrams for Review (Priority: P1)

**Goal**: Let authors sort the currently filtered diagrams by name or original creation date in both
directions while preserving duplicate-name identity and open behavior.

**Independent Test**: Seed diagrams with different and equal names/dates, select each field and
direction, verify order and deterministic ties, then open a duplicate-name result and confirm the
selected stable UUID is loaded.

### Tests for User Story 2

- [ ] T014 [P] [US2] Add unit coverage for name and creation-date ascending/descending order, case-insensitive names, deterministic normalized-name/UUID tie-breaks, and sorting after filters in `frontend/tests/diagram-list.test.ts`.
- [ ] T015 [P] [US2] Add Playwright coverage for every sort field/direction, filtered sorting, equal-value ties, duplicate-name entries, and opening the exact selected diagram in `e2e/tests/diagram-list-management.spec.ts`.

### Implementation for User Story 2

- [ ] T016 [US2] Implement name/creation-date sort-field and ascending/descending controls, default newest-created-first ordering, and filtered-result ordering in `frontend/src/state/diagram-list.ts` and `frontend/src/components/SavedDiagramList.tsx`.
- [ ] T017 [US2] Ensure every open action and rendered row remains keyed and dispatched by stable diagram UUID, including duplicate names and equal creation dates, in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/state/diagram-store.ts`.
- [ ] T018 [US2] Add accessible sort control labels, focus behavior, selected-direction feedback, and responsive styles without reducing the delete/open target distinction in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/components/saved-diagram-list.css`.

**Checkpoint**: US1 and US2 both work independently: authors can filter, sort, and open any active
diagram without changing the underlying architecture documents or confusing duplicate names.

## Phase 5: User Story 3 - Delete a Diagram Safely (Priority: P1)

**Goal**: Let authors confirm deletion from the panel, move the chosen diagram to recoverable trash,
protect unsaved current work, and receive clear success/failure feedback without affecting unrelated
diagrams.

**Independent Test**: Seed a populated active diagram, cancel one confirmation, confirm one deletion,
verify only the target leaves the active list and remains restorable with all contents and the original
creation date, then verify failed deletion and current unsaved-change flows preserve the draft.

### Tests for User Story 3

- [ ] T019 [P] [US3] Add API/store coverage for confirmed trash transitions, summary removal only after success, deletion failure retention, target-not-found handling, duplicate-name targeting by UUID, and restore preservation in `backend/tests/recovery.test.ts` and `frontend/tests/saved-diagram-store.test.ts`.
- [ ] T020 [P] [US3] Add Playwright coverage for named confirmation, cancel, success, failure, last-item empty state, trash/restore preservation, refresh races, and deletion of a current diagram with unsaved diagram or ADR changes in `e2e/tests/diagram-list-management.spec.ts`.

### Implementation for User Story 3

- [ ] T021 [US3] Add a typed saved-document trash action that calls the existing delete endpoint, removes only the successful target summary, exposes in-progress/success/error state, and retains the original document on failure in `frontend/src/api/diagram-client.ts` and `frontend/src/state/diagram-store.ts`.
- [ ] T022 [US3] Add a separate labeled Delete action per diagram row and a diagram-specific confirmation dialog explaining recoverable trash behavior in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/components/ConfirmDialog.tsx`.
- [ ] T023 [US3] Wire deletion callbacks through `frontend/src/components/DiagramWorkspace.tsx` so the current diagram’s unsaved diagram/ADR changes require explicit save, discard, or cancel resolution before trashing, and a successful current deletion leaves no trashed document presented as active.
- [ ] T024 [US3] Render deletion progress, success, failure, unavailable-target, and post-deletion empty states with actionable live feedback while preventing duplicate submissions or unrelated-row removal in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/components/saved-diagram-list.css`.
- [ ] T025 [US3] Update recovery summary handling and restore assertions so trashed diagrams expose `createdAt` and restore the complete original artifact document in `backend/src/api/recovery-routes.ts`, `frontend/src/api/diagram-client.ts`, and `frontend/src/components/RecoveryControls.tsx`.

**Checkpoint**: All three user stories are demonstrable: filtering and sorting remain view-only, delete
is explicitly confirmed and recoverable, unsaved work is protected, and artifact identities/references
survive trash and restore.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete boundary validation, accessibility regression coverage, documentation alignment,
and the runnable release checks across all stories.

- [ ] T026 [P] Add keyboard-only and accessibility regression coverage for filter inputs, date controls, sort controls, row open/delete actions, confirmation dialogs, focus return, status announcements, contrast, and 44px targets in `frontend/tests/accessibility.test.tsx` and `frontend/src/components/saved-diagram-list.css`.
- [ ] T027 [P] Reconcile the implementation-facing API contract, data model, research decisions, and quickstart expectations after code changes in `specs/004-manage-diagram-list/contracts/openapi.yaml`, `specs/004-manage-diagram-list/data-model.md`, and `specs/004-manage-diagram-list/quickstart.md`.
- [ ] T028 Run the focused tests, `npm run build`, and the complete feature workflow from `specs/004-manage-diagram-list/quickstart.md`, then resolve regressions in `shared/`, `backend/`, `frontend/`, or `e2e/tests/diagram-list-management.spec.ts` before recording final validation in `specs/004-manage-diagram-list/quickstart.md`.

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 and T002 have no implementation dependencies and can run in parallel.
- **Phase 2 (Foundational)**: T003-T008 depend on the existing project structure and T001 fixtures
  where tests use them. This phase must complete before user-story implementation.
- **Phase 3 (US1)**: T009-T013 depend on the shared summary/list foundation. T009 and T010 are test
  work that can run in parallel; T011 follows the selector contract, then T012 and T013 can proceed
  by separate file ownership where practical.
- **Phase 4 (US2)**: T014-T018 depend on the US1 list rendering and selector boundary. T014 and T015
  can run in parallel before T016-T018.
- **Phase 5 (US3)**: T019-T025 depend on the foundation and the US1 panel baseline. T019 and T020
  can run in parallel; T021 must precede the UI deletion integration in T022-T024, and T025 validates
  the recovery side of the same lifecycle.
- **Phase 6 (Polish)**: T026 and T027 can run in parallel after the affected behavior exists; T028
  is the final integrated validation task.

### User Story Completion Order

1. **US1 (P1)**: Recommended MVP; establishes the filtered list and creation-date display.
2. **US2 (P1)**: Extends the same derived list with sorting and duplicate-safe opening.
3. **US3 (P1)**: Adds deletion and recovery protection on top of the usable list; it can begin after
   US1 and proceed in parallel with US2 if separate ownership is maintained.

### Dependency Graph

```text
T001 ─┐
      ├──> T003-T008 ───> US1: T009-T013 ───> US2: T014-T018
T002 ─┘                         └────────────> US3: T019-T025

US2 and US3 may proceed in parallel after US1.
T026-T027 follow the completed story behavior; T028 is the final validation gate.
```

## Parallel Execution Examples

### Setup and foundation

```text
Task T001: Create frontend list fixtures in frontend/tests/diagram-list-fixtures.ts
Task T002: Create browser API mocks in e2e/tests/diagram-list-management.spec.ts

After setup:
Task T003: Update shared summary types and schemas
Task T004: Update active/trash summary mappers
Task T005: Update frontend summary loading/preservation
Task T008: Synchronize OpenAPI contract
```

### User Story 1

```text
Task T009: Add filter unit tests in frontend/tests/diagram-list.test.ts
Task T010: Add filter browser tests in e2e/tests/diagram-list-management.spec.ts
```

Then implement T011, followed by T012 and T013 where their file ownership permits.

### User Stories 2 and 3

```text
User Story 2:
Task T014: Add sort unit tests in frontend/tests/diagram-list.test.ts
Task T015: Add sort browser tests in e2e/tests/diagram-list-management.spec.ts

User Story 3:
Task T019: Add API/store deletion tests in backend/tests/recovery.test.ts and frontend/tests/saved-diagram-store.test.ts
Task T020: Add deletion/recovery browser tests in e2e/tests/diagram-list-management.spec.ts
```

After US1, the US2 and US3 implementation slices can proceed in parallel when one worker owns the
list sorting files and another owns the deletion/store/workspace files.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete setup and the shared summary/API foundation.
2. Complete name/date filtering, creation-date display, clear/reset, empty/no-match/error states,
   and focused tests.
3. Run the US1 independent test and `npm run build`.
4. Demo finding an existing diagram before adding sorting or deletion.

### Incremental Delivery

1. Foundation + US1: expose reliable creation dates and find diagrams quickly.
2. Add US2: organize filtered results by name/date and open duplicate names safely.
3. Add US3: add confirmed recoverable deletion, unsaved-change protection, and restore coverage.
4. Finish accessibility, contract/document alignment, and the full quickstart validation.

### Task Format Validation

All implementation and test tasks use the required checklist format: unchecked checkbox, sequential
`T###` ID, `[P]` only for parallelizable tasks, `[US#]` on user-story tasks, and one or more exact
repository file paths in every task description.
