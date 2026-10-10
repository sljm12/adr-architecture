# Tasks: C4 Component Diagrams

**Input**: Design documents from `specs/010-c4-component-diagrams/`.

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [REST contract](./contracts/openapi.json), [UI contract](./contracts/ui-contract.md), [export contract](./contracts/export-contract.md), [quickstart.md](./quickstart.md), `.specify/memory/constitution.md`, and `DESIGN.md`.

**Tests**: Required by the specification's implementation-validation assumption and the constitution's artifact-boundary gate. Write each test batch before its corresponding implementation and confirm failures describe the missing behavior. Use existing harnesses. PostgreSQL migration/concurrency/rollback tests must execute without skips for release acceptance; memory repositories and mocked browser journeys cannot replace them.

**Organization**: Existing application setup, shared blocking foundations, five story phases in specification priority order, then cross-cutting validation. Extend existing Container behavior without new runtime dependencies, services, tables, Code-level drill-down, authentication, or collaboration.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies tasks that can run together in the explicitly named batch, in different files, after batch prerequisites are complete. It does not remove dependencies on earlier phases.
- `[US1]` through `[US5]` map to the five user stories in `spec.md`.
- All file paths are relative to the repository root. Named Component-specific files are additions unless already present at implementation time.
- Every task starts unchecked. Task completion requires the stated behavior and its relevant checks; generating this file establishes no implementation or release evidence.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare implementation evidence and reusable three-level fixtures using the existing project.

- [X] T001 Create `specs/010-c4-component-diagrams/validation.md` with baseline build/test results, dedicated disposable PostgreSQL prerequisites, browser/runtime versions, requirement-to-evidence sections, and separate pending usability/Safari gates; follow commands in `specs/010-c4-component-diagrams/quickstart.md` and retain existing package versions in `package-lock.json`.
- [X] T002 Create UUID-stable fixtures in `shared/tests/component-fixtures.ts` for Context, Container, Application/Datastore-owned Component children, immediate/canonical supporting sources, duplicate owner names, local linked/unlinked ADRs, and independent trash batches; preserve reusable Container fixtures in `shared/tests/container-fixtures.ts`.

**Checkpoint**: Fixtures distinguish generic diagram elements from internal C4 Components and capture both source identities without flattening.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish validated domain variants, compatible persistence, root coordination, and protection of identities and dependencies.

**Blocking**: Complete this phase before implementing story behavior. T003–T005 are an independent test-authoring batch after T002; their expected failures must be established before T006–T012.

- [X] T003 [P] Add domain/schema regressions in `shared/tests/component-diagrams.test.ts` for Component scope/roles, metadata limits, finite geometry, empty children, immutable identity expectations, endpoint rules, canonical duplicate sources, and legacy missing-kind/general/Container compatibility.
- [X] T004 [P] Add migration regressions in `backend/tests/persistence/component-migration.test.ts` that seed pre-0007 artifacts, apply migrations through 0007, verify UUIDs/timestamps/layout/subtypes/ADRs/trash provenance, and reject null/nonfinite child boundaries, invalid role variants, duplicate recoverable owners, and invalid composite/source FKs.
- [X] T005 [P] Add foundational write-guard and root-coordination regressions in `backend/tests/contract/component-write-guards.test.ts` and `backend/tests/persistence/component-graph-transactions.test.ts` for immutable scope/status/source identity, inactive ancestors, immediate-source dependencies, root-first lock ordering, rollback, and independence of unrelated roots.
- [X] T006 Extend domain types and level-aware predicates in `shared/src/domain/types.ts`, `shared/src/domain/c4.ts`, and `shared/src/index.ts` with `kind: component`, `ComponentScope`, internal Component role/type, Component availability/context DTOs, and discriminated scope access while retaining existing ContainerScope and Person/Software System predicates.
- [X] T007 Extend parsing and invariants in `shared/src/validation/schemas.ts` and `shared/src/domain/invariants.ts` for Component documents with empty groups, required nonblank name/responsibilities/technology, 200-character name/technology/protocol limits, valid local directed endpoints with at least one internal Component, synthetic-boundary exclusion, and level-specific role/source/geometry rules.
- [X] T008 Add `backend/drizzle/0007_c4_component_diagrams.sql` and reconcile `backend/src/persistence/schema.ts` to widen the three existing kind/scope/role CHECK constraints with explicit required-value null checks; retain owner uniqueness across trash, existing composite owner-parent/source/parent/trash-root FKs and indexes, with no new columns, backfill, or edits to 0005/0006.
- [X] T009 Extend memory and PostgreSQL serialization/query/upsert paths in `backend/src/persistence/diagram-repository.ts` for Component kind/scope/roles and bounded ancestor/descendant lookup; keep stable component diffs, timestamps, source FKs, and separate documents instead of deleting/reinserting parent elements.
- [X] T010 Generalize `backend/src/persistence/graph-transaction.ts` and its repository integrations in `backend/src/persistence/diagram-repository.ts` and `backend/src/persistence/adr-repository.ts` to resolve the highest Context root, lock it first, rediscover membership, lock descendants by depth/UUID, and share one transaction for diagram/ADR mutations and consistent source reads; release locks before rendering/compression.
- [X] T011 Add bounded, batch-hydrated Component scope/source resolution in `backend/src/services/component-context.ts` and reuse small helpers from `backend/src/services/container-context.ts`; retain immediate source UUIDs, derive canonical UUID/editing diagram, exclude owner/duplicates, reject broken/wrong-level/cyclic chains, and derive current owner/ancestor metadata without read-time writes.
- [X] T012 Apply foundational save/delete guards in `backend/src/services/diagram-service.ts` and `backend/src/api/errors.ts` for immutable kind/parent/owner/role/source/status, active ancestor chains, complete references, and active/recoverable owner/source dependencies, including whole-document omission of immediate Container Person/System occurrences; return actionable field errors or DIAGRAM_DEPENDENCY without cascade/retargeting and allow Application↔Datastore changes.

**Checkpoint**: T003–T005 pass against the foundation, including actual PostgreSQL migration/transaction checks. Domain data remains independent of React Flow; persisted source/owner references remain stable.

---

## Phase 3: User Story 1 — Create or open a Component diagram from a container (Priority: P1) — MVP

**Goal**: Double-click or activate the visible keyboard action to create/open one canonical child for an eligible container, preserving parent drafts and existing Container entry.

**Independent Test**: In a saved Container diagram, double-click an Application and activate the Datastore's selected-container action. Repeat entry, overlap requests, and retry a failed post-create load. Each owner retains one UUID/parent association and opens an empty named boundary. Person/boundary/internal Component entry is unavailable; Software System-to-Container entry still works.

### Tests for User Story 1

- [X] T013 [P] [US1] Add REST entry tests in `backend/tests/contract/component-diagrams.test.ts` for GET availability, bodyless POST 201/200, both eligible owner subtypes, canonical supporting-container entry, ineligible owners, inactive/broken sources, recoverable-child RESTORE_REQUIRED, and preserved Component response scope per `specs/010-c4-component-diagrams/contracts/openapi.json`.
- [X] T014 [P] [US1] Add real database creation tests in `backend/tests/persistence/component-diagrams.test.ts` for overlapping creates, lost-response retries, recoverable-owner uniqueness, create versus owner removal/root trash, and unchanged existing Context/Container artifacts.
- [X] T015 [P] [US1] Add entry state tests in `frontend/tests/component-diagram-entry-store.test.ts` for owner-keyed deduplication, stale responses, required successful parent save, canceled/failed saves, post-create load failure/retry, and supporting-source canonical identity.
- [X] T016 [P] [US1] Add UI and browser entry checks in `frontend/tests/component-diagram-entry-ui.test.tsx` and `e2e/tests/component-diagram-entry.spec.ts` for plain-click selection, double-click, keyboard Create/Open/Restore labels, progress/error feedback, modifier/multiselection suppression, and existing Software System entry.

### Implementation for User Story 1

- [X] T017 [US1] Implement availability and idempotent create/open in `backend/src/services/diagram-service.ts` using T010/T011, saved eligible canonical owners, an empty 480×320 boundary at (0,0), owner-derived title, and preserved trash uniqueness; reread an expected unique-create conflict only after leaving the failed transaction.
- [X] T018 [US1] Add `backend/src/api/component-diagram-routes.ts` and register it in `backend/src/api/app.ts` for GET/POST `/diagrams/:diagramId/components/:componentId/component-diagram` and GET `/diagrams/:diagramId/component-context`; follow contracted 200/201/404/409/422 handling and retain existing Container routes.
- [X] T019 [US1] Add typed availability/create/context requests in `frontend/src/api/diagram-client.ts` with shared response validation and canonical parent/container IDs; preserve existing API client operations.
- [X] T020 [US1] Extend `frontend/src/state/diagram-store.ts` with Component availability/progress/errors and owner-keyed create/open requests, source-aware canonical routing, save-before-first-create, retained diagram/ADR draft guards, stale-response suppression, and retry of the already-created child.
- [X] T021 [US1] Integrate Component entry in `frontend/src/components/DiagramCanvas.tsx`, `frontend/src/components/DiagramWorkspace.tsx`, and `frontend/src/components/WorkspaceInspector.tsx`; plain click selects, double-click enters, visible actions support keyboard use, modifiers/multiselection suppress entry, and ineligible elements have no deeper action.
- [X] T022 [US1] Render empty Component scope in `frontend/src/adapters/react-flow/diagram-adapter.ts` and `frontend/src/components/ContainerBoundaryNode.tsx` with an owner-labeled synthetic boundary that is neither a persisted element nor a relationship/ADR target; retain Container boundary behavior and absolute domain coordinates.
- [X] T023 [US1] Add immediate-parent return and destination-heading focus for the entry milestone in `frontend/src/components/DiagramToolbar.tsx` and `frontend/src/components/DiagramWorkspace.tsx`, selecting the owning container and showing Component/Container/Software System context through existing guarded navigation.
- [X] T024 [US1] Execute the US1 contract, PostgreSQL, state, UI, and browser entry checks from T013–T016 and record canonical UUIDs, retries, failure preservation, and Context-to-Container regression results in `specs/010-c4-component-diagrams/validation.md`.

**Checkpoint**: US1 is independently demonstrable. Recovery entry identifies a recoverable child; full confirmed multi-level recovery is completed in US4. This milestone is not full feature release acceptance.

---

## Phase 4: User Story 2 — Describe a container's components and interactions (Priority: P1)

**Goal**: Edit Component-only internals, supporting participants and explicit local interactions within a fitted container boundary.

**Independent Test**: Add three Components with responsibilities/technology, two internal interactions, a sibling Datastore and an existing Person/System occurrence. Move/resize/undo/redo, save/reopen, and confirm readable roles/details, enclosure, stable IDs, local geometry, and unchanged ancestor relationships.

### Tests for User Story 2

- [X] T025 [P] [US2] Add fitting/clearance tests in `shared/tests/component-layout.test.ts` for empty/populated boundaries, 24-unit side/bottom/supporting clearance, 68-unit top inset, displaced supporting occurrences, finite geometry, and preserved UUID/endpoints.
- [X] T026 [P] [US2] Add editing/context REST tests in `backend/tests/contract/component-editing.test.ts` for required details, directed endpoints, candidate eligibility without ancestor interactions, owner/canonical-duplicate exclusions, source-chain refresh, authoritative source metadata, and actionable rejection without partial artifacts.
- [X] T027 [P] [US2] Add store and adapter tests in `frontend/tests/component-diagram-store.test.ts` and `frontend/tests/react-flow-component.test.ts` for stable edit IDs, single-history boundary fit/displacement, invalid direct placement, local source independence, form-level type policies, and undo/redo.
- [X] T028 [P] [US2] Add form/canvas/browser modeling tests in `frontend/tests/component-diagram-ui.test.tsx` and `e2e/tests/component-diagram-editing.spec.ts` for required field feedback retaining input, Component-only creation, Container Application/Datastore retention after switching levels, supporting inclusion, readable interactions, and keyboard move/resize.

### Implementation for User Story 2

- [X] T029 [US2] Generalize scoped boundary fitting in `shared/src/domain/container-layout.ts` and exports in `shared/src/index.ts` to include internal Component roles, retain established insets/clearance, and deterministically displace overlapping supporting occurrences outside the fitted boundary without changing source geometry.
- [X] T030 [US2] Integrate Component context validation/rehydration with load, save, and explicit refresh in `backend/src/services/component-context.ts`, `backend/src/services/diagram-service.ts`, and `backend/src/api/component-diagram-routes.ts`; preserve local layout/IDs/interactions and return immediate/canonical source/editing-diagram information without copying ancestor relationships or ADRs.
- [X] T031 [US2] Add stable-ID internal Component and directed relationship edits in `frontend/src/state/diagram-store.ts` using T007/T029; apply fit plus supporting displacement as one bounded history edit and reject missing/self/boundary/supporting-to-supporting endpoints or invalid placement before mutating state.
- [X] T032 [US2] Extend supporting inclusion/refresh state in `frontend/src/state/diagram-store.ts` to retain immediate source UUIDs and local metadata/layout, exclude owner/canonical duplicates, batch source refresh, and preserve local relationships and source independence on failures.
- [X] T033 [US2] Add `frontend/src/components/C4ComponentForm.tsx` with Component-only type, nonblank name/responsibilities/technology, accessible field errors, and retained invalid inputs; keep the Container form's Application/Datastore policy in `frontend/src/components/ContainerComponentForm.tsx`.
- [X] T034 [US2] Wire level-specific add/edit forms and reset their transient state on level changes in `frontend/src/components/WorkspaceInspector.tsx` and `frontend/src/components/DiagramWorkspace.tsx`; keep existing Context types and prevent stale Container or Component selections leaking across levels.
- [X] T035 [US2] Extend `frontend/src/components/ExternalParticipantPicker.tsx` and `frontend/src/components/WorkspaceInspector.tsx` with eligible immediate-source type/subtype/technology, read-only supporting details, and guarded Edit source navigation to the authoritative diagram, including Context sources behind Container occurrences.
- [X] T036 [US2] Extend `frontend/src/adapters/react-flow/diagram-adapter.ts`, `frontend/src/components/ComponentNode.tsx`, and `frontend/src/components/ContainerBoundaryNode.tsx` to distinguish internal Component/supporting roles with readable name/type/responsibilities/technology, preserve absolute geometry, and exclude synthetic boundaries from handles and ADR selection.
- [X] T037 [US2] Integrate directed local interaction editing/rendering in `frontend/src/components/DiagramCanvas.tsx`, `frontend/src/components/WorkspaceInspector.tsx`, and `frontend/src/components/RelationshipEdge.tsx` with required interaction descriptions, optional protocol display, and validation feedback preserving existing endpoints/data.
- [X] T038 [US2] Apply the workspace guidance from `DESIGN.md` in `frontend/src/styles.css` for neutral nodes, Action Blue focus/selection, dashed boundaries with a reserved 44px header, readable text scope/role labels, and keyboard targets/contrast consistent with existing controls.
- [X] T039 [US2] Execute T025–T028 plus relevant domain/save/Container editing regressions and record modeling, source independence, boundary fitting, and level-switching results in `specs/010-c4-component-diagrams/validation.md`.

**Checkpoint**: A populated Component document can be edited, saved and reopened without changing ancestor content or source identity.

---

## Phase 5: User Story 3 — Navigate and save the three-level hierarchy (Priority: P2)

**Goal**: Preserve child identity/placement and owner-derived titles across navigation, repeated saves, list entry, refresh, rename previews, and asynchronous responses.

**Independent Test**: Save a Component twice, return through both ancestors, reopen through owner/list/refresh, and exercise owner rename/move/resize/Application↔Datastore plus undo/redo/discard. Verify read-only titles, draft previews before filtering/sorting, unchanged creation time/content/layout/links, and no promoted Parent Diagram or ancestor replacement.

### Tests for User Story 3

- [X] T040 [P] [US3] Add load/list/save/navigation REST regressions in `backend/tests/contract/component-navigation.test.ts` and persistence regressions in `backend/tests/persistence/component-editing.test.ts` for exact UUID/kind/parent/owner scope, repeated saves, read-time naming without timestamp writes, duplicate names, and owner subtype switches.
- [X] T041 [P] [US3] Add naming/reconciliation and list tests in `frontend/tests/component-name-sync.test.ts` and `frontend/tests/component-diagram-list.test.ts` for draft owner previews before filter/sort, contextual nonmatching ancestors, undo/redo/discard, delayed save/list responses, and preservation of newer edits.
- [X] T042 [P] [US3] Add guarded three-level navigation/browser checks in `frontend/tests/component-diagram-navigation.test.tsx` and `e2e/tests/component-diagram-navigation.spec.ts` for diagram/ADR Save/Discard/Cancel, failed-save retention, refresh/list entry, immediate-owner selection, focus transfer, and source-return identity.

### Implementation for User Story 3

- [X] T043 [US3] Extend owner-derived title helpers in `shared/src/domain/diagram-name.ts` and `shared/src/index.ts` for Component scope while keeping ownership UUID-based and preserving existing Container naming semantics.
- [X] T044 [US3] Apply current scope/title projection to load/list/availability/create/open/save/trash/recovery responses in `backend/src/services/diagram-service.ts` and serializers in `backend/src/api/diagram-routes.ts` and `backend/src/api/component-diagram-routes.ts`; derive names without read-time writes and reject identity reassignment or independent child naming.
- [X] T045 [US3] Extend child save validation/reconciliation in `frontend/src/state/diagram-store.ts` to require matching UUID/kind/parent/owner/derived name before reporting saved status, retain failed drafts for retry, and preserve newer edits when captured save/list responses arrive.
- [X] T046 [US3] Extend `frontend/src/state/diagram-list.ts` to build Context→Container→Component placement by UUID, apply retained owner-draft names before filtering/sorting, keep ancestor context headings without counting them as matching results, and distinguish matching names without promoting children to roots.
- [X] T047 [US3] Render the three-level saved list and scope labels in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/components/saved-diagram-list.css` with contextual ancestor/owner labels, keyboard entry, and existing empty/filter feedback.
- [X] T048 [US3] Generalize hierarchy/source transitions in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/DiagramToolbar.tsx`, and `frontend/src/components/DiagramSwitchDialog.tsx` to retain per-diagram documents/ADRs/history, apply Save/Discard/Cancel at every level, return to immediate owners, and preserve drafts/view on failed navigation.
- [X] T049 [US3] Present Component level, owning container, parent Container, and Software System plus a read-only owner-derived title in `frontend/src/components/DiagramToolbar.tsx` and `frontend/src/components/WorkspaceInspector.tsx`; rename previews must not create a separate child history edit.
- [X] T050 [US3] Reconcile refreshed source/owner metadata through current documents, retained drafts, and bounded history in `frontend/src/state/diagram-store.ts` and `frontend/src/state/history.ts` while preserving occurrence IDs/layout/relationships/ADR links and newer authored changes.
- [X] T051 [US3] Execute T040–T042 and existing Container naming/list/navigation regressions, recording repeated saves, refresh/list placement, duplicate-name isolation, and delayed-response outcomes in `specs/010-c4-component-diagrams/validation.md`.

**Checkpoint**: Each child remains under its original Container and owner across all entry/save paths, with draft-aware names and retained work at every level.

---

## Phase 6: User Story 4 — Record decisions and recover the nested architecture safely (Priority: P2)

**Goal**: Use exact local ADR links and current dependency safeguards, and trash/restore only explicitly confirmed hierarchy batches.

**Independent Test**: Link and supersede a local ADR on internal/supporting/relationship UUIDs, save/reopen, and test owner/source removal blockers for active and trashed children. Independently trash a Component, then trash/restore Container and Context ancestors. Verify exact affected sets, earlier independent batches retained, stable references, staged deep-child restoration, and no active child beneath an inactive ancestor.

### Tests for User Story 4

- [X] T052 [P] [US4] Add local ADR contract/persistence tests in `backend/tests/contract/component-adrs.test.ts` and `backend/tests/persistence/component-adrs.test.ts` for creation/lifecycle/replacement/link/count/review, exact local Component/occurrence/relationship targets, no inherited decisions, and unchanged links after rename/move/save/reopen.
- [X] T053 [P] [US4] Add dependency/history regressions in `backend/tests/contract/component-dependencies.test.ts` and `frontend/tests/component-diagram-dependencies.test.ts` covering direct delete, PUT omission, unsupported source/owner reclassification, active/recoverable dependencies, every affected child/occurrence in errors, and blocked undo/redo preserving document/cursor.
- [X] T054 [P] [US4] Add recovery REST and PostgreSQL tests in `backend/tests/contract/component-recovery.test.ts` and `backend/tests/persistence/component-recovery.test.ts` for exact named descendant IDs/batches, independent prior trash, inactive ancestors, staged deep-child restore, stale confirmations, legacy single-member confirmation, rollback, and preserved content/ADRs.
- [X] T055 [P] [US4] Add recovery/ADR UI and browser checks in `frontend/tests/component-diagram-recovery.test.tsx`, `frontend/tests/component-adrs.test.tsx`, and `e2e/tests/component-diagram-recovery.spec.ts` for confirmation/cancel focus, retained drafts, requestedDiagramIncluded=false, post-commit load retry, keyboard local linking, and no false success.
- [X] T056 [P] [US4] Extend `backend/tests/persistence/component-graph-transactions.test.ts` with real races for root trash versus Component/ADR writes, parent occurrence removal versus child inclusion, owner deletion versus creation, confirmation membership changes, and rollback after final restore validation; assert allowed serial outcomes and no orphan/partial state.

### Implementation for User Story 4

- [X] T057 [US4] Extend local decision/link validation and transaction-scoped writes in `backend/src/services/adr-service.ts`, `backend/src/persistence/adr-repository.ts`, and `backend/src/api/adr-routes.ts` for Component documents, exact local endpoint IDs, existing lifecycle/replacement/count rules, and root coordination without source/ancestor ADR inheritance.
- [X] T058 [US4] Integrate Component ADR creation/link/review/count/history in `frontend/src/state/adr-store.ts`, `frontend/src/components/AdrLinkPicker.tsx`, `frontend/src/components/ComponentAdrSummary.tsx`, and `frontend/src/components/RelationshipAdrSummary.tsx`; preserve existing badges, local targets, lifecycle behavior, and dirty navigation protection.
- [X] T059 [US4] Complete dependency discovery/presentation in `backend/src/services/diagram-service.ts`, `backend/src/persistence/diagram-repository.ts`, and `backend/src/api/diagram-routes.ts` to identify every active or recoverable dependent child/local occurrence across both source hops, return next corrective actions, and enforce the same checks on direct delete/PUT/reclassification without automatic removal or retargeting.
- [X] T060 [US4] Enforce current owner/source/ADR removal protections for direct edits and undo/redo in `frontend/src/state/diagram-store.ts` and `frontend/src/state/history.ts`, preserving document and cursor when blocked and showing all dependent artifacts through `frontend/src/components/WorkspaceInspector.tsx`; keep Application↔Datastore eligible.
- [X] T061 [US4] Extend trash-impact traversal and atomic confirmed trash in `backend/src/services/diagram-service.ts` and `backend/src/persistence/diagram-repository.ts` to include active descendants at both depths, record exact IDs in the existing batch/root columns, leave independent prior trash untouched, and keep independent Component trash local.
- [X] T062 [US4] Extend restore-impact and atomic restore in `backend/src/services/diagram-service.ts` to find the highest required inactive ancestor, preview its exact existing batch, preserve independent batches, activate ancestor-first, validate before commit, and expose requestedDiagramIncluded=false when the requested child needs later explicit recovery.
- [X] T063 [US4] Extend `backend/src/api/recovery-routes.ts`, `backend/src/api/errors.ts`, and validation in `shared/src/validation/schemas.ts` for exact confirmed IDs/batch, PARENT_INACTIVE/root guidance, changed-impact conflicts requiring re-preview, and legacy omitted confirmation only for safe single-member operations; all failed confirmations leave status unchanged.
- [X] T064 [US4] Extend recovery API/state integration in `frontend/src/api/diagram-client.ts` and `frontend/src/state/diagram-store.ts` to submit previewed IDs/batch, refresh affected hierarchy availability/list metadata, preserve drafts, and distinguish committed mutations from failed subsequent loads.
- [X] T065 [US4] Extend named impact and staged restoration UI in `frontend/src/components/RecoveryImpactDialog.tsx`, `frontend/src/components/RecoveryCoordinator.tsx`, and `frontend/src/components/RecoveryControls.tsx` to show required ancestors/all affected descendants, re-preview stale impact, explain excluded requested children, offer their next explicit restore, and return focus on cancel.
- [X] T066 [US4] Connect Restore component diagram entry and destructive confirmation flows in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/WorkspaceInspector.tsx`, and `frontend/src/components/DiagramDeletionUnsavedDialog.tsx` to exact recovery, existing ADR safeguards, retained unsaved work, and retry loading without repeating a committed mutation.
- [X] T067 [US4] Execute T052–T056 using a dedicated migrated database with RUN_POSTGRES_TESTS=1, verify no persistence suites skip, and record race serial outcomes, exact restored sets, rollback, local ADR integrity, and cancellation/failure behavior in `specs/010-c4-component-diagrams/validation.md`.
- [X] T068 [US4] Add and run a real API/PostgreSQL browser journey in `e2e/tests/component-diagram-persistence.spec.ts` that models/reopens local ADR-linked content and performs immediate-source blocking plus three-level trash/restore; use a dedicated fixture/database and record evidence in `specs/010-c4-component-diagrams/validation.md` separately from mocked E2E.

**Checkpoint**: Clarification A is enforced through direct operations and history. Confirmed recovery preserves prior independent trash intent and all local references, including under real database concurrency.

---

## Phase 7: User Story 5 — Share Component diagrams through existing exports (Priority: P2)

**Goal**: Extend validated selected-only formats and browser hierarchy packages with complete Component content, exact ADR navigation, captured drafts, and portable relative links.

**Independent Test**: Export populated/empty Component single formats and browser packages from Context, Container, and Component. Check exact active membership, scope/details/layout, local ADR links, captured ancestor-derived names, included-only parent/canonical-child actions, offline links, and whole-export failure for an invalid required member.

### Tests for User Story 5

- [X] T069 [P] [US5] Add selected-format tests in `shared/tests/component-export.test.ts`, `backend/tests/component-export.test.ts`, and `cli/tests/component-export-command.test.ts` for populated Component HTML/SVG/Mermaid metadata, empty HTML/SVG boundary, EMPTY_COMPONENT_MERMAID remedy, stable escaped IDs, source subtype, local ADR scope, and saved selected-only CLI/overwrite/exit behavior.
- [X] T070 [P] [US5] Add source/membership REST and persistence tests in `backend/tests/contract/component-html-export-source.test.ts` and `backend/tests/persistence/component-html-export-source.test.ts` for each entry level, active-only descendants, omitted-ancestor hydration, sourceContexts/availability serialization, consistent root-coordinated capture, and HTML_EXPORT_INCOMPLETE on missing/invalid required artifacts.
- [X] T071 [P] [US5] Add package snapshot/path tests in `shared/tests/component-html-package.test.ts` and `frontend/tests/component-html-export.test.tsx` for ancestor-first retained draft overlays, unchanged session/history, UUID membership/ownership guards, flat member paths, unique files/fragments, exact ADR catalog/backlinks, canonical included-child actions, and no out-of-package navigation.
- [X] T072 [P] [US5] Add browser fixtures and direct-from-disk checks in `e2e/tests/html-package-component-fixtures.ts` and `e2e/tests/html-package-component.spec.ts` for three-level/source navigation, exact local ADR selection/catalog/backlinks, keyboard focus, escaped content, recoloring/reload/relocation, and required-member export failure across existing offline browser projects.

### Implementation for User Story 5

- [X] T073 [US5] Extend validated selected snapshots and labels in `shared/src/export/html-snapshot.ts`, `shared/src/export/container-labels.ts`, and `shared/src/export/adr-markdown.ts` for Component scope/roles, required metadata, source subtype, and exact local decisions/links; reject invalid complete artifacts without omission or bundled-ancestor claims.
- [X] T074 [US5] Extend `shared/src/export/svg-layout.ts`, `shared/src/export/svg-export.ts`, and `shared/src/export/mermaid-export.ts` with fitted Component boundary/internal/supporting rendering, complete geometry and direction/protocol, escaped stable identifiers, semantic Mermaid scope, and actionable EMPTY_COMPONENT_MERMAID without dummy nodes; empty SVG retains the boundary.
- [X] T075 [US5] Extend consistent hierarchy gathering in `backend/src/services/html-export-source.ts` and `backend/src/api/export-routes.ts` to capture Context plus active descendants, Container plus active Component children, or Component alone under T010; batch hydrate context-only ancestors/sources, capture local ADRs, detach results, and fail all required invalid/unavailable members with HTML_EXPORT_INCOMPLETE details.
- [X] T076 [US5] Replace singleton containerContext with per-diagram discriminated sourceContexts and Component availability in `shared/src/export/html-package-snapshot.ts`, `shared/src/validation/schemas.ts`, and `frontend/src/api/export-client.ts`; coordinate the source DTO change with T075 while retaining entry/member/capture fields and existing Container availability semantics.
- [X] T077 [US5] Generalize retained draft capture/assembly in `frontend/src/components/ExportButton.tsx` and `shared/src/export/html-package-snapshot.ts` to freeze only existing UUID-keyed diagram/ADR drafts, overlay included saved members ancestor-first regardless of output order, hydrate omitted ancestors from validated contexts, and reject identity/scope/source/membership changes without saving or altering session/history.
- [X] T078 [US5] Extend the destination registry and package completeness validation in `shared/src/export/package-links.ts` and `shared/src/export/html-package.ts` to preserve selected root files and flat `diagrams/<uuid>/` directories, derive all page-relative hierarchy/artifact/ADR/replacement paths, and reject traversal, duplicate paths/IDs, or unresolved file/fragment targets before ZIP creation.
- [X] T079 [US5] Extend diagram/catalog rendering in `shared/src/export/diagram-page.ts` and `shared/src/export/adr-page.ts` with Component scope, included-only immediate-parent/owner return, canonical source-aware child actions, exact local ADR selection/empty states, shared scoped catalog/backlinks, and no creation/restoration/live-app links or internal Component drill-down.
- [X] T080 [US5] Preserve script-free portable styling in `shared/src/export/styles.ts` and default standalone styles in `shared/src/export/svg-export.ts`, including --component-outline/--component-fill customization, inline complete SVG, readable textual roles/scope, escaped authored content, relative resources, and keyboard-visible focus.
- [X] T081 [US5] Extend selected saved export/list parsing in `backend/src/services/export-service.ts`, `cli/src/api-client.ts`, `cli/src/diagrams-command.ts`, and `cli/src/export-command.ts` for Component kind/scope and owner-derived names; keep CLI and existing single builders selected-only with unchanged overwrite/exit conventions and no recursive flag/default.
- [X] T082 [US5] Execute T069–T072 and existing selected-export/Container/HTML package/CLI regressions, including `playwright.offline.config.ts` browser projects and non-skipped PostgreSQL source checks, and record exact membership, draft preservation, format errors, and local destination validation in `specs/010-c4-component-diagrams/validation.md`.
- [ ] T083 [US5] Perform direct-from-disk acceptance in current stable Chrome, Edge, Firefox, and Safari using exported packages from `e2e/tests/html-package-component-fixtures.ts`; record actual browser/OS versions, network-disabled navigation/ADRs/keyboard/recolor/reload/relocation outcomes in `specs/010-c4-component-diagrams/validation.md`, leaving any unavailable actual Safari check explicitly pending rather than substituting WebKit.

**Checkpoint**: Packages include exactly the requested active subtree and every offered local destination resolves; unsupported or incomplete exports fail with a corrective action. Automation and actual Safari acceptance have distinct evidence.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify compatibility, scale, keyboard workflows, usability, and release evidence across all stories.

- [ ] T084 [P] Add scale fixtures/checks in `shared/tests/component-scale-fixture.ts`, `shared/tests/component-scale.test.ts`, and `e2e/tests/performance.spec.ts` for 100 internal/100 supporting/300 relationships per scoped diagram and 1 Context/3 Container/6 Component hierarchy with linked/unlinked ADRs; record five warmups/twenty samples, hardware/runtime/browser, hydration/query/root-lock observations, comparable Container medians, >20% regression investigations, and the existing selected HTML 100-artifact/200-relationship/100-ADR 10-second bound in `specs/010-c4-component-diagrams/validation.md` without adding product caps.
- [ ] T085 [P] Update `README.md` and `specs/010-c4-component-diagrams/quickstart.md` for Component entry/modeling/source editing, three-level list/save/recovery, clarified immediate-source removal steps, supported/empty export behavior, browser hierarchy versus selected-only CLI scope, migration 0007, and dedicated database/browser validation prerequisites.
- [ ] T086 Audit keyboard-only create/open/edit/save/parent-return/ADR-link/recovery and textual scope/type/role cues in `e2e/tests/component-diagram-accessibility.spec.ts` against `DESIGN.md`; fix relevant controls in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/WorkspaceInspector.tsx`, `frontend/src/components/RecoveryImpactDialog.tsx`, and `frontend/src/styles.css` as needed, then record visible focus, canceled-dialog focus return, labels, target sizes, and contrast results in `specs/010-c4-component-diagrams/validation.md`.
- [ ] T087 Run the complete build, Vitest, normal E2E, real-runtime journey, and offline browser checks defined in `package.json`, `playwright.config.ts`, and `playwright.offline.config.ts` with a dedicated migrated DATABASE_URL and RUN_POSTGRES_TESTS=1; record non-skipped PostgreSQL counts, migration/race/rollback evidence, Context/Container groups/ADRs/recovery/export regressions, and FR-001–025/SC-002–010 outcomes in `specs/010-c4-component-diagrams/validation.md`.
- [ ] T088 Observe first-time authors using the entry/modeling journeys in `specs/010-c4-component-diagrams/quickstart.md` and record participant counts, at least 90% entry within 30 seconds (SC-001), and three-component/two-internal/one-supporting interaction save/reopen within five minutes (SC-003) in `specs/010-c4-component-diagrams/validation.md`; keep this gate pending if observations are unavailable and do not infer usability from automated timings.
- [ ] T089 Reconcile the requirement/evidence matrix and remaining failures in `specs/010-c4-component-diagrams/validation.md` and completion markers in `specs/010-c4-component-diagrams/tasks.md`; verify constitution gates, actual-browser/usability evidence, no unrelated changes or silent losses, and keep release sign-off incomplete until every required acceptance gate passes.

---

## Dependencies & Execution Order

### Phase and story dependencies

```text
Setup T001–T002
  └─ Foundation T003–T012
       └─ US1 T013–T024 (P1: canonical entry MVP)
            └─ US2 T025–T039 (P1: modeling)
                 ├─ US3 T040–T051 (P2: hierarchy/save/naming)
                 └─ US4 T052–T068 (P2: decisions/protection/recovery)
                       US3 + US4
                          └─ US5 T069–T083 (P2: exports)
                               └─ Polish T084–T089
```

- Foundation blocks all implementation stories; T006→T007, T008→T009→T010, and T006/T007/T009/T010→T011→T012 are ordered dependencies. T008 depends on domain variants T006/T007; integrated foundation validation follows T012.
- US1 implementation order is T017→T018→T019→T020→T021–T023→T024. Its entry milestone uses existing retained-work behavior; US3 expands and verifies the complete hierarchy/naming workflow, and US4 supplies full recovery confirmations.
- US2 follows US1 for reachable editing. T029/T030 precede store integration T031/T032; forms/rendering T033–T038 integrate the store before T039 validation.
- US3 and US4 can author their disjoint test batches after US2, but their implementations share `diagram-service.ts`, `diagram-store.ts`, and workspace/inspector files. Default to US3 then US4; parallel implementation requires explicit ownership of shared files and an agreed integration sequence. These stories are independently tested through their stated journeys, not advertised as having no shared prerequisites.
- US4 depends on US2's source occurrences/local endpoints and US3's retained hierarchy behavior for full UI acceptance. T056 follows T005 because both extend the same transaction test file. T061→T062→T063→T064→T065/T066 precedes recovery validation T067/T068.
- US5's test batch follows completed US3/US4. Selected rendering T073→T074 and saved source T075→coordinated DTO T076→capture assembly T077 precede integrated registry/pages/styles T078–T080; T081 and all format/package paths must be complete before T082/T083.
- Polish follows all story checkpoints. T084/T085 are an independent batch; run T086 before the final broad checks T087, then collect T088 observations and reconcile T089. T089 also requires actual browser acceptance T083. An unavailable external observation/browser gate remains pending, not passed.

### Within each story

1. Author the marked test batch and confirm expected failures for new behavior.
2. Implement domain/persistence/service behavior before API/client/state/UI integration where the story touches those boundaries.
3. Preserve identities and references on every success/failure path; author relationships and decisions explicitly rather than inheriting them.
4. Run targeted checks and the independent journey at the story checkpoint. Record actual evidence instead of claiming implementation completion from the checklist.

### Parallel opportunities

- Foundation test batch: T003, T004, T005 use disjoint new test files after T002.
- US1 test batch: T013, T014, T015, T016.
- US2 test batch: T025, T026, T027, T028.
- US3 test batch: T040, T041, T042.
- US4 test batch: T052, T053, T054, T055, T056; T056's existing file work requires completed T005.
- US5 test batch: T069, T070, T071, T072.
- Cross-cutting batch: T084 scale checks and T085 documentation update.
- Test authoring is parallelizable within these batches; actual database test runs must use isolated schemas/databases. Implementation tasks touching the same files are deliberately sequential unless work ownership is coordinated.

## Parallel Example: User Story 1

After the foundation, author T013 REST entry tests, T014 PostgreSQL creation tests, T015 entry-store tests, and T016 entry UI/browser tests together. Then implement T017–T023 in dependency order and validate T024.

## Parallel Example: User Story 2

After US1, author T025 layout tests, T026 editing/context tests, T027 store/adapter tests, and T028 modeling UI/browser tests together. T029–T038 integrate their corresponding behavior; T039 verifies the increment.

## Parallel Example: User Story 3

After US2, author T040 API/persistence navigation tests, T041 name/list response-race tests, and T042 guarded navigation UI/browser tests together. Serialize shared service/store integration T043–T050 before T051.

## Parallel Example: User Story 4

After US3, author T052 local ADR tests, T053 dependency/history tests, T054 recovery tests, T055 recovery/ADR UI tests, and T056 database races together. Their files are distinct; T056 depends on the already-completed foundational transaction tests. Validate the integrated implementation and real runtime through T067/T068.

## Parallel Example: User Story 5

After US3/US4, author T069 selected-format/CLI tests, T070 saved-source tests, T071 snapshot/path/draft tests, and T072 offline browser tests together. Coordinate T075/T076's API/client DTO change before capture/package integration; automated T082 and actual-browser T083 provide separate acceptance evidence.

## Implementation Strategy

### MVP first

Complete T001–T012 and US1 T013–T024. Demonstrate Application/Datastore entry, one canonical child per owner, an empty named boundary, keyboard action, successful-parent-save prerequisite, retry preservation, and unchanged System Context-to-Container entry. This is the requested entry MVP; full editing, confirmed nested recovery, exports, and final release gates remain required for the complete feature.

### Incremental delivery

1. Add US2 modeling as the first useful authored Component diagram increment.
2. Add US3 stable navigation/save/list/naming and US4 local decisions/protection/exact recovery, retaining prior story regressions.
3. Add US5 complete selected formats and browser packages with captured drafts and included-only navigation.
4. Finish scale, accessibility, compatibility, actual-browser and participant observations before final acceptance. Keep unavailable evidence explicitly pending.

## Requirement Coverage

| Requirements / outcomes | Primary tasks and evidence |
| --- | --- |
| FR-001–005; SC-001/002 | T013–T024 canonical entry/eligibility/save/retry; T066 restore entry; T088 first-time entry observations |
| FR-006/007; SC-003/005 | T003/T007, T025/T027–T029, T031/T033/T034/T036/T038/T039; T088 modeling observations |
| FR-008–010; SC-006 | T007/T011, T026/T027/T030–T032/T035/T037, T050 source refresh; invalid-reference/export tests T069–T072 |
| FR-011–014; SC-004 | T023, T040–T051; T073/T075/T077 owner-derived export metadata; source/list/load/recovery projections T044 |
| FR-015/016 | T002–T012 UUID/migration/upsert/identity checks, T027/T031/T039, T040/T045/T050, T053/T060 protected history |
| FR-017/021 | T052/T055/T057/T058 local ADR lifecycle/links; T012/T053/T059/T060/T066 deletion protections and confirmation |
| FR-018 (clarification A); SC-006 | T005/T011/T012, T053/T056/T059/T060/T067/T068 immediate/canonical dependencies across active/recoverable children |
| FR-019/020; SC-007 | T054–T056/T061–T068 exact batch recovery, stale-impact rejection, root races and rollback |
| FR-022; SC-009 | T069/T073/T074/T080–T083 complete selected formats, empty-format limitations, selected-only CLI |
| FR-023; SC-009 | T070–T072/T075–T080/T082/T083 subtree membership, captured drafts, portable registry, exact ADR browsing and actual browsers |
| FR-024; SC-010 | T003/T004/T014/T024/T039/T051/T082/T087 legacy/migration/Context/Container regression evidence |
| FR-025; SC-008 | T016/T028/T042/T055/T072, T021/T023/T033–T038/T047–T049/T065/T079/T080/T083/T086 keyboard/focus/textual cues/contrast |
| Engineering scale/quality gates | T001/T024/T039/T051/T067/T068/T082–T089 recorded targeted/full tests, dedicated PostgreSQL, actual browsers, performance and usability |

## Task Summary

| Phase | Task IDs | Count | Parallel-marked tasks |
| --- | --- | ---: | ---: |
| Setup | T001–T002 | 2 | 0 |
| Foundation | T003–T012 | 10 | 3 |
| US1 (P1) | T013–T024 | 12 | 4 |
| US2 (P1) | T025–T039 | 15 | 4 |
| US3 (P2) | T040–T051 | 12 | 3 |
| US4 (P2) | T052–T068 | 17 | 5 |
| US5 (P2) | T069–T083 | 15 | 4 |
| Polish | T084–T089 | 6 | 2 |
| **Total** | **T001–T089** | **89** | **25** |

## Notes

- Use the existing stack and local project conventions. Applied migrations 0005/0006 and unrelated work remain intact.
- Scope and UUID identity are authority; names and React Flow state are projections. Keep immediate Container source occurrences even when a canonical Context source exists.
- No successful partial save/recovery/export, no silent unsupported-content omission, and no unconfirmed cascade or batch expansion.
- Root-coordinated database checks and stable-browser/participant evidence are required gates, not substitutes for one another. Only mark tasks complete when their actual checks succeed.
