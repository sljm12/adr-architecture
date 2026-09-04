# Tasks: Software Architecture Diagrams — Saved Document Browsing

**Input**: Design documents from `/specs/001-software-architecture-diagrams/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and
[contracts/openapi.yaml](./contracts/openapi.yaml)

**Scope**: This list supersedes the earlier explicit-save migration task list. It records the
remaining work needed to complete database-backed persistence and deliver the saved-document browse
and guarded-load requirements. Completed create/edit, Mermaid export, and recovery work is not
recreated.

**Tests**: Automated coverage is required by the feature specification and constitution. Write
story tests first and confirm they fail before implementing the corresponding behavior.

**Organization**: Tasks are grouped by the outstanding user stories so each increment remains
independently testable. The existing REST list and load routes are retained; no new persistence
format or endpoint is required.

## Phase 1: Setup

**Purpose**: Confirm the active plan, saved-document contract, and current editor baseline before
adding the remaining workflow. No project initialization changes are required.

---

## Phase 2: Foundational — Production Persistence

**Purpose**: Ensure the running API cannot report a saved document unless it is durable, which is
a prerequisite for browsing and loading saved work.

- [ ] T001 [P] Add a configured-PostgreSQL save-and-reopen contract test that starts a fresh API instance and asserts every saved document field in `backend/tests/contract/diagrams.test.ts`.
- [ ] T002 [P] Add configuration and server-startup tests that reject a missing database URL rather than using in-memory storage in `backend/tests/config.test.ts`.
- [ ] T003 Require the database URL and always construct the PostgreSQL diagram repository for the running API in `backend/src/config.ts` and `backend/src/server.ts`.
- [ ] T004 Update configured-database startup, migration, and save/reopen validation instructions in `specs/001-software-architecture-diagrams/quickstart.md`.

**Checkpoint**: A successful production save is durable and can be loaded by stable diagram ID
from a fresh API instance.

---

## Phase 3: User Story 3 — View and Load Saved Diagrams (Priority: P1) 🎯 MVP

**Goal**: Users browse every non-deleted saved document, distinguish duplicate names by their
last-saved information, and safely load a selected document into the editor.

**Independent Test**: Save two documents with distinct contents, display the saved-document view,
load each document, and verify its editable components, relationships, labels, layout, and stable
IDs. Repeat with an empty list, a failed load, and unsaved local edits.

### Tests for User Story 3

- [ ] T005 [P] [US3] Add API contract coverage for listing active saved-document summaries, excluding trashed documents, returning an empty array, and loading a selected document by UUID in `backend/tests/contract/diagrams.test.ts`.
- [ ] T006 [P] [US3] Add client and store tests for typed saved-document summaries, successful replacement, failed-load preservation, and history reset only after a successful load in `frontend/tests/saved-diagram-store.test.ts`.
- [ ] T007 [P] [US3] Add component tests for saved-document names and last-saved times, duplicate-name distinction, empty/loading/error feedback, and the save/discard/cancel switch choices in `frontend/tests/saved-diagram-list.test.tsx`.
- [ ] T008 [P] [US3] Add browser workflows for empty saved-document state, selecting and loading each of two saved documents, failed loading, and guarded switching with unsaved edits in `e2e/tests/saved-diagrams.spec.ts`.

### Implementation for User Story 3

- [ ] T009 [US3] Add a shared `DiagramSummary` contract type and make saved-document list and selected-document fetch results typed in `shared/src/domain/types.ts`, `shared/src/validation/schemas.ts`, and `frontend/src/api/diagram-client.ts`.
- [ ] T010 [US3] Add saved-document list, selected-document load, load-error, and successful-history-replacement actions to the diagram state store in `frontend/src/state/diagram-store.ts`.
- [ ] T011 [US3] Create a keyboard-accessible saved-document list that displays name and last-saved time, handles empty/loading/error states, and invokes selection by stable ID in `frontend/src/components/SavedDiagramList.tsx`.
- [ ] T012 [US3] Create an accessible save/discard/cancel dialog for switching away from an unsaved active document in `frontend/src/components/DiagramSwitchDialog.tsx`.
- [ ] T013 [US3] Integrate saved-document browsing, guarded selection, success/failure announcements, and the first-document creation action into `frontend/src/components/DiagramWorkspace.tsx`.
- [ ] T014 [US3] Add responsive, readable, and keyboard-focus-visible saved-document list and switch-dialog styles in `frontend/src/styles.css`.

**Checkpoint**: The user can find and load persisted documents without losing an unsaved draft;
empty and failure paths provide clear, accessible feedback.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Complete end-to-end quality gates for persistence and saved-document workflows.

- [ ] T015 [P] Extend the core accessibility contract for saved-document navigation, status announcements, and the guarded-switch dialog in `frontend/tests/accessibility.test.tsx`.
- [ ] T016 [P] Add saved-document listing and load-contract assertions to the OpenAPI boundary test in `backend/tests/contract/openapi.test.ts`.
- [ ] T017 Run frontend unit tests, configured-database contract tests, browser tests, and every quickstart scenario; record outcomes in `specs/001-software-architecture-diagrams/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation work; establish the documented baseline.
- **Foundational (Phase 2)**: T001 and T002 may run in parallel; T003 follows their expected
  configuration contract, and T004 follows the startup change. This phase blocks production
  saved-document completion.
- **US3 (Phase 3)**: T005–T008 define the saved-document contract and workflow before T009–T014.
  T009 enables T010; T010 enables the list and switch integration in T011–T013; T014 can follow
  the component structure.
- **Polish (Phase 4)**: T015 and T016 can run after the US3 implementation. T017 is last.

### User Story Dependencies

- **US3 (P1)**: Depends on the existing explicit-save state semantics and the Phase 2 durability
  gate. It uses the existing `GET /diagrams` and `GET /diagrams/{diagramId}` contract, so no
  additional API route is needed.

### Parallel Opportunities

- T001 and T002 cover separate test files and can run in parallel.
- T005–T008 cover separate test layers and can run in parallel before implementation.
- T015 and T016 cover separate contract layers and can run in parallel after US3 is functional.

---

## Parallel Example: User Story 3

```text
Task: "Add API list/load contract coverage in backend/tests/contract/diagrams.test.ts"
Task: "Add saved-document store tests in frontend/tests/saved-diagram-store.test.ts"
Task: "Add saved-document component tests in frontend/tests/saved-diagram-list.test.tsx"
Task: "Add saved-document browser workflows in e2e/tests/saved-diagrams.spec.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete the Phase 2 production-persistence gate.
2. Complete T005–T014 for User Story 3.
3. Run the User Story 3 independent test, including the empty, failed-load, and unsaved-switch
   paths.
4. Stop for review before cross-cutting validation.

### Incremental Delivery

1. Make production saves durable and prove fresh-instance loading.
2. Add the typed client and store replacement behavior.
3. Add the saved-document list, empty state, and guarded switch UI.
4. Validate accessibility, contracts, and full browser workflows.

## Notes

- Every task uses the required checkbox, sequential `T###` identifier, optional `[P]` marker,
  user-story label where applicable, and exact file path.
- Document selection always uses the stable UUID; duplicate names are display text only.
- Failed or cancelled loads must leave the active document and its local history unchanged.
- The browse view excludes trashed documents; searching, sorting, sharing, and revision-history
  browsing remain out of scope.
