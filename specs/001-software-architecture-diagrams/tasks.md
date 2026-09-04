# Tasks: Replace Autosave with Explicit Saving

**Input**: Design documents from `/specs/001-software-architecture-diagrams/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and
[contracts/openapi.yaml](./contracts/openapi.yaml)

**Scope**: This task list supersedes the previous autosave-oriented work items. It covers explicit
saving plus the required guarantee that successful production saves are committed to the database;
already delivered diagram editing, export, recovery, and ADR-compatibility work is not recreated here.

**Tests**: Automated coverage is required by the feature specification and constitution. Write the
story tests first and confirm they fail before implementing the corresponding behavior.

**Organization**: Tasks are grouped by user story so the explicit-save editor and the changed
export behavior can be validated independently.

## Phase 1: Setup

**Purpose**: Confirm the existing editor, REST `PUT /diagrams/{diagramId}` save operation, and test
commands remain the migration baseline. No project or database setup changes are required.

---

## Phase 2: Foundational

**Purpose**: The existing complete-document `PUT` operation supports explicit saves, but runtime
database configuration and a mandatory fresh-API persistence test must be completed before the
database-backed save/reopen contract is considered satisfied.

---

## Phase 3: User Story 1 - Create and Edit an Architecture Diagram (Priority: P1) 🎯 MVP

**Goal**: Users edit a local draft without background persistence, explicitly choose Save, and can
distinguish unsaved, saving, saved, and failed-save states.

**Independent Test**: Create a diagram, make several edits, verify no `PUT` request is issued until
Save is activated, then save and reopen the diagram to verify the saved document retains all edits.

### Tests for User Story 1

- [X] T001 [P] [US1] Add explicit-save state-transition tests for edit, undo, redo, save success, save failure, retry, and no timer-driven request in `frontend/tests/diagram-store.test.ts`.
- [X] T002 [P] [US1] Add toolbar and save-status accessibility tests for the explicit Save action and unsaved/saving/saved/failed announcements in `frontend/tests/save-controls.test.tsx`.
- [X] T003 [P] [US1] Replace the autosave browser workflow with a create/edit/explicit-save/reopen workflow that asserts no `PUT` occurs before Save in `e2e/tests/create-edit-reopen.spec.ts`.

### Implementation for User Story 1

- [X] T004 [US1] Refactor document state so edits, undo, and redo mark the draft `unsaved`, remove the debounce timer, and ensure a completed save does not overwrite newer local edits in `frontend/src/state/diagram-store.ts`.
- [X] T005 [US1] Add a keyboard-accessible explicit Save button that invokes the store save action, prevents duplicate in-flight saves, and leaves failed saves retryable in `frontend/src/components/DiagramToolbar.tsx`.
- [X] T006 [US1] Replace automatic-save copy with clear unsaved, saving, saved, and failed-save status messages in `frontend/src/components/SaveStatus.tsx` and `frontend/src/components/DiagramWorkspace.tsx`.

**Checkpoint**: Editing does not initiate persistence in the background; only an explicit Save
persists the complete valid document and the user can identify the resulting state.

---

## Phase 4: User Story 2 - Export a Diagram as Mermaid (Priority: P1)

**Goal**: Export never causes an implicit save. When edits are unsaved, users receive a clear,
actionable explanation that export uses the saved diagram and must be preceded by Save.

**Independent Test**: Edit a saved diagram, choose Export before saving, verify no `PUT` request is
made and the user is told to save; save explicitly, then export and verify the Mermaid file downloads.

### Tests for User Story 2

- [X] T007 [P] [US2] Add export-control tests proving unsaved, saving, and failed-save drafts do not trigger a save or download and receive actionable feedback in `frontend/tests/export-button.test.tsx`.
- [X] T008 [P] [US2] Update Mermaid browser coverage for explicit-save-before-export, invalid exports, and the absence of implicit `PUT` requests in `e2e/tests/mermaid-export.spec.ts`.

### Implementation for User Story 2

- [X] T009 [US2] Remove pending-save coordination from the export action; block export of an unsaved, saving, or failed draft with an accessible save-first message in `frontend/src/components/ExportButton.tsx`.

**Checkpoint**: Export remains independently usable for saved diagrams and never silently persists
an edited draft.

---

## Phase 5: User Story 1 - Persist Saved Diagrams in the Database (Priority: P1)

**Goal**: A successful explicit save in the running application is committed to the database, and a
new API instance can retrieve the complete saved document.

**Independent Test**: Start the API with a configured database, create and explicitly save a
diagram with components and relationships, start a fresh API instance against the same database,
and verify that loading by diagram ID returns every saved field.

### Tests for User Story 1

- [ ] T010 [P] [US1] Make the PostgreSQL save-and-reopen contract test a required configured-database test, including a fresh API instance and complete document assertions, in `backend/tests/contract/diagrams.test.ts`.
- [ ] T011 [P] [US1] Add configuration and server-startup tests proving production startup rejects a missing database URL instead of selecting in-memory storage in `backend/tests/config.test.ts`.

### Implementation for User Story 1

- [ ] T012 [US1] Require a database URL for the running API and always construct the PostgreSQL diagram repository in `backend/src/config.ts` and `backend/src/server.ts`.
- [ ] T013 [US1] Update database-backed startup, migration, and save/reopen validation instructions in `specs/001-software-architecture-diagrams/quickstart.md`.

**Checkpoint**: The running API cannot report a save as successful without database persistence,
and a fresh API instance retrieves the complete saved document.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Remove remaining user-facing autosave language and verify the explicit-save migration
at representative scale and across the documented workflow.

- [ ] T014 [P] Replace autosave performance and recovery expectations with explicit-save timing, failed-save retry, and no-background-request assertions in `e2e/tests/performance.spec.ts`.
- [ ] T015 [P] Update the explicit-save description and user instructions in `README.md` and the validation-result notes in `specs/001-software-architecture-diagrams/quickstart.md`.
- [ ] T016 [P] Extend the accessibility contract to require the Save control and live save-state feedback in `frontend/tests/accessibility.test.tsx`.
- [ ] T017 Run the frontend unit tests, configured-database contract tests, browser tests, and every quickstart scenario; record the results in `specs/001-software-architecture-diagrams/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup and Foundational**: The existing project, persistence boundary, and save endpoint are
  retained; no blocking infrastructure work is required.
- **US1 (Phase 3)**: Starts immediately. T001–T003 define the expected behavior before T004–T006.
- **US2 (Phase 4)**: Starts after the explicit-save status semantics in T004 are available. T007–T008
  define export behavior before T009.
- **Database persistence (Phase 5)**: Starts after the existing explicit-save work and blocks the
  database-backed save/reopen completion gate.
- **Polish (Phase 6)**: Starts after the desired story work is complete; T017 is last.

### User Story Dependencies

- **US1**: No dependency on another story; it is the MVP and establishes the authoritative draft
  status consumed by export.
- **US2**: Depends on US1's `unsaved`, `saving`, `saved`, and `failed` state semantics, but does
  not modify diagram persistence or editor state.
- **US1 database persistence**: Depends on the existing explicit Save request and establishes the
  production database configuration and fresh-instance retrieval proof required by FR-006 and SC-003.

### Parallel Opportunities

- T001–T003 can run in parallel because they cover separate test files.
- T007 and T008 can run in parallel after the US1 status contract is agreed.
- T010 and T011 can run in parallel before T012; T013 follows T012.
- T014–T016 can run in parallel after the story checkpoints because they change separate files.

---

## Parallel Example: User Story 1

```text
Task: "Add explicit-save state-transition tests in frontend/tests/diagram-store.test.ts"
Task: "Add Save-control accessibility tests in frontend/tests/save-controls.test.tsx"
Task: "Replace the autosave browser workflow in e2e/tests/create-edit-reopen.spec.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete T001–T006 for User Story 1.
2. Run the User Story 1 independent test: edit without a network save, then explicitly save and
   reopen the document.
3. Stop for review before changing export behavior.

### Incremental Delivery

1. Deliver explicit saving and reliable state feedback (US1).
2. Deliver save-first export messaging without any implicit persistence (US2).
3. Require database-backed production startup and verify save/reopen across a fresh API instance.
4. Complete representative performance, accessibility, documentation, and full-regression checks.

## Notes

- Every task uses the required checkbox, sequential `T###` identifier, optional `[P]` marker,
  user-story label where applicable, and exact file path.
- The REST `PUT /diagrams/{diagramId}` contract remains intact; its invocation moves from a debounce
  callback to the explicit Save control.
- Production runtime storage must use PostgreSQL; the in-memory repository remains available only
  when directly injected for isolated tests.
- Saved-diagram browsing and guarded loading remain separate planned work. When implemented, their
  Save option must call the same explicit Save action and must not restore autosave.
