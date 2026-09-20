---

description: "Task list for adding an existing component to an existing group"
---

# Tasks: Add Existing Component to Group

**Input**: Design documents from /specs/006-add-component-to-group/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the feature edits and persists architecture artifacts, changes undo/redo
history, and has explicit validation, accessibility, and save/reopen outcomes.

**Organization**: Tasks are grouped by the two P1 user stories. US1 delivers the valid add-member
workflow; US2 adds duplicate and conflicting-membership protection on that workflow.

## Phase 1: Setup (Feature Test Fixtures)

**Purpose**: Prepare reusable valid and invalid document states for the implementation and tests.

- [X] T001 [P] Add reusable grouped-document fixtures covering an existing group, an ungrouped eligible component, a same-group candidate, a different-group candidate, and an ineligible component in shared/tests/c4-system-groups.test.ts.
- [X] T002 [P] Add a mocked complete-document API state with two groups and an outside component for the add-member browser workflow in e2e/tests/add-component-to-group.spec.ts.

---

## Phase 2: Foundational (Shared Membership Validation)

**Purpose**: Establish the domain-level guard that both valid additions and rejected additions use before any document mutation.

**Critical**: Complete this phase before user-story implementation.

- [X] T003 Add failing shared-domain tests for valid candidates, same-group duplicates, candidates already in another group, missing items, cross-diagram items, and non-Software-System components in shared/tests/c4-system-groups.test.ts.
- [X] T004 Implement assertCanAddGroupMember in shared/src/domain/invariants.ts, confirm it is exposed through shared/src/index.ts, and return stable, actionable validation reasons without changing the document.

**Checkpoint**: Shared validation distinguishes every supported add-member outcome without mutating a document.

---

## Phase 3: User Story 1 - Add an Existing Component to a Group (Priority: P1) 🎯 MVP

**Goal**: Let an author select an existing group, Shift-select an eligible existing component, confirm the addition, and persist the fitted group boundary without changing component identity or references.

**Independent Test**: In a diagram with an existing group and an eligible ungrouped component, select the group, Shift-select the component, confirm Add component to group, and verify the new membership, enclosing boundary, unchanged component/reference data, undo/redo behavior, and save/reopen persistence.

### Tests for User Story 1

- [X] T005 [US1] Add a frontend store test for a successful addGroupMember action that appends one stable component ID, fits the boundary, preserves component positions and relationships, and creates one undoable revision in frontend/tests/system-group-store.test.ts.
- [X] T006 [P] [US1] Add React Flow adapter coverage for the post-add parent relationship, relative visual position, absolute domain round-trip, and stable relationship endpoints in frontend/tests/react-flow-groups.test.ts.
- [X] T007 [P] [US1] Add UI contract coverage for group-plus-component compound selection, the Add component to group control, accessible labels, and success feedback in frontend/tests/system-group-ui.test.tsx.
- [X] T008 [P] [US1] Add an API contract test for a complete-document PUT that adds an existing component to an existing group and returns the normalized membership in backend/tests/contract/system-groups.test.ts.
- [X] T009 [P] [US1] Add persistence coverage for round-tripping the added membership while preserving group/component IDs and timestamps in backend/tests/persistence/system-groups.test.ts.
- [X] T010 [P] [US1] Add a Playwright happy-path test for selecting a group, Shift-selecting an outside component, confirming the add, checking boundary enclosure, saving, reopening, and using the keyboard-accessible action in e2e/tests/add-component-to-group.spec.ts.

### Implementation for User Story 1

- [X] T011 [US1] Implement addGroupMember in frontend/src/state/diagram-store.ts using assertCanAddGroupMember, the existing bounded history update path, and fitGroupBoundsAfterLayout while preserving the candidate component and all existing references.
- [X] T012 [US1] Extend CanvasSelection and the workspace-derived selection state for a group-member candidate in frontend/src/components/WorkspaceInspector.tsx and frontend/src/components/DiagramWorkspace.tsx without changing the existing new-group selection list.
- [X] T013 [US1] Update Shift-click and selection-change handling in frontend/src/components/DiagramCanvas.tsx so a selected group plus a Shift-selected component produces the compound candidate state while group creation mode continues to use component-only selection.
- [X] T014 [US1] Add the group-details candidate summary, Add component to group confirmation action, success state, and post-success group selection behavior in frontend/src/components/WorkspaceInspector.tsx.
- [X] T015 [P] [US1] Add accessible selected/candidate cues and stable aria labels for the group and component nodes in frontend/src/components/ComponentNode.tsx and frontend/src/components/SystemGroupNode.tsx.
- [X] T016 [P] [US1] Style compound selection, candidate feedback, success feedback, focus states, and 44px inspector actions according to DESIGN.md in frontend/src/styles.css.

**Checkpoint**: US1 is independently functional: a valid existing component can be added, the boundary refits, the document can be undone/redone and saved/reopened, and existing references remain intact.

---

## Phase 4: User Story 2 - Explain Duplicate or Conflicting Membership (Priority: P1)

**Goal**: Reject duplicate and conflicting membership attempts with immediate, specific feedback and no document, history, layout, or persistence mutation.

**Independent Test**: With a valid group selected, Shift-select a current member and then a member of another group. Verify the duplicate and cross-group messages, unchanged group memberships/boundaries/history, and safe cancellation of invalid candidates.

### Tests for User Story 2

- [ ] T017 [US2] Add store tests proving same-group and cross-group candidates return false, expose the required message, leave the document and group boundary unchanged, and do not add undo/redo entries in frontend/tests/system-group-store.test.ts.
- [ ] T018 [US2] Add UI accessibility tests for duplicate/conflicting live alerts, disabled or rejected add actions, candidate cancellation, and preservation of the selected group in frontend/tests/system-group-ui.test.tsx.
- [ ] T019 [US2] Add API and persistence tests proving duplicate member IDs, cross-group membership, ineligible members, and invalid boundaries return 422 without replacing the stored document in backend/tests/contract/system-groups.test.ts and backend/tests/persistence/system-groups.test.ts.
- [ ] T020 [US2] Add Playwright coverage for same-group duplicate feedback, different-group conflict feedback naming the current group, invalid candidate cancellation, and unchanged member counts in e2e/tests/add-component-to-group.spec.ts.

### Implementation for User Story 2

- [ ] T021 [US2] Map assertCanAddGroupMember outcomes to exact user-facing groupError messages in frontend/src/state/diagram-store.ts, including the selected group for duplicates and the current group for cross-group conflicts.
- [ ] T022 [US2] Render actionable role=alert and aria-live feedback, candidate eligibility state, and disabled/rejected confirmation behavior in frontend/src/components/WorkspaceInspector.tsx without clearing the group selection.
- [ ] T023 [US2] Ensure pane clicks, normal clicks, cancellation, diagram switches, and exits from new-group mode clear the compound candidate without mutating the document in frontend/src/components/DiagramCanvas.tsx and frontend/src/components/DiagramWorkspace.tsx.

**Checkpoint**: US1 and US2 are both independently verifiable: valid additions work, while duplicate, conflicting, missing, and ineligible attempts are explained and remain no-ops.

---

## Phase 5: Polish and Cross-Cutting Verification

**Purpose**: Verify save/retry behavior, documentation alignment, and the complete feature boundary.

- [ ] T024 [P] Extend save-failure, retry, stale-response, and undo/redo regression coverage for an added membership in frontend/tests/system-group-recovery.test.tsx.
- [ ] T025 [P] Reconcile the implemented PUT payload, 422 no-mutation behavior, data model, and runnable scenarios in specs/006-add-component-to-group/contracts/openapi.yaml, specs/006-add-component-to-group/data-model.md, and specs/006-add-component-to-group/quickstart.md.
- [ ] T026 Run the focused shared, frontend, backend, and persistence suites listed in specs/006-add-component-to-group/quickstart.md and fix regressions in the referenced source and test files.
- [ ] T027 Run the feature Playwright workflow and the full npm test and npm run build commands from package.json, review the feature diff for unrelated changes, and mark completed work in specs/006-add-component-to-group/tasks.md.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 can start immediately and may run in parallel.
- **Foundational (Phase 2)**: T003 depends on the fixture coverage from T001; T004 depends on T003 and blocks both user stories.
- **User Story 1 (Phase 3)**: T005-T010 are test-first work after T004; T011-T016 implement the valid workflow after the tests are in place.
- **User Story 2 (Phase 4)**: T017-T020 depend on the US1 selection/action surface; T021-T023 implement the rejection and cancellation behavior.
- **Polish (Phase 5)**: T024-T027 depend on the desired user stories being implemented.

### User Story Dependencies

- **US1 (P1)**: Depends only on the foundational validation helper. This is the MVP increment.
- **US2 (P1)**: Depends on the compound selection and add action delivered by US1, then independently verifies duplicate/conflicting no-op behavior.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- After T004, T006-T010 can run in parallel because they target separate adapter, UI, backend, persistence, and browser-test files.
- After T011-T014 establish the interaction contract, T015 and T016 can run in parallel on node markup and styles.
- T024 and T025 can run in parallel during polish.

## Parallel Example: User Story 1

After T004 is complete, the following test tasks can be assigned in parallel:

- T005: frontend store/history behavior in frontend/tests/system-group-store.test.ts
- T006: React Flow adapter behavior in frontend/tests/react-flow-groups.test.ts
- T007: UI accessibility contract in frontend/tests/system-group-ui.test.tsx
- T008: PUT contract behavior in backend/tests/contract/system-groups.test.ts
- T009: persistence round-trip in backend/tests/persistence/system-groups.test.ts
- T010: browser happy path in e2e/tests/add-component-to-group.spec.ts

## Parallel Example: User Story 2

After the US1 checkpoint, the rejection-focused test tasks can be prepared together by separate owners,
subject to same-file merge coordination:

- T017: store no-op and history assertions in frontend/tests/system-group-store.test.ts
- T018: inspector live-feedback assertions in frontend/tests/system-group-ui.test.tsx
- T019: API/repository immutability assertions in backend/tests/contract/system-groups.test.ts and backend/tests/persistence/system-groups.test.ts
- T020: duplicate/conflict browser scenarios in e2e/tests/add-component-to-group.spec.ts

## Implementation Strategy

### MVP First

1. Complete T001-T004 to establish fixtures and shared validation.
2. Complete T005-T016 for US1.
3. Stop at the US1 checkpoint and validate the complete valid-addition workflow independently.
4. Because duplicate feedback is also P1 and part of the requested behavior, complete T017-T023 before release.

### Incremental Delivery

1. Deliver US1: valid add-member flow, fitted boundary, stable references, history, and persistence.
2. Deliver US2: duplicate/conflicting feedback, invalid-candidate no-op behavior, and cancellation.
3. Complete T024-T027 for retry safety, contract alignment, full tests, build, and browser verification.

## Notes

- Every task uses the required checkbox, sequential task ID, applicable parallel marker, story label in user-story phases, and an exact repository file path.
- Shared domain validation remains independent of React Flow; React Flow changes are limited to transient selection and visual adaptation.
- No new endpoint, database migration, authentication, collaboration, nested group, or bulk membership workflow is planned.
