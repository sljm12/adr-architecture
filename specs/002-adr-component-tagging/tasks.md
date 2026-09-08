# Tasks: Architecture Decision Records

**Input**: Design documents from `/specs/002-adr-component-tagging/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an
independent increment. Tests are included because the feature specification requires user-visible
testing and the project constitution requires artifact-boundary coverage.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures, documentation, and test seams for the existing shared/backend/
frontend/e2e structure.

- [X] T001 [P] Add representative ADR and component fixtures with stable UUIDs in `shared/tests/adr-fixtures.ts`, including complete, incomplete, superseded, linked, unlinked, and cross-diagram cases
- [X] T002 [P] Document applying `backend/drizzle/0002_adrs.sql` and configuring `DATABASE_URL` in `README.md` and `backend/.env.example`
- [X] T003 [P] Add ADR-specific API and browser test constants/helpers in `backend/tests/fixtures.ts` and `e2e/tests/adr-fixtures.ts`

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared artifact contract and persistence primitives required by every
user story.

**CRITICAL**: Complete this phase before starting user-story implementation.

- [X] T004 Add `AdrStatus`, `ArchitectureDecisionRecord`, `ComponentReference`, ADR summary, and API payload types in `shared/src/domain/types.ts` without coupling them to React Flow
- [X] T005 Add ADR create/update/detail/summary/link Zod schemas and field-level validation helpers in `shared/src/validation/schemas.ts`, including required text, UUID, unique-link, and status/replacement validation
- [X] T006 Add shared ADR invariants in `shared/src/domain/invariants.ts` for stable IDs, required fields, superseded replacement rules, same-diagram ownership, and valid zero-to-many links
- [X] T007 Export the new ADR types, schemas, and invariants from `shared/src/index.ts`
- [X] T008 [P] Add failing-then-passing unit coverage for ADR schema and invariant behavior in `shared/tests/adr-domain.test.ts` and `shared/tests/adr-validation.test.ts`
- [X] T009 Create additive PostgreSQL migration `backend/drizzle/0002_adrs.sql` for the ADR status enum, `adrs` table, `adr_component_links` table, indexes, and non-cascading foreign keys
- [X] T010 Extend `backend/src/persistence/schema.ts` with Drizzle definitions for `adrs`, `adr_component_links`, and the ADR status enum, preserving existing diagram/component schema
- [X] T011 Define typed ADR repository interfaces and shared dependency-conflict result shapes in `backend/src/persistence/adr-repository.ts` for in-memory tests and PostgreSQL implementation
- [X] T012 Extend `backend/src/api/errors.ts` with consistent 404, 409 dependency-blocker, and 422 validation response mapping that preserves actionable fields and blocking ADR IDs/titles
- [X] T013 Add migration/schema compatibility assertions for the new tables without changing existing diagram artifact identities in `backend/tests/compatibility.test.ts`

## Phase 3: User Story 1 - Record an Architecture Decision (Priority: P1) 🎯 MVP

**Goal**: Create, edit, validate, save, reopen, and recover an ADR containing all required decision
information, with stable identity, timestamps, and clear save feedback.

**Independent Test**: Create an ADR with required fields, save it, reopen it through a fresh API
request, and verify content/status/timestamps/UUID. Repeat with each required field missing and with
the backend unavailable to verify actionable validation and draft preservation.

### Tests for User Story 1

- [X] T014 [P] [US1] Add shared persistence-shape tests for complete, incomplete, long, punctuated, and non-Latin ADR content in `shared/tests/adr-domain.test.ts`
- [X] T015 [P] [US1] Add ADR CRUD contract tests for list/create/get/patch validation and response shapes in `backend/tests/contract/adrs.test.ts` using `specs/002-adr-component-tagging/contracts/openapi.yaml`
- [X] T016 [P] [US1] Add in-memory and PostgreSQL repository tests for stable ADR UUIDs, server timestamps, save/reopen, duplicate titles, and long text in `backend/tests/persistence/adr-repository.test.ts`
- [X] T017 [P] [US1] Add Zustand draft/history/save/retry tests for required-field validation, unsaved state, failed save retention, retry, and stale response protection in `frontend/tests/adr-store.test.ts`
- [X] T018 [P] [US1] Add component tests for required labels, field errors, status feedback, keyboard submission, and saved/reopened content in `frontend/tests/adr-editor.test.tsx`
- [X] T019 [US1] Add the create, validate, save, reopen, and backend-failure-retry journey in `e2e/tests/adr-component-tagging.spec.ts`

### Implementation for User Story 1

- [X] T020 [US1] Implement ADR create/get/list/update/delete-independent read/write persistence mapping in `backend/src/persistence/adr-repository.ts`, preserving server-managed timestamps and stable IDs
- [X] T021 [US1] Implement required-field validation, ADR creation/update, same-diagram ownership lookup, and server timestamp behavior in `backend/src/services/adr-service.ts`
- [X] T022 [US1] Implement list/create/get/patch ADR routes with 404/422 handling in `backend/src/api/adr-routes.ts` according to the OpenAPI contract
- [X] T023 [US1] Register ADR routes and service dependencies in `backend/src/api/app.ts` without changing existing diagram or Mermaid endpoints
- [X] T024 [US1] Implement ADR REST calls and structured `DiagramApiError`-compatible error parsing in `frontend/src/api/adr-client.ts`
- [X] T025 [US1] Implement ADR selection, create/edit draft state, explicit undo/redo history, save status, failed-save retention, retry, and stale-response protection in `frontend/src/state/adr-store.ts`
- [X] T026 [US1] Build the required-field ADR form with optional alternatives/constraints and accessible inline validation in `frontend/src/components/AdrEditor.tsx`
- [X] T027 [US1] Build the ADR list showing title, status, updated time, stable selection identity, and an empty state in `frontend/src/components/AdrList.tsx`
- [X] T028 [US1] Integrate Decisions navigation, list, editor, save status, and unsaved-change protection into `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/DiagramToolbar.tsx`, and `frontend/src/components/WorkspaceInspector.tsx`
- [X] T029 [US1] Add ADR-specific visual states and responsive layout using existing DESIGN.md typography, Action Blue controls, focus outlines, contrast, and 44px targets in `frontend/src/styles.css`

**Checkpoint**: US1 is independently usable when a user can create, validate, save, reopen, edit,
and retry an ADR without losing local content.

## Phase 4: User Story 2 - Optionally Link ADRs to Diagram Components (Priority: P1)

**Goal**: Associate an ADR with zero, one, or multiple components in the active diagram, display
those references, navigate to available components, and preserve links through rename/reposition.

**Independent Test**: Starting with a saved ADR and a diagram containing components, link one and
then multiple components, remove one, save/reopen, verify an unlinked ADR remains valid, and verify
missing/cross-diagram links are rejected without mutation.

### Tests for User Story 2

- [X] T030 [P] [US2] Add link-schema and stable-component-ID tests for zero-to-many links, duplicate IDs, missing components, renames, and repositioning in `shared/tests/adr-validation.test.ts`
- [X] T031 [P] [US2] Add link replacement, ownership, missing-component, cross-diagram, and atomic unlink tests in `backend/tests/persistence/adr-repository.test.ts`
- [X] T032 [P] [US2] Add ADR component-link route contract tests for replace-links and error responses in `backend/tests/contract/adrs.test.ts`
- [X] T033 [P] [US2] Add component deletion conflict tests proving linked components return blocking ADR IDs/titles and are not deleted in `backend/tests/contract/component-dependencies.test.ts`
- [X] T034 [P] [US2] Add link selection, unlinking, unlinked-state, component navigation, and rename/reposition persistence tests in `frontend/tests/adr-linking.test.tsx`
- [X] T035 [US2] Add the zero/one/multiple-link, unlink, rename/reposition, and invalid-link journeys in `e2e/tests/adr-component-tagging.spec.ts`

### Implementation for User Story 2

- [X] T036 [US2] Implement ADR component-link load/replace operations and atomic link persistence in `backend/src/persistence/adr-repository.ts`
- [X] T037 [US2] Implement component ownership validation, missing/cross-diagram diagnostics, link replacement, and linked-component dependency queries in `backend/src/services/adr-service.ts`
- [X] T038 [US2] Add the replace-links endpoint `/adrs/{adrId}/components` in `backend/src/api/adr-routes.ts`, returning valid empty links and actionable 422 errors
- [X] T039 [US2] Update component deletion service/repository flow in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts` to block deletion when ADR links exist and return blocking ADR details
- [X] T040 [US2] Extend the component deletion route error mapping in `backend/src/api/diagram-routes.ts` and `backend/src/api/errors.ts` for ADR dependency conflicts
- [X] T041 [US2] Implement ADR link/unlink client calls and component-link error parsing in `frontend/src/api/adr-client.ts`
- [X] T042 [US2] Add component-link draft actions, zero-link representation, and stable-ID updates to `frontend/src/state/adr-store.ts`
- [X] T043 [US2] Build accessible multi-select/search link picker with selected component names and unlink controls in `frontend/src/components/AdrLinkPicker.tsx`
- [X] T044 [US2] Add linked-component display and navigation callbacks that select the matching diagram component by UUID in `frontend/src/components/AdrEditor.tsx`, `frontend/src/components/DiagramWorkspace.tsx`, and `frontend/src/components/DiagramCanvas.tsx`
- [X] T045 [US2] Add link-picker, chip, empty/unlinked, validation-error, and deletion-conflict styles in `frontend/src/styles.css`

**Checkpoint**: US2 is independently usable when an ADR can be saved unlinked or with valid
component UUID links, and linked component deletion is safely blocked with repair guidance.

## Phase 5: User Story 3 - Find and Manage Decision Status (Priority: P2)

**Goal**: Review ADRs by lifecycle status, supersede a decision with an explicit replacement, keep
history discoverable, and safely delete ADRs only when no replacement references block deletion.

**Independent Test**: Create ADRs in all four statuses, review/filter them, supersede one with a
replacement, verify the original remains visible, attempt blocked and confirmed deletes, and verify
clear success/conflict feedback.

### Tests for User Story 3

- [ ] T046 [P] [US3] Add unrestricted status-transition, superseded-without-replacement, same-diagram replacement, and rejected-record tests in `shared/tests/adr-domain.test.ts`
- [ ] T047 [P] [US3] Add replacement-reference deletion conflict and successful repaired-delete tests in `backend/tests/persistence/adr-repository.test.ts`
- [ ] T048 [P] [US3] Add status update, list discoverability, delete confirmation contract, and 409 blocker response tests in `backend/tests/contract/adrs.test.ts`
- [ ] T049 [P] [US3] Add status badge, filtering, replacement selection, delete confirmation, and success/error announcement tests in `frontend/tests/adr-status.test.tsx`
- [ ] T050 [US3] Add lifecycle review, supersede, blocked replacement delete, confirmed delete, and rejected/superseded discoverability journeys in `e2e/tests/adr-component-tagging.spec.ts`

### Implementation for User Story 3

- [ ] T051 [US3] Implement replacement-reference queries, guarded ADR deletion, and transactional cleanup of an ADR's own component links in `backend/src/persistence/adr-repository.ts`
- [ ] T052 [US3] Implement unrestricted supported status transitions, superseded replacement validation, and dependency conflict details in `backend/src/services/adr-service.ts`
- [ ] T053 [US3] Add ADR delete and lifecycle update behavior, including 409 blocking references, in `backend/src/api/adr-routes.ts`
- [ ] T054 [US3] Implement status update, delete, and replacement-repair actions with retained failed drafts in `frontend/src/state/adr-store.ts` and `frontend/src/api/adr-client.ts`
- [ ] T055 [US3] Build status badges, status filtering, replacement ADR selection, and visible superseded/rejected metadata in `frontend/src/components/AdrStatusBadge.tsx` and `frontend/src/components/AdrList.tsx`
- [ ] T056 [US3] Add delete confirmation, dependency-blocker dialog, repair/remove-link guidance, and success/failure announcements in `frontend/src/components/AdrEditor.tsx`, `frontend/src/components/ConfirmDialog.tsx`, and `frontend/src/components/WorkspaceInspector.tsx`
- [ ] T057 [US3] Integrate lifecycle controls and list refresh behavior into `frontend/src/components/DiagramWorkspace.tsx` without losing the active draft during failed mutations

**Checkpoint**: US3 is independently usable when all statuses remain discoverable, superseding is
validated, and destructive actions are confirmed or blocked with actionable references.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the complete feature against the constitution, design system, contract, and
quickstart without adding out-of-scope collaboration/authentication/revision complexity.

- [ ] T058 [P] Add focused keyboard, accessible-name, focus-order, status-announcement, and contrast coverage for the complete ADR workflow in `frontend/tests/adr-accessibility.test.tsx` and `frontend/tests/accessibility.test.tsx`
- [ ] T059 [P] Add API error, retry, concurrent-edit, and no-silent-data-loss regression coverage in `backend/tests/adrs.test.ts` and `frontend/tests/adr-store.test.ts`
- [ ] T060 [P] Review ADR UI at the DESIGN.md breakpoints and refine responsive layout, overflow, long-text readability, and 44px touch targets in `frontend/src/styles.css`
- [ ] T061 [P] Update `specs/002-adr-component-tagging/contracts/openapi.yaml`, `data-model.md`, and `quickstart.md` if implementation response shapes or validation commands changed
- [ ] T062 Run `npm test`, `npm run build`, and `npm run test:e2e`, then resolve ADR-related failures without weakening existing diagram, persistence, or Mermaid tests
- [ ] T063 Run every acceptance scenario in `specs/002-adr-component-tagging/quickstart.md` against a migrated PostgreSQL instance and record the validation result in the implementation handoff

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; tasks T001-T003 can run in parallel.
- **Phase 2 Foundational**: Depends on Phase 1; T004-T013 establish the shared contract, migration,
  repository seams, and error shape required by all stories.
- **Phase 3 US1**: Depends on Phase 2; delivers the MVP ADR create/save/reopen workflow.
- **Phase 4 US2**: Depends on Phase 2 and the ADR persistence/read-write flow from US1; adds links and
  component deletion protection.
- **Phase 5 US3**: Depends on US1 and US2 because status/deletion behavior must preserve ADR links and
  replacement references.
- **Phase 6 Polish**: Depends on all required user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can begin after Phase 2; no dependency on another user story.
- **US2 (P1)**: Requires the ADR identity and save/reopen APIs from US1, but can be tested independently
  with the shared fixtures and a saved ADR.
- **US3 (P2)**: Requires US1 ADR CRUD and US2 link/dependency behavior to prove history and safe deletes.

### Parallel Opportunities

- T001-T003 can run in parallel during setup.
- T004-T008 can proceed in parallel with T009-T013 after the repository structure is agreed.
- Within US1, T014-T018 are parallel test tasks; T024-T029 are mostly parallel frontend tasks after
  the store/client contract is settled, while T020-T023 are backend tasks.
- Within US2, T030-T035 are parallel test tasks; T036-T040 are backend tasks and T041-T045 are
  frontend tasks that can proceed in parallel once the link contract is stable.
- Within US3, T046-T050 are parallel test tasks; T051-T053 are backend tasks and T054-T057 are
  frontend tasks that can proceed in parallel once conflict payloads are stable.
- T058-T061 are parallel polish tasks; T062-T063 remain final validation tasks.

## Parallel Execution Examples

### User Story 1

```text
Parallel tests: T014, T015, T016, T017, T018
Backend lane: T020 -> T021 -> T022 -> T023
Frontend lane: T024 -> T025 -> T026/T027/T028/T029
Integration: T019 after the API and UI lanes are available
```

### User Story 2

```text
Parallel tests: T030, T031, T032, T033, T034
Backend lane: T036 -> T037 -> T038/T039 -> T040
Frontend lane: T041 -> T042 -> T043/T044/T045
Integration: T035 after the link API and picker are available
```

### User Story 3

```text
Parallel tests: T046, T047, T048, T049
Backend lane: T051 -> T052 -> T053
Frontend lane: T054 -> T055/T056 -> T057
Integration: T050 after lifecycle API and UI are available
```

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 US1.
3. Run the US1 unit, contract, frontend, and Playwright tests.
4. Stop and validate create, required-field errors, save/reopen, and failed-save retry before adding tagging.

### Incremental Delivery

1. Add US1 as the standalone ADR recording MVP.
2. Add US2 to make component scope optional and reference-safe.
3. Add US3 to make lifecycle review, superseding, and deletion safe.
4. Complete Phase 6 and run the full quickstart validation.

### Notes

- Every task uses the required `- [ ] T### [P?] [US#] description with exact file path` format.
- `[P]` is used only where the task can proceed independently in a different file or test seam.
- Stable UUIDs, backend authority, explicit save state, and no silent cascade behavior are acceptance
  constraints throughout implementation.
