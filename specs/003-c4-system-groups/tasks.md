---

description: "Actionable implementation tasks for C4 System Groups"
---

# Tasks: C4 System Groups

**Input**: Design documents from `/specs/003-c4-system-groups/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story. Tests are included because the feature
specification defines mandatory independent tests and the project constitution requires automated
coverage at artifact boundaries.

**Implementation rule**: Complete test tasks before the corresponding implementation tasks and verify
the tests fail for the missing behavior where practical. Preserve stable UUIDs for components,
relationships, ADR links, groups, and memberships throughout every task.

## Phase 1: Setup

**Purpose**: Establish the shared C4 vocabulary used by validation and UI work.

- [X] T001 [P] Add canonical `person` and `software-system` C4 artifact metadata, labels, and descriptions in `shared/src/domain/c4.ts`.

**Checkpoint**: The feature has one shared source for supported C4 values and user-facing terminology.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared artifact boundary and persistence foundation before any user story
implementation begins.

**Critical**: Complete this phase before implementing User Stories 1-3.

- [X] T002 Extend `C4ArtifactType`, `SystemGroup`, `GroupBoundaryLayout`, and `DiagramDocument.groups` in `shared/src/domain/types.ts`, and export the new types from `shared/src/index.ts`.
- [X] T003 Extend `shared/src/validation/schemas.ts` with the supported C4 type schema, group/member/layout schemas, optional `groups` defaulting to `[]`, and field-addressable validation for new component and group writes.
- [X] T004 Add pure group geometry helpers in `shared/src/domain/group-layout.ts` for padded bounds calculation around existing member positions, boundary containment, member-to-group relative positions, automatic boundary fitting after member movement or resize, and translating a group with all member components without auto-arranging them.
- [X] T005 Extend `shared/src/domain/invariants.ts` to validate group UUID and diagram ownership, unique names after trimming and case-insensitive comparison, at least two unique Software System members, one-group-per-component, non-nesting, positive finite layout, boundary containment after layout changes, and unchanged relationship or ADR reference rules.
- [X] T006 [P] Add shared fixtures and domain/validation tests for supported and legacy C4 types, trimmed/case-insensitive duplicate group names, membership cardinality, missing/cross-diagram/non-system members, duplicate membership, non-nesting, position-preserving creation bounds, expanding/repositioning/shrinking member layout, and unchanged component/relationship/ADR IDs in `shared/tests/c4-system-groups.test.ts`.
- [X] T007 [P] Add `system_groups` and `system_group_members` tables, indexes, composite membership key, timestamps, and explicit non-cascading foreign keys in `backend/drizzle/0003_system_groups.sql` and `backend/src/persistence/schema.ts`.
- [X] T008 [P] Add initial Fastify contract assertions for `groups`, C4 component `type`, group validation errors, component-removal group conflicts, and Mermaid group export responses in `backend/tests/contract/system-groups.test.ts` using `specs/003-c4-system-groups/contracts/openapi.yaml`.
- [X] T009 Update the in-memory and PostgreSQL diagram repositories in `backend/src/persistence/diagram-repository.ts` to load groups deterministically, map normalized memberships, insert/replace them transactionally with the complete document, preserve existing group IDs and creation timestamps, and return `groups: []` for legacy diagrams.
- [X] T010 Update `backend/src/services/diagram-service.ts` to run shared group validation before mutation and report group IDs when component deletion is blocked by membership, while preserving atomic save and existing ADR/relationship dependency checks.
- [X] T011 Update `backend/src/api/diagram-routes.ts`, `backend/src/api/recovery-routes.ts`, and `backend/src/api/errors.ts` so GET/PUT responses include groups, omitted input groups remain backwards-compatible, invalid groups return actionable 422 fields, and grouped component deletion returns a clear 409 conflict.

**Checkpoint**: Shared schemas/invariants, database schema, repositories, services, and API error
contracts can represent a valid empty or grouped document without React Flow dependencies.

---

## Phase 3: User Story 1 - Create C4 System-Context Components (Priority: P1) - MVP

**Goal**: Let an author create Person and Software System components, see their types, and retain
those types through save/reopen while cancellation creates nothing.

**Independent Test**: Create one component of each supported type, verify the type is visible and
distinguishable, save/reopen the diagram, and cancel a creation without adding an artifact.

### Tests for User Story 1

- [X] T012 [P] [US1] Add Zustand tests for required C4 type creation, stable component IDs, cancellation-safe draft behavior, and save/reopen serialization in `frontend/tests/c4-artifact-types.test.ts`.
- [X] T013 [P] [US1] Add component creation/edit/review accessibility tests for Person and Software System labels, descriptions, type visibility, validation feedback, and keyboard cancellation in `frontend/tests/c4-artifact-types.test.tsx`.

### Implementation for User Story 1

- [X] T014 [US1] Extend `addComponent`, component type editing, and type-label helpers in `frontend/src/state/diagram-store.ts` so new components require `person` or `software-system`, legacy null types remain readable, and type edits preserve component IDs and history.
- [X] T015 [US1] Render the C4 type label and a non-color-only visual distinction in `frontend/src/components/ComponentNode.tsx`, and add the corresponding node styles in `frontend/src/styles.css` using the existing canvas, surface, typography, focus, and 44px control conventions.
- [X] T016 [US1] Add a C4 artifact-type fieldset with Person and Software System descriptions to creation and selected-component editing/review in `frontend/src/components/WorkspaceInspector.tsx`; show actionable validation and leave the document unchanged on cancel.
- [X] T017 [P] [US1] Update component type display in ADR/component review choices, including the `Unclassified` legacy state, in `frontend/src/components/AdrLinkPicker.tsx`.
- [X] T018 [US1] Add the create-type, cancel, save, and reopen acceptance journey with mocked diagram persistence in `e2e/tests/c4-system-groups.spec.ts`.

**Checkpoint**: US1 is independently usable: authors can create, identify, save, and reopen typed
C4 components without creating incomplete artifacts or breaking existing references.

---

## Phase 4: User Story 2 - Group Software Systems into a Larger Boundary (Priority: P1)

**Goal**: Let an author select two or more Software System components, clearly see which components
are selected, create and name a labeled bounding group, move it with its members, review membership,
remove a member explicitly, rename it, and ungroup without deleting components or relationships. When
selection contains an incompatible artifact, explain the artifact types and grouping rule without
mutating the document.

**Independent Test**: Seed or create at least two Software System components, select them, verify every
selected component is visibly highlighted and that the highlight updates when selection changes,
group them, verify the boundary encloses them behind readable member nodes, move the group while
comparing relative positions, then rename, remove membership, and ungroup. Also attempt a mixed Person
and Software System selection and verify the author is told why it cannot be grouped and the document
is unchanged.

### Tests for User Story 2

- [X] T019 [P] [US2] Add store tests for valid/invalid group creation, trimmed/case-insensitive name uniqueness, preserved member positions, automatic boundary fitting after member movement or resize, explicit member removal, rename, ungroup, group translation deltas, and undo/redo in `frontend/tests/system-group-store.test.ts`.
- [X] T020 [P] [US2] Add adapter tests for parent-before-child ordering, `parentId`, relative child positions, `expandParent: true`, non-connectable group nodes, position-preserving initial bounds, automatic boundary fitting after member movement, stable edge endpoints, and group drag round trips in `frontend/tests/react-flow-groups.test.ts`.
- [X] T021 [P] [US2] Add inspector and canvas accessibility tests for multi-selection, invalid Person selection, trimmed/case-insensitive group-name validation, member review/removal, boundary-fitting feedback, rename, ungroup confirmation, focus, and status feedback in `frontend/tests/system-group-ui.test.tsx`.

### Implementation for User Story 2

- [X] T022 [US2] Implement `createGroup`, `renameGroup`, `moveGroup`, `removeGroupMember`, and `ungroup` in `frontend/src/state/diagram-store.ts` using shared geometry helpers, explicit bounded history, trimmed/case-insensitive name validation, a boundary fitted around existing member positions without auto-arranging them, automatic refitting after member movement or resize, stable member IDs, and no relationship/ADR mutations.
- [X] T023 [US2] Extend `toReactFlow` and the reverse drag conversion in `frontend/src/adapters/react-flow/diagram-adapter.ts` to emit parent group nodes before children, convert absolute domain positions to relative positions, use `expandParent: true`, refit the group after member movement or resize, and preserve membership until an explicit removal action.
- [X] T024 [US2] Create the selectable, non-connectable labeled boundary node in `frontend/src/components/SystemGroupNode.tsx`, including a keyboard-readable group name and member context without using color as the sole cue.
- [X] T025 [US2] Update `frontend/src/components/DiagramCanvas.tsx` to register group nodes, track keyboard-usable multi-selection, select groups separately from components/relationships, move groups with member deltas, reconcile member dragging with automatic boundary fitting, and preserve relationship endpoints.
- [X] T026 [US2] Add the `Group selected systems` command and selection feedback to `frontend/src/components/DiagramToolbar.tsx`, including disabled/invalid states for fewer than two or non-Software-System selections.
- [X] T027 [US2] Add group creation, member review, rename, explicit `Remove from group`, and confirmed `Ungroup` workflows to `frontend/src/components/WorkspaceInspector.tsx`, with actionable duplicate/blank/minimum-member errors, capitalization/whitespace duplicate detection, and feedback that creation preserves existing member positions.
- [X] T028 [US2] Add group boundary, type-label, responsive, focus, and contrast styles to `frontend/src/styles.css` using flat labeled boundaries, existing hairlines, Action Blue controls, Focus Blue rings, spacing tokens, and no gradients or decorative group shadows.
- [X] T029 [US2] Add the multi-select, position-preserving create, boundary rendering, group drag, member movement with boundary expansion/repositioning/shrink-to-fit, invalid selection/name variants, rename, explicit member removal, and confirmed ungroup acceptance journeys in `e2e/tests/c4-system-groups.spec.ts`.

### Follow-up tests and implementation for updated selection feedback

- [X] T030 [P] [US2] Add UI contract tests for non-color-only selected-component highlighting, per-component deselection updates, selection clearing on cancel/completion, and a mixed Person/Software System error that names the incompatible types and grouping rule in `frontend/tests/system-group-ui.test.tsx`.
- [X] T031 [P] [US2] Add end-to-end acceptance coverage for identifying every selected component, clearing selection feedback after cancellation and successful grouping, and rejecting mixed Person/Software System selections with an explanatory message and unchanged document in `e2e/tests/c4-system-groups.spec.ts`.
- [X] T032 [US2] Update `frontend/src/components/DiagramCanvas.tsx` and `frontend/src/components/DiagramWorkspace.tsx` to keep grouping selections visibly highlighted without relying on color alone, update highlights after select/deselect, and clear transient selection state on deselection, cancellation, completion, or exit from grouping selection.
- [X] T033 [US2] Update `frontend/src/components/DiagramToolbar.tsx` and `frontend/src/components/WorkspaceInspector.tsx` to explain why an ineligible or incompatible component cannot be grouped, including the Person/Software System rule, while preventing partial group creation and leaving the document unchanged.

**Checkpoint**: US2 is independently demonstrable with seeded or newly typed systems, and all group
operations preserve member artifacts, relationships, and ADR references in the local document. The
selection state is clear and accessible, and incompatible selections provide an actionable reason.

### Follow-up for automatic boundary fitting after member movement

- [X] T034 [P] [US2] Extend geometry tests for moving or resizing a member beyond each group edge, fitting the boundary around all member boxes with padding, repositioning the boundary for new left/top extremes, shrinking unused space, and preserving absolute member positions in `shared/tests/c4-system-groups.test.ts`.
- [X] T035 [P] [US2] Add store tests for member movement and resize history that verify automatic boundary expansion, repositioning, and shrink-to-fit while preserving group membership, component IDs, and relationship/ADR references in `frontend/tests/system-group-store.test.ts`.
- [X] T036 [P] [US2] Add React Flow adapter tests for `expandParent: true`, measured member bounds, parent-before-child output, member positions outside the prior boundary during drag, and round-trip persistence of the refitted group layout in `frontend/tests/react-flow-groups.test.ts`.
- [X] T037 [US2] Update `shared/src/domain/group-layout.ts` and `shared/src/domain/invariants.ts` with deterministic fit-after-layout rules that enclose every rendered member box with label and padding insets while allowing group expansion, repositioning, and shrink-to-fit without changing membership.
- [X] T038 [US2] Update `frontend/src/state/diagram-store.ts`, `frontend/src/adapters/react-flow/diagram-adapter.ts`, and `frontend/src/components/DiagramCanvas.tsx` to allow a member to cross the prior boundary, recompute and persist the fitted group position/size after member drag or resize, and keep domain-owned absolute positions and stable membership authoritative.
- [X] T039 [US2] Extend the member-movement acceptance journey in `e2e/tests/c4-system-groups.spec.ts` to move members beyond right, left, bottom, and top edges, verify expansion or repositioning and later shrink-to-fit, then save/reopen and confirm the fitted boundary still encloses every member.

**Checkpoint**: US2 also proves that member movement never becomes trapped by the previous boundary:
the group refits around all members in every direction, persists the resulting layout, and retains
stable membership and references.

---

## Phase 5: User Story 3 - Preserve Group Meaning and References (Priority: P2)

**Goal**: Persist group identity, membership, layout, C4 types, relationships, and ADR links through
save/reopen and edits, protect grouped component deletion, and export group meaning without silent loss.

**Independent Test**: Save a grouped diagram with relationships and ADR links, reopen it, rename and
reposition a member, verify the same IDs and links resolve, confirm group deletion/ungrouping preserves
members, and verify Mermaid output or an actionable unsupported-format error.

### Tests for User Story 3

- [ ] T040 [P] [US3] Add PostgreSQL/in-memory persistence tests for group round trips, legacy empty-group compatibility, normalized membership, trimmed/case-insensitive name uniqueness, position-preserving group creation data, group ID/createdAt preservation, transactional invalid-save immutability, and component deletion conflicts in `backend/tests/persistence/system-groups.test.ts`.
- [ ] T041 [P] [US3] Add Mermaid tests for Person and Software System shapes, labeled stable-ID subgraphs, complete relationship emission, escaped group names, invalid group errors, and no silent omission in `shared/tests/c4-system-groups-export.test.ts`.
- [ ] T042 [P] [US3] Add frontend recovery/history tests for failed group saves, retry, stale save responses, save/reopen replacement, undo/redo, group deletion confirmation, and preservation of component/ADR identities in `frontend/tests/system-group-recovery.test.tsx`.
- [ ] T043 [P] [US3] Add the save/reopen, member rename/reposition, ADR-link integrity, group deletion confirmation, grouped-component deletion conflict, and Mermaid export journey in `e2e/tests/c4-system-groups-persistence.spec.ts`.

### Implementation for User Story 3

- [ ] T044 [US3] Complete transactional group reconciliation, server timestamp handling, legacy document defaults, stable group/member ID preservation, and grouped-component deletion blockers in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`.
- [ ] T045 [US3] Extend `shared/src/export/mermaid-export.ts` to validate group data, escape group names, render typed component shapes, emit each group as a labeled `subgraph`, retain all relationships, and raise actionable group-specific errors for unsupported content.
- [ ] T046 [US3] Update `frontend/src/components/ExportButton.tsx` and `frontend/src/api/export-client.ts` to expose Mermaid group semantics, explain that exact canvas positions are not exported, and surface group-specific validation failures without clearing saved data.
- [ ] T047 [US3] Update `frontend/src/components/RecoveryControls.tsx` and `frontend/src/api/diagram-client.ts` to display group-membership deletion conflicts, preserve confirmation semantics, and keep existing relationship/ADR dependency messaging intact.
- [ ] T048 [US3] Harden save/load response handling in `frontend/src/state/diagram-store.ts` so grouped drafts remain visible on failure, retries submit unchanged data, stale responses cannot overwrite newer group edits, and successful reopen resets history only after replacement succeeds.

**Checkpoint**: US3 proves durable reference integrity and recoverable group behavior across the
shared, persistence, API, frontend, and export boundaries.

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Finish documentation, accessibility, compatibility, and release validation across all
stories.

- [ ] T049 [P] Document C4 component types, group behavior, migration `0003_system_groups.sql`, Mermaid limitations, and stable-reference guarantees in `README.md`.
- [ ] T050 [P] Add responsive and accessibility regression coverage for group labels, focus order, 44px targets, contrast, keyboard multi-selection, selected-state highlighting, incompatibility explanations, and confirmation dialogs in `frontend/tests/accessibility.test.tsx` and `frontend/src/styles.css`.
- [ ] T051 [P] Reconcile the implementation-facing contract, data model, and validation scenarios in `specs/003-c4-system-groups/contracts/openapi.yaml`, `specs/003-c4-system-groups/data-model.md`, and `specs/003-c4-system-groups/quickstart.md` after implementation details stabilize.
- [ ] T052 Run every command and acceptance scenario in `specs/003-c4-system-groups/quickstart.md`, including `npm test`, `npm run build`, and `npm run test:e2e`, and resolve any regression before marking the feature complete.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 has no dependencies.
- **Phase 2 (Foundational)**: T002-T011 depend on T001 where they use the shared C4 vocabulary; this phase blocks all story implementation.
- **Phase 3 (US1)**: T012-T018 depend on Phase 2. US1 is the recommended first vertical slice and MVP.
- **Phase 4 (US2)**: T019-T039 depend on Phase 2 and the typed component behavior from US1 for the end-to-end creation path. Adapter/store work can use seeded typed fixtures before US1 UI completion; T030-T033 are the follow-up selection-feedback slice, and T034-T039 are the follow-up automatic-boundary-fitting slice after the original US2 implementation tasks.
- **Phase 5 (US3)**: T040-T048 depend on Phase 2; the full browser persistence journey depends on the completed US1/US2 UI, while backend/export work can proceed in parallel after the foundation.
- **Phase 6 (Polish)**: T049-T052 depend on the desired story checkpoints, with documentation and accessibility work able to start as soon as their target behavior exists.

### User Story Completion Order

1. **US1 (P1)**: First vertical slice for typed C4 component creation and persistence.
2. **US2 (P1)**: Builds on US1's Software System selection and adds system boundaries.
3. **US3 (P2)**: Hardens save/reopen, reference integrity, recovery, and export across the completed editor.

US2's domain, persistence, and adapter tests can begin after Phase 2 with seeded Software System
fixtures, but its primary UI acceptance path is most efficiently completed after US1. US3's backend
round-trip and Mermaid work can proceed alongside US2; its end-to-end workflow follows US2.

### Parallel Opportunities

- After T005, run T006 shared tests and T007 database/schema work in parallel; T008 contract tests can run independently against the checked-in OpenAPI artifact.
- Within US1, T012 and T013 are parallel test work; T015 and T017 touch separate UI files after shared type behavior is available.
- Within US2, T019, T020, and T021 are parallel baseline test work; T024, T026, and T028 touch separate UI files after the store/adapter contracts are established. T030 and T031 are parallel selection-feedback tests, followed by T032 and T033 for the canvas/workspace and toolbar/inspector updates. T034-T036 are parallel boundary-fitting tests, followed by T037-T038 for shared geometry and editor integration, then T039 for the browser journey.
- Within US3, T040, T041, T042, and T043 are parallel test work; T045 and T047 touch separate export/recovery boundaries after the foundational persistence contract exists.
- In Polish, T049, T050, and T051 are parallel documentation/test work before T052's full validation run.

## Parallel Example: User Story 1

```text
Task T012: Add Zustand C4 type behavior tests in frontend/tests/c4-artifact-types.test.ts
Task T013: Add C4 creation/edit accessibility tests in frontend/tests/c4-artifact-types.test.tsx
```

After those tests are in place, execute T014, then T015-T017 in parallel where file ownership is
separate, and finish with T018 for the browser journey.

## Parallel Example: User Story 2

```text
Task T019: Add group store tests in frontend/tests/system-group-store.test.ts
Task T020: Add React Flow group adapter tests in frontend/tests/react-flow-groups.test.ts
Task T021: Add group inspector/canvas tests in frontend/tests/system-group-ui.test.tsx
Task T030: Add selection-feedback UI tests in frontend/tests/system-group-ui.test.tsx
Task T031: Add mixed-type grouping acceptance tests in e2e/tests/c4-system-groups.spec.ts
Task T034: Add shared boundary-fitting geometry tests in shared/tests/c4-system-groups.test.ts
Task T035: Add store boundary-fitting tests in frontend/tests/system-group-store.test.ts
Task T036: Add React Flow boundary-fitting tests in frontend/tests/react-flow-groups.test.ts
```

Then implement T022-T025 in dependency order; T026-T028 can be split by toolbar, inspector, node,
and stylesheet ownership before T029 runs the integrated journey. Complete T032-T033 for the updated
selection feedback and incompatibility explanation behavior before re-running T031. Complete T037,
then T038, and finish with T039 for automatic boundary expansion, repositioning, and shrink-to-fit.

## Parallel Example: User Story 3

```text
Task T040: Add repository round-trip tests in backend/tests/persistence/system-groups.test.ts
Task T041: Add Mermaid group export tests in shared/tests/c4-system-groups-export.test.ts
Task T042: Add frontend recovery tests in frontend/tests/system-group-recovery.test.tsx
Task T043: Add persistence/reference Playwright tests in e2e/tests/c4-system-groups-persistence.spec.ts
```

Implement T044-T048 after the boundary tests expose the missing behavior, keeping backend, export,
recovery UI, and store work in separate files where possible.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and the blocking shared/API foundation in Phase 2.
2. Complete US1 type selection, visible labels, cancel behavior, save/reopen, and its tests.
3. Stop at the US1 checkpoint and validate the independent test from the feature specification.
4. Demo the typed C4 component workflow before adding group interaction complexity.

### Incremental Delivery

1. Foundation + US1: typed Person and Software System components.
2. Add US2: selectable, movable, reviewable, and removable system groups.
3. Complete T034-T039 to add automatic boundary fitting when members move or resize beyond the prior
   boundary.
4. Add US3: durable group persistence, ADR/reference preservation, deletion protection, recovery,
   and Mermaid export.
5. Complete Phase 6 and run the full quickstart validation.

### Notes

- `[P]` means the task can be executed in parallel without modifying the same file or depending on incomplete work.
- `[US1]`, `[US2]`, and `[US3]` map directly to the prioritized user stories in `spec.md`.
- Every task has a checkbox, sequential ID, required story label where applicable, and an exact file path.
- Do not introduce authentication, permissions, real-time collaboration, nested groups, group ADR links, or a second persistence protocol.
