---
description: "Actionable implementation tasks for Software Architecture Diagrams"
---

# Tasks: Software Architecture Diagrams

**Input**: Design documents from `/specs/001-software-architecture-diagrams/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included because the specification defines independent acceptance tests and the constitution
requires automated coverage at domain, persistence, API, rendering, and export boundaries.

**Organization**: Tasks are grouped by user story. Every story has an independent test criterion.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TypeScript web application and repository tooling.

- [X] T001 Create the workspace package structure for `shared`, `backend`, `frontend`, and `e2e` in `package.json` and the listed project directories
- [X] T002 Configure TypeScript project references and strict compiler settings in `tsconfig.json`, `shared/tsconfig.json`, `backend/tsconfig.json`, and `frontend/tsconfig.json`
- [X] T003 [P] Configure Vite and React entry points in `frontend/vite.config.ts`, `frontend/index.html`, and `frontend/src/main.tsx`
- [X] T004 [P] Configure Vitest projects and shared test commands in `vitest.config.ts` and package scripts in `package.json`
- [X] T005 [P] Configure Playwright browser testing in `playwright.config.ts` and create `e2e/tests/.gitkeep`
- [X] T006 [P] Create repository ignore rules for Node, TypeScript, Vite, test output, environment files, and local database artifacts in `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared artifact boundary, persistence infrastructure, API shell, and test fixtures.

**Checkpoint**: Foundation is ready when a validated empty diagram can cross the shared types and API
boundaries and the database migration can be applied.

- [X] T007 [P] Define UUID, timestamp, diagram status, component, relationship, and diagram document types in `shared/src/domain/types.ts`
- [X] T008 [P] Implement domain invariants for stable IDs, same-diagram relationship endpoints, finite positions, and non-blank names in `shared/src/domain/invariants.ts`
- [X] T009 [P] Implement Zod schemas and entity-specific validation errors for diagram documents and API payloads in `shared/src/validation/schemas.ts`
- [X] T010 [P] Add shared domain and validation tests for UUID stability, duplicate names, invalid endpoints, self-links, invalid positions, and actionable errors in `shared/tests/domain.test.ts` and `shared/tests/validation.test.ts`
- [X] T011 Configure shared package exports and build/test scripts in `shared/package.json` and `shared/src/index.ts`
- [X] T012 Create Drizzle database configuration and environment parsing in `backend/src/persistence/database.ts` and `backend/src/config.ts`
- [X] T013 Define PostgreSQL tables, foreign keys, timestamps, soft-delete fields, and indexes in `backend/src/persistence/schema.ts`
- [X] T014 Create and verify the initial database migration for diagrams, components, and relationships in `backend/drizzle/0001_initial.sql`
- [X] T015 [P] Create Fastify application construction, health route, request parsing, and centralized validation/error responses in `backend/src/api/app.ts` and `backend/src/api/errors.ts`
- [X] T016 [P] Create API test fixtures and an isolated test database strategy in `backend/tests/fixtures.ts` and `backend/tests/setup.ts`
- [X] T017 [P] Add an OpenAPI contract validation test against `specs/001-software-architecture-diagrams/contracts/openapi.yaml` in `backend/tests/contract/openapi.test.ts`
- [X] T018 Add backend package scripts, migration commands, and local development configuration in `backend/package.json` and `backend/.env.example`

---

## Phase 3: User Story 1 - Create and Edit an Architecture Diagram (Priority: P1) 🎯 MVP

**Goal**: Create, edit, persist, and reopen a diagram with stable components and relationships.

**Independent Test**: Create a diagram with at least three components and two relationships, wait for
the saved status, reopen it, and verify names, labels, endpoints, directions, positions, and IDs.

### Tests for User Story 1

- [X] T019 [P] [US1] Add repository/service tests for diagram create, complete-document autosave, reopen, and stable UUID preservation in `backend/tests/diagrams.test.ts`
- [X] T020 [P] [US1] Add API contract tests for `GET /diagrams`, `POST /diagrams`, `GET /diagrams/{diagramId}`, and `PUT /diagrams/{diagramId}` in `backend/tests/contract/diagrams.test.ts`
- [X] T021 [P] [US1] Add React Flow adapter round-trip tests proving domain IDs and positions survive conversion in `frontend/tests/react-flow-adapter.test.ts`
- [X] T022 [P] [US1] Add Playwright coverage for create, add, rename, reposition, autosave, reopen, and relationship editing in `e2e/tests/create-edit-reopen.spec.ts`

### Implementation for User Story 1

- [X] T023 [US1] Implement diagram/component/relationship repository queries and transactional complete-document replacement in `backend/src/persistence/diagram-repository.ts`
- [X] T024 [US1] Implement diagram create, load, validate, and autosave service operations in `backend/src/services/diagram-service.ts`
- [X] T025 [US1] Implement diagram list/create/load/autosave REST handlers matching `specs/001-software-architecture-diagrams/contracts/openapi.yaml` in `backend/src/api/diagram-routes.ts`
- [X] T026 [US1] Implement domain-to-React-Flow node and edge conversion with UUID-derived IDs in `frontend/src/adapters/react-flow/diagram-adapter.ts`
- [X] T027 [US1] Implement Zustand active-document state, domain edit actions, and debounced autosave status in `frontend/src/state/diagram-store.ts`
- [X] T028 [US1] Implement diagram list/open/create UI and accessible component/relationship editing controls in `frontend/src/components/DiagramWorkspace.tsx` and `frontend/src/components/DiagramToolbar.tsx`
- [X] T029 [US1] Implement the React Flow canvas, component labels, relationship labels, directed/undirected display, and keyboard-accessible controls in `frontend/src/components/DiagramCanvas.tsx`
- [X] T030 [US1] Implement REST client result/error mapping and save/reopen feedback in `frontend/src/api/diagram-client.ts` and `frontend/src/components/SaveStatus.tsx`
- [X] T031 [US1] Wire Fastify startup and frontend development proxy for the diagram workflow in `backend/src/server.ts` and `frontend/vite.config.ts`

**Checkpoint**: User Story 1 is independently functional and testable before export, trash, and undo/redo enhancements.

---

## Phase 4: User Story 2 - Export a Diagram as Mermaid (Priority: P1)

**Goal**: Export every supported valid component and relationship as a downloadable, renderable Mermaid file.

**Independent Test**: Export a diagram containing directed and undirected labeled relationships, inspect
the file, render it in a Mermaid-compatible viewer, and verify invalid content produces no download.

### Tests for User Story 2

- [X] T032 [P] [US2] Add Mermaid adapter tests for node/edge coverage, direction, labels, duplicate names, punctuation, non-Latin text, escaping, and rejected unsafe content in `frontend/tests/mermaid-export.test.ts`
- [X] T033 [P] [US2] Add export service/API tests for valid source, empty/invalid documents, entity-specific errors, and `text/vnd.mermaid` responses in `backend/tests/export.test.ts`
- [X] T034 [P] [US2] Add Playwright coverage for export success, pending-autosave export, and actionable export failure feedback in `e2e/tests/mermaid-export.spec.ts`

### Implementation for User Story 2

- [X] T035 [US2] Implement validated domain-to-Mermaid flowchart generation, escaping, direction mapping, and entity-specific export errors in `shared/src/export/mermaid-export.ts`
- [X] T036 [US2] Implement Mermaid export orchestration and response headers in `backend/src/services/export-service.ts` and `backend/src/api/export-routes.ts`
- [X] T037 [US2] Implement Mermaid export client download handling, pending-save coordination, and success/error announcements in `frontend/src/api/export-client.ts` and `frontend/src/components/ExportButton.tsx`
- [X] T038 [US2] Add Mermaid export route and response definitions to `specs/001-software-architecture-diagrams/contracts/openapi.yaml`

**Checkpoint**: User Stories 1 and 2 both work independently; valid diagrams export without silently omitting artifacts.

---

## Phase 5: User Story 3 - Recover from Editing Errors (Priority: P2)

**Goal**: Undo/redo edits and safely recover diagrams from destructive actions.

**Independent Test**: Edit a saved diagram, undo and redo the edit, attempt to remove a connected
component, cancel once, then confirm and verify all dependent relationships are removed together.

### Tests for User Story 3

- [X] T039 [P] [US3] Add Zustand history tests for edit, undo, redo, history reset on diagram switch, and preservation of unrelated content in `frontend/tests/diagram-history.test.ts`
- [X] T040 [P] [US3] Add persistence/service tests for component dependency discovery, transactional component-plus-relationship deletion, diagram trash, and restore in `backend/tests/recovery.test.ts`
- [X] T041 [P] [US3] Add Playwright coverage for undo/redo, connected-component confirmation, diagram trash, and restore feedback in `e2e/tests/recovery.spec.ts`

### Implementation for User Story 3

- [X] T042 [US3] Implement bounded domain-command undo/redo history and active-diagram history scoping in `frontend/src/state/history.ts` and `frontend/src/state/diagram-store.ts`
- [X] T043 [US3] Implement component dependency counting and transactional removal of a component with all dependent relationships in `backend/src/services/diagram-service.ts`
- [X] T044 [US3] Implement diagram soft-delete, trash listing, and restore repository/service operations in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`
- [X] T045 [US3] Add component removal, diagram trash, trash listing, and restore routes matching the API contract in `backend/src/api/recovery-routes.ts`
- [X] T046 [US3] Add confirmation dialogs, dependency warnings, undo/redo controls, trash view, restore action, and accessible status announcements in `frontend/src/components/RecoveryControls.tsx` and `frontend/src/components/ConfirmDialog.tsx`
- [X] T047 [US3] Add recovery endpoints and dependency error schemas to `specs/001-software-architecture-diagrams/contracts/openapi.yaml`

**Checkpoint**: All three user stories are independently functional and preserve stable references without broken relationships.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify quality gates, accessibility, performance feedback, and documented acceptance behavior.

- [ ] T048 [P] Add keyboard navigation, accessible labels, focus management, live-region feedback, and contrast checks for core workflows in `frontend/src/components/` and `frontend/tests/accessibility.test.tsx`
- [ ] T049 [P] Add large-diagram loading, autosave, and export timing coverage for the representative five-component/five-relationship scenario in `e2e/tests/performance.spec.ts`
- [ ] T050 [P] Add API/domain compatibility fixtures proving future ADR component links can resolve unchanged component UUIDs in `shared/tests/compatibility.test.ts` and `backend/tests/compatibility.test.ts`
- [ ] T051 Update README setup, database, test, and Mermaid preview instructions using `specs/001-software-architecture-diagrams/quickstart.md` in `README.md`
- [ ] T052 Run the complete unit, contract, integration, and browser suites and resolve failures in `package.json`, `shared/`, `backend/`, `frontend/`, and `e2e/`
- [ ] T053 Run every acceptance scenario from `specs/001-software-architecture-diagrams/quickstart.md` and record validation results in `specs/001-software-architecture-diagrams/quickstart.md`

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no prerequisites.
- Foundational (Phase 2) depends on Setup and blocks all story phases.
- US1 and US2 are both P1; US2 depends on the validated domain document from Foundational and can
  use US1's API/editor integration for its end-to-end path.
- US3 depends on US1's editor/store and persistence services, then adds recovery behavior.
- Polish depends on the desired user stories being complete.

### User Story Dependencies

- US1: starts after Phase 2; no other story dependency; MVP.
- US2: starts after Phase 2; its UI smoke test assumes the active diagram workflow from US1.
- US3: starts after Phase 2, with implementation integration depending on US1's store and service files.

### Parallel Opportunities

- T003–T006 can run in parallel after T001/T002 establish the package structure.
- T007–T010, T012, T015–T017 can run in parallel where their files do not overlap.
- T019–T022, T032–T034, and T039–T041 are parallel test-writing groups and must fail before implementation.
- Adapter, repository, service, contract, and UI tasks marked `[P]` can run in parallel when their listed
  dependencies are complete; tasks modifying the same store/repository/service file remain sequential.
- US1 and the initial US2 export adapter can be assigned in parallel after Foundational; US3 follows the
  US1 integration checkpoint.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 tests and implementation.
3. Run the US1 independent test and stop for MVP validation.

### Incremental Delivery

1. Add US2 Mermaid export and validate renderable output.
2. Add US3 undo/redo, confirmation, trash, and restore.
3. Complete Polish and cross-cutting acceptance checks.

### Traceability

- US1 covers FR-001 through FR-006 and SC-001, SC-003, SC-004, and SC-006.
- US2 covers FR-009 through FR-011 and SC-002, SC-005, and SC-006.
- US3 covers FR-007, FR-008 and the recovery portions of SC-003 and SC-006.
- Polish covers FR-012, FR-013, edge cases, accessibility, and constitution quality gates.

## Notes

- Every task uses the required `- [ ] T###` checklist format.
- `[P]` marks only tasks that can usefully proceed in parallel without sharing incomplete files.
- Story labels appear on user-story tasks only.
- The MVP scope is Setup + Foundational + US1.
