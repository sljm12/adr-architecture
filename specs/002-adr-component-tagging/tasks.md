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

- [X] T004 Add `AdrStatus`, `ArchitectureDecisionRecord`, `ComponentReference`, ADR summary, and API payload types in `shared/src/domain/types.ts` without coupling them to React Flow; reserve the component-scoped summary read model for the User Story 2 extension
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

## Phase 4: User Story 2 - Optionally Link ADRs to Diagram Components and Relationships (Priority: P1)

**Goal**: Associate an ADR with zero, one, or multiple components in the active diagram, display
and navigate to component or relationship references, preserve links through ordinary artifact
edits, and show reverse component-to-ADR and relationship-to-ADR summaries with direct ADR opening
and clear empty states.

**Independent Test**: Starting with a saved ADR and a diagram containing components and
relationships, link one and then multiple components and relationships, remove one, save/reopen,
verify an unlinked ADR remains valid, verify missing/cross-diagram artifact links are rejected
without mutation, and view linked and unlinked components and relationships to verify
titles/statuses, direct opening, and explicit no-linked-ADRs states.

### Tests for User Story 2

- [X] T030 [P] [US2] Add link-schema and stable-component-ID tests for zero-to-many links, duplicate IDs, missing components, renames, and repositioning in `shared/tests/adr-validation.test.ts`
- [X] T031 [P] [US2] Add link replacement, ownership, missing-component, cross-diagram, and atomic unlink tests in `backend/tests/persistence/adr-repository.test.ts`
- [X] T032 [P] [US2] Add ADR component-link route contract tests for replace-links and error responses in `backend/tests/contract/adrs.test.ts`
- [X] T033 [P] [US2] Add component deletion conflict tests proving linked components return blocking ADR IDs/titles and are not deleted in `backend/tests/contract/component-dependencies.test.ts`
- [X] T034 [P] [US2] Add link selection, unlinking, unlinked-state, component navigation, and rename/reposition persistence tests in `frontend/tests/adr-linking.test.tsx`
- [X] T035 [US2] Add the zero/one/multiple-link, unlink, rename/reposition, and invalid-link journeys in `e2e/tests/adr-component-tagging.spec.ts`
- [X] T036 [P] [US2] Add component-scoped ADR summary tests for linked, empty, stable-ID, title/status, and update-time responses in `shared/tests/adr-validation.test.ts`
- [X] T037 [P] [US2] Add reverse component-to-ADR repository tests for same-diagram ownership, all linked summaries, deterministic ordering, and an empty result in `backend/tests/persistence/adr-repository.test.ts`
- [X] T038 [P] [US2] Add `GET /diagrams/{diagramId}/components/{componentId}/adrs` contract tests for linked summaries, empty arrays, and missing diagram/component errors in `backend/tests/contract/adrs.test.ts`
- [X] T039 [P] [US2] Add selected-component ADR summary tests for title/status rendering, direct open actions, loading/error feedback, and the distinct no-linked-ADRs state in `frontend/tests/component-adr-summary.test.tsx`
- [X] T040 [US2] Add linked-component and unlinked-component summary journeys, including direct ADR opening, to `e2e/tests/adr-component-tagging.spec.ts`

### Implementation for User Story 2

- [X] T041 [US2] Add the `ComponentAdrSummary` read-model type and response validation in `shared/src/domain/types.ts`, `shared/src/validation/schemas.ts`, and `shared/src/index.ts`
- [X] T042 [US2] Extend `backend/src/persistence/adr-repository.ts` with the reverse component-summary query while preserving existing atomic ADR component-link persistence
- [X] T043 [US2] Extend `backend/src/services/adr-service.ts` with component-summary lookup and same-diagram component ownership checks while preserving existing link validation and dependency queries
- [X] T044 [US2] Extend the existing replace-links route and add `GET /diagrams/{diagramId}/components/{componentId}/adrs` in `backend/src/api/adr-routes.ts`, returning valid empty summaries and actionable 404/422 errors
- [X] T045 [US2] Update component deletion service/repository flow in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts` to block deletion when ADR links exist and return blocking ADR details
- [X] T046 [US2] Extend the component deletion route error mapping in `backend/src/api/diagram-routes.ts` and `backend/src/api/errors.ts` for ADR dependency conflicts
- [X] T047 [US2] Extend `frontend/src/api/adr-client.ts` with the component-summary call and structured 404/error parsing while preserving existing ADR link/unlink calls
- [X] T048 [US2] Add component-link draft actions, zero-link representation, and stable-ID updates to `frontend/src/state/adr-store.ts`
- [X] T049 [US2] Build accessible multi-select/search link picker with selected component names and unlink controls in `frontend/src/components/AdrLinkPicker.tsx`
- [X] T050 [US2] Add linked-component display and navigation callbacks that select the matching diagram component by UUID in `frontend/src/components/AdrEditor.tsx`, `frontend/src/components/DiagramWorkspace.tsx`, and `frontend/src/components/DiagramCanvas.tsx`
- [X] T051 [US2] Build the selected-component ADR summary with title/status rows, direct ADR opening, loading/error feedback, and the explicit no-linked-ADRs state in `frontend/src/components/ComponentAdrSummary.tsx` and `frontend/src/components/WorkspaceInspector.tsx`
- [X] T052 [US2] Connect component selection, summary loading, and direct ADR selection between `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/WorkspaceInspector.tsx`, and `frontend/src/state/adr-store.ts`
- [X] T053 [US2] Extend existing link-picker, chip, empty/unlinked, validation-error, and deletion-conflict styles in `frontend/src/styles.css` with component-summary styles consistent with `DESIGN.md`

### Relationship-link extension for User Story 2

- [X] T054 [P] [US2] Add relationship-link schema, mixed-link, stable-relationship-ID, duplicate, missing, cross-diagram, relabel, and edit tests in `shared/tests/adr-validation.test.ts`
- [X] T055 [P] [US2] Add relationship-link replacement, ownership, atomic unlink, relationship-deletion, and component-dependent-relationship conflict tests in `backend/tests/persistence/adr-repository.test.ts`
- [X] T056 [P] [US2] Add contract tests for ADR relationship-link replacement, relationship-scoped ADR summaries, response link/count fields, and relationship deletion conflicts in `backend/tests/contract/adrs.test.ts` and `backend/tests/contract/component-dependencies.test.ts`
- [X] T057 [P] [US2] Add relationship deletion and component deletion with linked dependent relationships tests proving blocking ADR IDs/titles in `backend/tests/contract/relationship-dependencies.test.ts`
- [X] T058 [P] [US2] Add mixed component/relationship picker, unlink, relationship navigation, relabel/edit persistence, summary, loading/error, and empty-state tests in `frontend/tests/adr-linking.test.tsx` and `frontend/tests/relationship-adr-summary.test.tsx`
- [X] T059 [US2] Add relationship-link, mixed-link, relationship-summary, invalid-link, and relationship/component deletion-blocking journeys in `e2e/tests/adr-component-tagging.spec.ts`
- [X] T060 [US2] Add `RelationshipReference`, relationship IDs on ADR payloads, relationship summary types, schemas, invariants, and exports in `shared/src/domain/types.ts`, `shared/src/validation/schemas.ts`, `shared/src/domain/invariants.ts`, and `shared/src/index.ts`
- [X] T061 [US2] Add the relationship-link migration/table and Drizzle definitions, repository operations, same-diagram checks, reverse summaries, and deletion dependency queries in `backend/drizzle/0002_adrs.sql`, `backend/src/persistence/schema.ts`, `backend/src/persistence/adr-repository.ts`, and `backend/src/persistence/diagram-repository.ts`
- [X] T062 [US2] Add relationship-link replacement, relationship-scoped summary, relationship deletion, component dependent-relationship conflict, and structured error handling in `backend/src/services/adr-service.ts`, `backend/src/services/diagram-service.ts`, `backend/src/api/adr-routes.ts`, `backend/src/api/diagram-routes.ts`, and `backend/src/api/errors.ts`
- [X] T063 [US2] Extend the ADR client/store/link picker/editor and selected-artifact inspector with relationship selection, unlinking, navigation, summaries, empty/error states, and stable-ID handling in `frontend/src/api/adr-client.ts`, `frontend/src/state/adr-store.ts`, `frontend/src/components/AdrLinkPicker.tsx`, `frontend/src/components/AdrEditor.tsx`, `frontend/src/components/RelationshipAdrSummary.tsx`, and `frontend/src/components/WorkspaceInspector.tsx`

**Checkpoint**: US2 is independently usable when an ADR can be saved unlinked or with valid
component and/or relationship UUID links, linked component or relationship deletion is safely
blocked with repair guidance, and selected components and relationships expose linked ADR summaries
or clear no-linked-ADRs states.

## Phase 5: User Story 3 - Edit Components and Relationships (Priority: P1)

**Goal**: Rename existing components and edit relationship labels and direction in place while
preserving stable artifact IDs, ADR links, save/reopen behavior, and undo/redo history.

**Independent Test**: With a saved diagram containing two components, a directed labeled
relationship, and an ADR linked to both artifacts, rename one component, change the relationship
label, reverse the relationship, switch its direction mode, save and reopen, and verify the updated
diagram plus unchanged component/relationship and ADR-link identities.

### Tests for User Story 3

- [X] T064 [P] [US3] Add shared validation and invariant tests for trimmed component names, blank-name rejection, valid direction modes, self-reference rejection, and stable IDs in `shared/tests/validation.test.ts` and `shared/tests/domain.test.ts`
- [X] T065 [P] [US3] Add diagram-store history tests for component rename, relationship label edit, direction reversal, direction-mode change, undo/redo, and preserved ADR-link IDs in `frontend/tests/diagram-store.test.ts`
- [X] T066 [P] [US3] Add persistence tests proving component and relationship edits preserve IDs and creation timestamps while updating editable fields and reopening with ADR links intact in `backend/tests/persistence/diagram-repository.test.ts`
- [X] T067 [P] [US3] Add diagram save contract tests for component-name and relationship label/direction edits, invalid blank names, invalid endpoints, and unchanged IDs in `backend/tests/contract/diagrams.test.ts`
- [X] T068 [P] [US3] Add selected-artifact inspector and canvas tests for edit controls, validation feedback, direction markers, label updates, stable selection, and accessible names in `frontend/tests/diagram-editing.test.tsx`
### Implementation for User Story 3

- [X] T069 [US3] Extend shared diagram validation and edit invariants for trimmed non-blank component names, valid relationship endpoints, directed/undirected modes, and in-place stable-ID updates in `shared/src/validation/schemas.ts` and `shared/src/domain/invariants.ts`
- [X] T070 [US3] Add component-rename, relationship-label, direction-reversal, and direction-mode update actions that record explicit history without changing artifact IDs or ADR links in `frontend/src/state/diagram-store.ts`
- [X] T071 [US3] Extend the selected-artifact inspector with accessible component-name editing and relationship label, endpoint, and direction controls, including field validation and retry-safe unsaved feedback in `frontend/src/components/WorkspaceInspector.tsx`
- [X] T072 [US3] Ensure the React Flow adapter and canvas render renamed component labels, updated relationship labels, swapped source/target endpoints, and directed/undirected markers from domain data while retaining stable node and edge IDs in `frontend/src/adapters/react-flow/diagram-adapter.ts` and `frontend/src/components/DiagramCanvas.tsx`
- [X] T073 [US3] Connect selected component and relationship edit state, save status, validation errors, and stable artifact selection through `frontend/src/components/DiagramWorkspace.tsx` and `frontend/src/components/WorkspaceInspector.tsx`
- [X] T074 [US3] Preserve existing component and relationship IDs and creation timestamps while validating and atomically persisting edited names, labels, endpoints, and direction through `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`
- [X] T075 [US3] Map component and relationship edit validation failures and full-document save responses without changing the existing `PUT /diagrams/{diagramId}` contract in `backend/src/api/diagram-routes.ts` and `backend/src/api/errors.ts`
- [X] T076 [US3] Add edit-form, selected-artifact, direction-marker, validation-error, and unsaved-state styles consistent with DESIGN.md and accessible 44px controls in `frontend/src/styles.css`
- [X] T077 [US3] Verify component and relationship edits preserve ADR component/relationship links and stale-save protection across the diagram and ADR stores in `frontend/src/state/diagram-store.ts` and `frontend/src/state/adr-store.ts`
- [X] T078 [US3] Add the rename, relabel, reverse-direction, direction-mode, save/reopen, and ADR-link-preservation journey to `e2e/tests/adr-component-tagging.spec.ts`

**Checkpoint**: US3 is independently usable when existing components and relationships can be
edited, saved, reopened, undone, and redone without changing stable IDs or breaking ADR links.

---

## Phase 6: User Story 4 - Find and Manage Decision Status (Priority: P2)

**Goal**: Review ADRs by lifecycle status, supersede a decision with an explicit replacement, keep
history discoverable, and safely delete ADRs only when no replacement references block deletion.

**Independent Test**: Create ADRs in all four statuses, review/filter them, supersede one with a
replacement, verify the original remains visible, attempt blocked and confirmed deletes, and verify
clear success/conflict feedback.

### Tests for User Story 4

- [X] T079 [P] [US4] Add unrestricted status-transition, superseded-without-replacement, same-diagram replacement, and rejected-record tests in `shared/tests/adr-domain.test.ts`
- [X] T080 [P] [US4] Add replacement-reference deletion conflict and successful repaired-delete tests in `backend/tests/persistence/adr-repository.test.ts`
- [X] T081 [P] [US4] Add status update, list discoverability, delete confirmation contract, and 409 blocker response tests in `backend/tests/contract/adrs.test.ts`
- [X] T082 [P] [US4] Add status badge, filtering, replacement selection, delete confirmation, and success/error announcement tests in `frontend/tests/adr-status.test.tsx`
### Implementation for User Story 4

- [X] T083 [US4] Implement replacement-reference queries, guarded ADR deletion, and transactional cleanup of an ADR's own component and relationship links in `backend/src/persistence/adr-repository.ts`
- [X] T084 [US4] Implement unrestricted supported status transitions, superseded replacement validation, and dependency conflict details in `backend/src/services/adr-service.ts`
- [X] T085 [US4] Add ADR delete and lifecycle update behavior, including 409 blocking references, in `backend/src/api/adr-routes.ts`
- [X] T086 [US4] Implement status update, delete, and replacement-repair actions with retained failed drafts in `frontend/src/state/adr-store.ts` and `frontend/src/api/adr-client.ts`
- [X] T087 [US4] Build status badges, status filtering, replacement ADR selection, and visible superseded/rejected metadata in `frontend/src/components/AdrStatusBadge.tsx` and `frontend/src/components/AdrList.tsx`
- [X] T088 [US4] Add delete confirmation, dependency-blocker dialog, repair/remove-link guidance, and success/failure announcements in `frontend/src/components/AdrEditor.tsx`, `frontend/src/components/ConfirmDialog.tsx`, and `frontend/src/components/WorkspaceInspector.tsx`
- [X] T089 [US4] Integrate lifecycle controls and list refresh behavior into `frontend/src/components/DiagramWorkspace.tsx` without losing the active draft during failed mutations
- [X] T090 [US4] Add lifecycle review, supersede, blocked replacement delete, confirmed delete, and rejected/superseded discoverability journeys in `e2e/tests/adr-component-tagging.spec.ts`

**Checkpoint**: US4 is independently usable when all statuses remain discoverable, superseding is
validated, and destructive actions are confirmed or blocked with actionable references.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the complete feature against the constitution, design system, contract, and
quickstart without adding out-of-scope collaboration/authentication/revision complexity.

- [X] T091 [P] Add focused keyboard, accessible-name, focus-order, status-announcement, and contrast coverage for the complete ADR and diagram-editing workflow in `frontend/tests/adr-accessibility.test.tsx` and `frontend/tests/accessibility.test.tsx`
- [X] T092 [P] Add API error, retry, concurrent-edit, stale-save, and no-silent-data-loss regression coverage for component edits and ADR links in `backend/tests/contract/diagrams.test.ts` and `frontend/tests/diagram-store.test.ts`
- [X] T093 [P] Review ADR and diagram-editing UI at the DESIGN.md breakpoints and refine responsive layout, overflow, long-text readability, and 44px edit controls in `frontend/src/styles.css`
- [X] T094 [P] Update `specs/002-adr-component-tagging/contracts/openapi.yaml`, `data-model.md`, and `quickstart.md` if implementation response shapes or validation commands changed
- [X] T095 Run `npm test`, `npm run build`, and `npm run test:e2e`, then resolve ADR and diagram-editing failures without weakening existing persistence or Mermaid tests
- [X] T096 Run every acceptance scenario in `specs/002-adr-component-tagging/quickstart.md` against a migrated PostgreSQL instance and record the validation result in the implementation handoff

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; tasks T001-T003 can run in parallel.
- **Phase 2 Foundational**: Depends on Phase 1; T004-T013 establish the shared contract, migration,
  repository seams, and error shape required by all stories.
- **Phase 3 US1**: Depends on Phase 2; delivers the MVP ADR create/save/reopen workflow.
- **Phase 4 US2**: Depends on Phase 2 and the ADR persistence/read-write flow from US1; adds component
  and relationship links, artifact deletion protection, and reverse summaries for both artifact types.
- **Phase 5 US3**: Depends on US1's diagram save/reopen boundary and US2's ADR link behavior so
  component and relationship edits can prove stable-link preservation.
- **Phase 6 US4**: Depends on US1 and US2 because status/deletion behavior must preserve ADR links
  and replacement references; it is independent of US3's edit controls.
- **Phase 7 Polish**: Depends on all required user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can begin after Phase 2; no dependency on another user story.
- **US2 (P1)**: Requires the ADR identity and save/reopen APIs from US1, but can be tested independently
  with the shared fixtures and a saved ADR.
- **US3 (P1)**: Requires US1 diagram save/reopen behavior and US2 link behavior to prove edits preserve
  stable artifact and ADR-link identities.
- **US4 (P2)**: Requires US1 ADR CRUD and US2 link/dependency behavior to prove history and safe deletes;
  it does not require US3.

### Parallel Opportunities

- T001-T003 can run in parallel during setup.
- T004-T008 can proceed in parallel with T009-T013 after the repository structure is agreed.
- Within US1, T014-T018 are parallel test tasks; T024-T029 are mostly parallel frontend tasks after
  the store/client contract is settled, while T020-T023 are backend tasks.
- Within US2, T030-T039 are parallel component-link tests and T040 is the integrated component
  journey. T041-T046 are the completed component summary/backend tasks and T047-T053 are the
  completed component frontend tasks. T054-T059 are parallel relationship-link tests and T060-T063
  are shared/backend/frontend relationship-extension tasks that can proceed once the contracts are stable.
- Within US3, T064-T068 are parallel test tasks; T070-T076 split into shared, backend, and frontend
  lanes after the edit contract is agreed, while T069 is the integrated journey.
- Within US4, T079-T082 are parallel test tasks; T084-T086 are backend tasks and T087-T090 are
  frontend tasks that can proceed in parallel once conflict payloads are stable.
- T091-T094 are parallel polish tasks; T095-T096 remain final validation tasks.

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
Parallel tests: T030, T031, T032, T033, T034, T036, T037, T038, T039, T054, T055, T056, T057, T058
Backend lane: T041 -> T042 -> T043 -> T044/T045/T046
Relationship lane: T060 -> T061 -> T062 -> T063
Frontend lane: T047 -> T048/T049 -> T050/T051/T052/T053, then T063
Integration: T035, T040, and T059 after the link and summary APIs are available
```

### User Story 3

```text
Parallel tests: T064, T065, T066, T067, T068
Shared validation lane: T069
Backend lane: T074 -> T075
Frontend lane: T070 -> T071/T072/T073 -> T076/T077
Integration: T078 after the shared, backend, and frontend edit paths are available
```

### User Story 4

```text
Parallel tests: T079, T080, T081, T082
Backend lane: T084 -> T085 -> T086
Frontend lane: T087 -> T088/T089 -> T090
Integration: T090 after lifecycle API and UI are available
```

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 US1.
3. Run the US1 unit, contract, frontend, and Playwright tests.
4. Stop and validate create, required-field errors, save/reopen, and failed-save retry before adding tagging.

### Incremental Delivery

1. Add US1 as the standalone ADR recording MVP.
2. Add US2 to make component and relationship scope optional and reference-safe.
3. Add US3 to make component and relationship edits safe and link-preserving.
4. Add US4 to make lifecycle review, superseding, and deletion safe.
5. Complete Phase 7 and run the full quickstart validation.

### Notes

- Every task uses the required `- [ ] T### [P?] [US#] description with exact file path` format.
- `[P]` is used only where the task can proceed independently in a different file or test seam.
- Stable UUIDs, backend authority, explicit save state, and no silent cascade behavior are acceptance
  constraints throughout implementation.
