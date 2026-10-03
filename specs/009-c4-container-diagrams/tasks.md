# Tasks: C4 Container Diagrams

**Input**: Design documents from `specs/009-c4-container-diagrams/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [contracts/ui-contract.md](./contracts/ui-contract.md), [contracts/export-contract.md](./contracts/export-contract.md), [quickstart.md](./quickstart.md), `.specify/memory/constitution.md`, and `DESIGN.md`.

**Tests**: Required by the specification's implementation-validation assumption and the constitution's artifact-boundary gate. Author the dedicated test batches before their corresponding implementation and confirm that the new behavior fails for the intended reason; T016 additionally checks the integrated foundation. Keep existing fixtures compatible. Real PostgreSQL checks must execute without skips for release validation; memory repositories do not prove concurrency.

**Organization**: Setup, shared foundations, four user-story increments in specification priority order, then cross-cutting validation. This is an existing application: retain its stack, migrations, package format, general diagrams, groups, and ADR workflows.

**Updated**: 2026-10-02 against the revised plan/contracts for FR-007, FR-011, FR-023, FR-024, SC-009, and SC-010. Preserve completed T001–T028 and their recorded evidence in [validation.md](./validation.md); that evidence does not establish the revised subtype/save/list requirements. All remaining tasks are unchecked and renumbered in execution order. Original pending T029–T040 become T029–T047, T041–T048 become T048–T060, T049–T072 become T061–T084, and T073–T078 become T085–T090.

**Clarification reconciliation**: Updated against the 2026-10-02 FR-015/FR-017 decisions and OpenAPI 1.2.0. Expand the pending US4 source-protection/recovery tasks, corresponding tests, requirement coverage, and final validation without changing the current T001–T090 IDs or any completion markers. New coverage is required for occurrence-specific blockers across active/recoverable children and confirmed child-initiated parent-batch restoration; the prior implementation evidence does not establish these clarified behaviors.

**Status**: 90 tasks: 60 completed, 30 outstanding. Phases 4–5 (T029–T060) are complete; migration 0005 remains unchanged and subtype work uses forward migration 0006. Validation is recorded in [validation.md](./validation.md). Recovery, export and the full release validation gate remain outstanding in T061–T090.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means tasks can run concurrently with other marked tasks in the same stated batch, in different files, after their prerequisites are complete. It does not waive phase dependencies.
- `[US1]` through `[US4]` map to the four stories in `spec.md`.
- Paths are relative to the repository root. New paths are explicitly named; other paths refer to existing implementation/test surfaces.
- Availability, request progress, and source context are transient session state, outside diagram history. Scope IDs, component/occurrence IDs, relationship endpoints, and ADR links are domain identities.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repeatable fixtures and validation using the existing project, without adding runtime dependencies.

- [X] T001 Add reusable general-parent, empty/populated-child, duplicate-name, grouped-owner, external-source, and legacy-payload fixtures with stable UUIDs in `shared/tests/container-fixtures.ts`, preserving existing fixtures in `shared/tests/html-export-fixtures.ts`.
- [X] T002 Adapt PostgreSQL fixture cleanup to remove child ADR links, child relationships/occurrences, child diagrams, then parent/source rows without violating the planned restrictive FKs in `backend/tests/fixtures.ts`, `backend/tests/persistence/diagram-repository.test.ts`, `backend/tests/persistence/system-groups.test.ts`, and `backend/tests/acceptance/adr-postgres-quickstart.test.ts`; preserve test isolation and existing gates.
- [X] T003 Record the current build/test results, database/browser prerequisites, and general-diagram interaction baseline in `specs/009-c4-container-diagrams/validation.md` using `package.json`, `e2e/tests/performance.spec.ts`, and `specs/009-c4-container-diagrams/quickstart.md`; distinguish executed, failed, and skipped checks and retain the existing lockfile/dependencies.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the domain, storage, source resolution, and data-protection boundaries that every story needs.

**Critical**: Complete this phase before user-story implementation. Tests T004–T006 can be authored together after Setup; implementation tasks then follow their declared dependencies.

### Foundation tests

- [X] T004 [P] Add structural/invariant and legacy-normalization cases in `shared/tests/container-diagrams.test.ts` and `shared/tests/compatibility.test.ts` for diagram kinds/scopes, roles, required trimmed text, UUIDs, finite geometry, directed/nonblank child relationships, endpoint rules, empty child groups, unknown feature fields, and unchanged legacy free-form types.
- [X] T005 [P] Add deterministic empty/fitted-boundary, 24-unit clearance, 44-unit header, minimum-size, UUID-ordered external displacement, collision, fractional-coordinate, and rejected direct-placement cases in `shared/tests/container-layout.test.ts` using `specs/009-c4-container-diagrams/data-model.md`.
- [X] T006 [P] Add dedicated-database migration and round-trip cases in `backend/tests/persistence/container-migration.test.ts` that seed migrations 0001–0004, apply planned 0005, and verify unchanged IDs, creation times, legacy types, groups, relationships, and ADR links plus owner uniqueness across trash, owner-parent membership, source FKs, and duplicate-source constraints.

### Foundation implementation

- [X] T007 Extend domain types, C4 helpers, structural schemas, invariants, and public exports in `shared/src/domain/types.ts`, `shared/src/domain/c4.ts`, `shared/src/domain/invariants.ts`, `shared/src/validation/schemas.ts`, and `shared/src/index.ts` with kind/scope/boundary, element/container/external roles, technology/protocol, source IDs, resolved summaries, and availability/context/blocker shapes; normalize omitted fields only for general/legacy inputs and reject invalid or unknown feature content.
- [X] T008 Implement pure fitting, containment/clearance checks, deterministic external relocation, and atomic layout-result helpers in `shared/src/domain/container-layout.ts` and export them through `shared/src/index.ts`; implement the exact empty/minimum/padding rules from `specs/009-c4-container-diagrams/data-model.md` without coupling to React Flow (depends on T007).
- [X] T009 Add `backend/drizzle/0005_c4_container_diagrams.sql` and mirror it in `backend/src/persistence/schema.ts` with kind/ownership/boundary/provenance, roles/source/technology/protocol, restrictive FKs, composite owner-parent membership, all-status owner uniqueness, duplicate external-source prevention, indexes, and role/finite-size checks; use additive general/element defaults without reclassifying existing data (depends on T007).
- [X] T010 Extend memory and PostgreSQL serialization and ID-preserving document diffs in `backend/src/persistence/diagram-repository.ts` to round-trip all new fields and original creation timestamps, keep server-only trash provenance outside client documents, and expose transaction-aware graph lookup/write interfaces; hydrate cached external display fields before resolved validation (depends on T009).
- [X] T011 Add `backend/src/persistence/graph-transaction.ts` and integrate it with `backend/src/persistence/diagram-repository.ts` and `backend/src/persistence/adr-repository.ts` so graph writes resolve and lock the canonical general parent first, then affected children in UUID order, reread eligibility/activity/dependencies, and execute checks and mutations on the same transaction; provide equivalent rollback/coordination semantics for memory test repositories (depends on T010).
- [X] T012 Add batched contextual resolution in `backend/src/services/container-context.ts` for canonical owner/source identities, current source metadata, valid parent membership, eligible picker sources, and consistent read snapshots; share it with `backend/src/services/diagram-service.ts` and reject broken/inactive graphs without copying source layout or parent relationships (depends on T011).
- [X] T013 Apply previous-versus-incoming document dependency checks inside graph transactions in `backend/src/services/diagram-service.ts` and `backend/src/persistence/diagram-repository.ts`: reject ownership/kind changes, child downgrade through old payloads, status/provenance changes, existing occurrence role/source reassignment, protected owner/source omission or invalid retyping, and omitted ADR-linked artifacts; preserve existing local relationship/group blockers and prevent generic creation from bypassing canonical child ownership (depends on T012).
- [X] T014 Coordinate every ADR create/update/delete/link/lifecycle write with graph activity and stable local target checks in `backend/src/services/adr-service.ts` and `backend/src/persistence/adr-repository.ts`; keep validation and mutation in the same transaction, preserve replacement/lifecycle rules, and reject boundary targets or writes to inactive child/parent graphs (depends on T013).
- [X] T015 Extend actionable typed conflict/validation envelopes in `backend/src/api/errors.ts`, `backend/src/api/diagram-routes.ts`, `backend/src/api/adr-routes.ts`, and `backend/src/api/app.ts` to retain existing ADR/local blockers and add diagram blockers, immutable-scope, broken-reference, and inactive-parent errors matching `specs/009-c4-container-diagrams/contracts/openapi.yaml` (depends on T014).
- [X] T016 Add and run foundation write-boundary contract tests in `backend/tests/contract/container-write-guards.test.ts` and transaction/rollback tests in `backend/tests/persistence/container-graph-transactions.test.ts` for PUT/DELETE bypass attempts, generic-create bypass, invalid source/type/scope changes, parent mutation versus child writes, ADR-linked omissions, and inactive ADR mutations; rerun T004–T006 and ensure real database cases execute after T015.

**Checkpoint**: Shared data is compatible, geometry is deterministic, and graph writes cannot silently detach dependencies. Child workflow endpoints/UI remain story work.

## Phase 3: User Story 1 — Create or Open from a Software System (Priority: P1) — MVP

**Goal**: Both requested entry points create/open one canonical child for the intended Software System, retaining current work on errors.

**Independent Test**: In a saved general diagram with two Software Systems and a Person, double-click the first system and use the selected-system action on the second. Each opens its own empty labeled child; repeating either action returns that same ID. Group membership and duplicate names do not alter ownership. Failure/retry leaves the current diagram intact and creates no duplicate. Exercise source resolution using a prepared child containing an external Software System.

### Tests for User Story 1

- [X] T017 [P] [US1] Add availability/create-or-open REST contract cases in `backend/tests/contract/container-diagrams.test.ts` for GET without mutation, POST 201 new/200 existing, 409 RESTORE_REQUIRED, ineligible artifacts, source-occurrence canonicalization, membership/path mismatch, inactive parent, empty default boundary/name, and actionable failures.
- [X] T018 [P] [US1] Add real PostgreSQL concurrent/repeated creation, duplicate-name/grouped-owner, uniqueness-race rollback/winner resolution, creation-versus-owner-change/trash, and failed-creation rollback cases in `backend/tests/persistence/container-diagrams.test.ts`; verify exactly one complete canonical child across active/trash states.
- [X] T019 [P] [US1] Add request deduplication, successful-parent-save prerequisite, wholly unsaved owner Save/Cancel, discarded unpersisted owner rejection, dirty ADR guarding, stale response, and create-succeeded/load-failed retry cases in `frontend/tests/container-diagram-entry-store.test.ts`.
- [X] T020 [P] [US1] Add double-click/inspector eligibility, grouped owners, external-source action, availability loading/retry, keyboard button, ordinary click/Shift selection, and empty-boundary/header cases in `frontend/tests/container-diagram-entry-ui.test.tsx`.
- [X] T021 [P] [US1] Add browser entry-point/identity/failure scenarios in `e2e/tests/container-diagrams.spec.ts` for two owners, duplicate labels, grouped owners, Person/group rejection, repeated activation, unsaved parent, keyboard action, and retry; prepare source-occurrence navigation fixtures without requiring US2 authoring UI.

### Implementation for User Story 1

- [X] T022 [US1] Implement atomic canonical create-or-open in `backend/src/persistence/diagram-repository.ts` using `backend/src/persistence/graph-transaction.ts`, all-status owner uniqueness, and complete empty-child insertion; return existing active children, preserve trashed ones, and roll back uniqueness conflicts before resolving the winner in a fresh transaction.
- [X] T023 [US1] Implement canonical eligibility, read-only availability, create-or-open, and container-context endpoints in `backend/src/services/diagram-service.ts`, `backend/src/services/container-context.ts`, and new `backend/src/api/container-diagram-routes.ts`, registered in `backend/src/api/app.ts`; match the feature contract's status codes and source-occurrence resolution (depends on T022).
- [X] T024 [US1] Add validated availability/create-or-open/context calls and typed error parsing in `frontend/src/api/diagram-client.ts`, preserving normalized kind/scope/role/source fields and RESTORE_REQUIRED child summaries rather than stripping feature content (depends on T023).
- [X] T025 [US1] Implement one guarded create/open navigation intent in `frontend/src/state/diagram-store.ts` and `frontend/src/components/DiagramWorkspace.tsx`, coordinating `frontend/src/state/adr-store.ts` and `frontend/src/components/DiagramSwitchDialog.tsx`: deduplicate requests, save required parent/ADR drafts, recheck persisted owners after discard, commit only validated loaded data, retain retry intent on failure, and reset history/selection/ADR context only on success (depends on T024).
- [X] T026 [US1] Add `frontend/src/components/ContainerBoundaryNode.tsx` and adapt `frontend/src/adapters/react-flow/diagram-adapter.ts` and `frontend/src/components/DiagramCanvas.tsx` to render a synthesized, labeled, nonselectable/nonconnectable/nondeletable boundary behind components, including empty children; exclude it from domain conversion, ADR targets, and relationship endpoints.
- [X] T027 [US1] Wire Software System double-click and native selected/viewed-system Create/Open actions in `frontend/src/components/DiagramCanvas.tsx` and `frontend/src/components/WorkspaceInspector.tsx` to T025; retain plain-click/Shift behavior, progress/retry feedback, external-source identity, and a clear restoration-required response without creating a replacement (depends on T026).
- [X] T028 [US1] Show the Container diagram/current owner heading, empty-child instruction, and DESIGN.md focus/live-feedback styling in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/DiagramToolbar.tsx`, and `frontend/src/styles.css`; verify T017–T021, including saved empty-child reopen (depends on T027).

**Checkpoint**: US1 is demonstrable with saved/empty children and prepared external fixtures. Full Restore entry-point integration is completed in US4; the MVP checkpoint is not a release waiver for recovery or export safety.

**Revision prerequisite**: The shared subtype extension is assigned to US2, the earliest story needing it. Complete T029–T041 before later stories consume revised component schemas. Do not reopen completed foundation tasks or treat their old fixtures as proof of subtype compatibility.

## Phase 4: User Story 2 — Describe Containers and Communication (Priority: P1)

**Goal**: Author Application/Datastore containers with readable metadata, source-linked externals, deterministic geometry, and ordinary undo/redo. Extend the completed shared foundation with the subtype required by this story and later persistence/export work.

**Independent Test**: On a prepared child, verify exactly Application and Datastore in add/edit controls; model a web application, service, and data store with responsibilities/technology and directed interactions. Include a parent Person and Software System outside the boundary. Change a subtype, move/resize, undo/redo, save/reopen, and verify IDs, subtype, links, complete labels, and unchanged parent content. Switch from a parent Person/Software System form and confirm its draft cannot carry into child creation.

### Tests for User Story 2

- [X] T029 [P] [US2] Extend `shared/tests/container-diagrams.test.ts` and `shared/tests/compatibility.test.ts` with application/datastore role rules, missing/null/unsupported subtype rejection, general/external null normalization, old child write rejection, unchanged legacy free-form types, and owner/source helpers that still accept only parent Person/Software System elements.
- [X] T030 [P] [US2] Extend `backend/tests/persistence/container-migration.test.ts` for clean install through 0006 and populated 0005-to-0006 upgrade: seed active/trashed generic containers, general/free-form elements, external occurrences, relationships and ADR links; assert application backfill only for internal rows, null for other roles, explicit NOT NULL subtype CHECK behavior, unchanged IDs/type/timestamps/details/layout/links, and both new subtype round trips.
- [X] T031 [P] [US2] Add child PUT/source-context contract and memory/PostgreSQL round-trip cases in `backend/tests/contract/container-editing.test.ts` and `backend/tests/persistence/container-editing.test.ts` for both subtypes, stable subtype changes, required metadata/protocol, missing/unsupported subtype and forbidden internal Person/Software System types, read-only sources, owner/duplicate/other-parent/source-chain rejection, invalid geometry/endpoints, rollback, and no parent writes.
- [X] T032 [P] [US2] Add atomic add/edit/subtype/move/resize/remove, relationship validation, bounded history, UUID/ADR endpoint retention, fitted boundary/displaced external, and rejected generic parent commands/no-dirty/no-history cases in `frontend/tests/container-diagram-store.test.ts`.
- [X] T033 [P] [US2] Add boundary exclusion, subtype/role/metadata/protocol retention, child own-name/kind/scope preservation, absolute positions, and pointer/keyboard geometry round-trip cases in `frontend/tests/react-flow-container.test.ts`.
- [X] T034 [P] [US2] Add exactly-two-choice add/edit forms, Application default, persisted Datastore selection, document/role switch draft reset, separate source picker/read-only external details, duplicate sources, long labels, directed relationships, and invalid-command feedback cases in `frontend/tests/container-diagram-ui.test.tsx`.
- [X] T035 [US2] Extend `e2e/tests/container-diagrams.spec.ts` with Application/Datastore-only creation/editing, subtype undo/redo/save/reopen, stale parent form selection, three-container modeling, external inclusion, optional protocol, keyboard/pointer geometry, clearance rejection, and one-step boundary/displacement undo before implementing the editor behavior.

### Implementation for User Story 2

- [X] T036 [US2] Add ContainerType and nullable component.containerType to `shared/src/domain/types.ts`, role-aware subtype label/validation helpers to `shared/src/domain/c4.ts`, role rules to `shared/src/domain/invariants.ts` and `shared/src/validation/schemas.ts`, and public exports to `shared/src/index.ts`; keep C4ArtifactType/source eligibility unchanged, require explicit internal subtype, normalize omission only for general legacy input, and update `shared/tests/container-fixtures.ts` and `shared/tests/html-export-fixtures.ts` with valid subtypes without changing identities (depends on T029–T035 test authoring).
- [X] T037 [US2] Add `backend/drizzle/0006_container_component_types.sql` and mirror it in `backend/src/persistence/schema.ts`: nullable container_type, backfill role container only to application without timestamp/type changes, replace components_c4_role_check transactionally retaining prior rules, explicitly require non-null application/datastore for containers and null for element/external, and preserve applied 0005 (depends on T036).
- [X] T038 [US2] Round-trip containerType through memory/PostgreSQL reads, inserts and ID-preserving updates in `backend/src/persistence/diagram-repository.ts`; retain scope/boundary/source fields and creation times, and verify clean-install/upgrade compatibility and rejection constraints from T030 against an isolated validation schema (depends on T037).
- [X] T039 [US2] Add validated container/subtype/external/relationship commands in `frontend/src/state/diagram-store.ts` and extend `frontend/src/state/history.ts` so required metadata, subtype, sizing, fitted boundary, and displaced externals commit as one bounded snapshot; reject parent-type creation/reclassification in child documents before mutation, and preserve child own name/kind/scope, artifact IDs, endpoints and ADR links across history (depends on T038).
- [X] T040 [US2] Complete child edit validation/persistence in `backend/src/services/diagram-service.ts`, `backend/src/services/container-context.ts` and `backend/src/persistence/diagram-repository.ts`; require both allowed subtypes, resolve eligible sources under the existing graph transaction, overwrite display caches, retain local layout, reject invalid geometry rather than repair on save, and preserve immutable scope/dependency guards (depends on T039).
- [X] T041 [US2] Retain normalized containerType in saved/loaded child parsing and PUT serialization in `frontend/src/api/diagram-client.ts` using the revised shared schema; preserve child ID/name/kind/scope/boundary, send explicit subtype, and expose field-level corrections without stripping unsupported content; run T029–T031 before consumers adopt the revised response shape (depends on T040).
- [X] T042 [US2] Route completed pointer drag/resize and keyboard movement through one domain command in `frontend/src/components/DiagramCanvas.tsx` and `frontend/src/adapters/react-flow/diagram-adapter.ts`; retain subtype and child scope metadata, group pointer gestures, persist keyboard changes, restore rejected external geometry, and preserve boundary/ADR focus behavior (depends on T041).
- [X] T043 [US2] Render wrapped Application/Datastore and source-derived Person/Software System metadata plus relationship protocol in `frontend/src/components/ComponentNode.tsx`, `frontend/src/components/RelationshipEdge.tsx` and `frontend/src/styles.css`; use role-aware helpers, grow domain dimensions before boundary fitting, and avoid clipping complete content (depends on T042).
- [X] T044 [US2] Add atomic internal forms and child toolbar/inspector modes in `frontend/src/components/DiagramToolbar.tsx` and `frontend/src/components/WorkspaceInspector.tsx`: exactly Application/Datastore in add/edit, Application default, retained selected subtype, required name/responsibilities/technology, and no general group/type commands in child views (depends on T043).
- [X] T045 [US2] Reset add/edit drafts on document ID/kind or selected-role changes in `frontend/src/components/WorkspaceInspector.tsx` and `frontend/src/components/DiagramWorkspace.tsx`; derive controls from current domain context, prevent stale parent Person/Software System values from reaching internal commands, and keep external details read-only (depends on T044).
- [X] T046 [US2] Add Include external participant using fresh context in `frontend/src/components/WorkspaceInspector.tsx` and `frontend/src/state/diagram-store.ts`; exclude owner, disable included sources, distinguish duplicate labels by IDs, and create local occurrence IDs/layout with null subtype/technology and no copied parent relationships (depends on T045).
- [X] T047 [US2] Add directed-only child interaction creation/editing with required description and optional protocol in `frontend/src/components/DiagramCanvas.tsx`, `frontend/src/components/WorkspaceInspector.tsx` and `frontend/src/state/diagram-store.ts`; reject unsupported endpoints before persisting an edge, retain confirmed removal/blockers, and verify T029–T035 including SC-009 (depends on T046).

**Checkpoint**: Both subtypes persist through migration, editor/history, adapter and API; only two internal choices are available and external inclusion remains a separate workflow. A prepared child supports the independent acceptance test.

## Phase 5: User Story 3 — Navigate and Continue Without Losing Context (Priority: P2)

**Goal**: Save the same named child under its canonical parent, render the library hierarchy, restore current source context, and guard every navigation path against losing diagram/ADR drafts.

**Independent Test**: From a named parent, rename/edit/save its child twice and verify PUT uses the same child ID, its own name/kind/scope persist, one entry appears beneath that parent, and parent content is unchanged. Repeat after refresh/library reopen, save-before-navigation, parent/owner rename, identical names across parents, failed save/retry, and malformed save responses. Exercise child-only/parent-only name/date filters, matching counts, sorting, missing parent summaries, keyboard actions, source refresh, and Save/Discard/Cancel.

### Tests for User Story 3

- [X] T048 [P] [US3] Add resolved GET/flat active-list/trash-list and repeated child PUT contract cases in `backend/tests/contract/container-navigation.test.ts` for independently named children, persisted subtypes, stable ID/kind/scope/creation times, unchanged parent content, names duplicated across parents, eligible source rename/reclassification, and broken references.
- [X] T049 [P] [US3] Add ordinary/repeated save, save-before-navigation, refresh/library reopen, failed save/retry and wrong-ID/name/kind/parent/owner response cases in `frontend/tests/container-diagram-navigation.test.tsx`; assert same child PUT path, no generic-create call or Parent Diagram assignment, unchanged parent content, child-only summary upsert, newer-edit retention, diagram/ADR dirty guards, stale load rejection and focus reset.
- [X] T050 [P] [US3] Extend `frontend/tests/diagram-list.test.ts` with UUID-based groups, duplicate parent/owner/child names, parent-only/child-only own-name/date matches, contextual headings excluded from counts, missing-parent fallback, deterministic group/sibling sorting with UUID ties, clear filters, invalid ranges, and immutable summary input.
- [X] T051 [P] [US3] Extend `frontend/tests/saved-diagram-list.test.tsx` with nested native lists, child own-name/level/owner/parent accessible labels, unavailable-parent context, child-only results/counts, successful-save single-row reconciliation, keyboard open/delete actions, focus/selection and existing no-results/error behavior.
- [X] T052 [US3] Extend `e2e/tests/container-diagrams.spec.ts` with named child/repeated saves, parent content comparison, save-before-navigation, refresh/library reopen, parent/owner/source rename/regroup, identical names under separate parents, failed-save retry, nested filters/counts/sorting, and Save/Discard/Cancel before implementing the save/list changes.

### Implementation for User Story 3

- [X] T053 [US3] Resolve current scope/source details for saved child GET and flat active/trash summaries in `backend/src/services/diagram-service.ts`, `backend/src/services/container-context.ts` and `backend/src/api/diagram-routes.ts`; batch hydration, preserve child own name/subtype/local geometry/creation time, and retain existing PUT immutable-scope guards without manufacturing source-refresh edits.
- [X] T054 [US3] Retain summary kind/scope and full child name/subtype/boundary in `frontend/src/api/diagram-client.ts` and summary construction in `frontend/src/state/diagram-store.ts`; ensure list/save/load all share normalized schemas and summary replacement is keyed by the child's UUID (depends on T053).
- [X] T055 [US3] Verify save response ID, trimmed own name, kind and canonical parent/owner IDs against the captured request before editor/list registration in `frontend/src/state/diagram-store.ts`; retain existing newer-revision guard, drafts and retry intent on mismatch/failure, block overlapping save/navigation, and retry PUT of the same child without generic creation or parent-content replacement (depends on T054).
- [X] T056 [US3] Derive nested library groups in `frontend/src/state/diagram-list.ts` from the full flat summary set keyed by scope.parentDiagramId; filter each own name/date first, count matches only, retain nonmatching parent context for child matches, exclude nonmatching siblings, reuse current comparators/UUID ties, use scope fallback when the parent is absent, and preserve invalid-range behavior (depends on T055).
- [X] T057 [US3] Render nested native lists and contextual parent headings in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/components/saved-diagram-list.css`; show child own name/Container diagram/owner/parent in accessible open/delete actions, indicate unavailable parents without promoting children, and retain counts, selection, last-saved feedback, no-results and DESIGN.md styles (depends on T056).
- [X] T058 [US3] Extend the T025 coordinator across parent/library/new-diagram/external-source navigation in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/DiagramSwitchDialog.tsx`, `frontend/src/components/DiagramToolbar.tsx`, `frontend/src/state/diagram-store.ts` and `frontend/src/state/adr-store.ts`; apply T055 to Save-before-navigation, guard both drafts, retain failed intent, re-guard changes during load, show child own name separately from owner, and return using persisted scope.parentDiagramId with owner highlight/heading focus (depends on T057).
- [X] T059 [US3] Separate source context from local edits/history in `frontend/src/state/diagram-store.ts` and `frontend/src/components/WorkspaceInspector.tsx`; refresh owner/external display names without altering child own name/kind/scope/subtype/geometry/IDs, and provide guarded parent navigation to edit read-only source details (depends on T058).
- [X] T060 [US3] Extend response parsing and flat listing in `cli/src/api-client.ts`, `cli/src/diagrams-command.ts`, `cli/tests/api-client.test.ts` and `cli/tests/diagrams-command.test.ts` to retain child own name/kind/scope/subtype with legacy compatibility; verify T048–T052 and SC-010 across save/reopen entry points (depends on T059).

**Checkpoint**: One named child stays under its original parent across every save/load entry point, filtering keeps parent context without inflating matches, and failed saves preserve work. No list API or save endpoint is added.

## Phase 6: User Story 4 — Preserve Decisions and Recoverable Data (Priority: P2)

**Goal**: Keep ADR references, block unsupported source reclassification with occurrence-specific feedback, offer confirmed parent-batch recovery when restoration starts from a child, and export a complete validated single-diagram artifact.

**Independent Test**: Link ADRs to a container and relationship, rename/move/save/reopen, and attempt protected removal/type changes through UI and whole-document PUT. Reject unsupported source changes with active and recoverable occurrences, identify their child/source/occurrence IDs, and verify saved source, relationships and ADR links remain unchanged. Independently trash one child, then trash its parent and initiate restore from an affected child: preview the parent and exact batch, cancel without mutation, then confirm and restore only that batch. Repeat from the earlier independently trashed child: restore the parent batch first, keep that child trashed, then offer its separate explicit restoration. Exercise stale batch identity and failed loading after successful recovery. Inspect populated/empty exports, offline ADR links, source refresh, and unsupported-content failures.

### Tests for User Story 4

- [ ] T061 [P] [US4] Add dependency endpoint and PUT/DELETE safeguard contract cases in `backend/tests/contract/container-dependencies.test.ts` for active/trashed owning children, unsupported source reclassification with active and recoverable occurrences, and allowed Person/Software System changes unless owner protection applies. Assert DIAGRAM_DEPENDENCY includes child ID/name/status, sourceComponentId, occurrence componentId and explicit removal nextAction despite duplicate names; compare saved source/occurrence/relationship/ADR data before and after rejection, and retain ADR-linked local removal safeguards.
- [ ] T062 [P] [US4] Add child ADR lifecycle/link/replacement/activity contract cases in `backend/tests/contract/container-adrs.test.ts` proving stable local container/occurrence/relationship targets, no inherited parent links, retained replacement rules, and rejected boundary or inactive-graph writes.
- [ ] T063 [P] [US4] Add trash-impact/DELETE and restore-impact/POST cases in `backend/tests/contract/container-recovery.test.ts` for confirmed DELETE 204, bodyless legacy operations, TRASH_IMPACT_CHANGED and RESTORE_REQUIRED. Cover read-only child-requested canonical parent preview with exact named IDs, nullable trashBatchId and requestedDiagramIncluded; confirmed root POST with confirmedDiagramIds/confirmedTrashBatchId returns the parent document, excludes earlier independent children, and permits their separate restore afterward. Assert typed PARENT_INACTIVE with restoreRootDiagramId, RESTORE_CONFIRMATION_REQUIRED, RESTORE_IMPACT_CHANGED for changed IDs or identical IDs with a later batch, malformed-body validation, broken-reference rollback and artifact preservation.
- [ ] T064 [P] [US4] Add real PostgreSQL trash/restore provenance and memory rollback/snapshot cases in `backend/tests/persistence/container-recovery.test.ts`: exact parent-batch recovery, earlier-independent-child exclusion, same-ID retrash with old batch confirmation rejected, broken owner/source rollback, and unchanged UUIDs/creation times/content/layout/ADR links. Cover source deletion/unsupported retyping versus occurrence creation/removal, including recoverable occurrences; restore versus source writes, parent trash and competing restores; changed trash impact versus creation; and ADR writes versus trash. Preserve server-only memory provenance through rollback and coordinate competing transactions deterministically rather than timing sleeps.
- [ ] T065 [P] [US4] Add child/trash-list/owner Restore cases in `frontend/tests/container-diagram-recovery.test.tsx` for named parent-batch preview, cancellation with no POST or trash-state changes, exact root request body, changed set/batch reconfirmation, PARENT_INACTIVE parent offer, and full active/trash list reconciliation. Cover requestedDiagramIncluded false with a separate later child confirmation, dirty child/ADR guards, focus/current-work preservation, stale responses, and successful root restoration followed by failed requested-child load without repeating restore or claiming an excluded child was restored. Verify active/recoverable source blockers explain occurrence removal and preserve rejected drafts/links.
- [ ] T066 [P] [US4] Add validated Mermaid/SVG/HTML content/escaping/empty-child/offline-link/package-compatibility cases in `shared/tests/container-export.test.ts`, covering Application/Datastore labels and containerType, child own-name/canonical scope, missing/unsupported subtype rejection, every new label, long/multiline/Unicode content, unsupported controls/roles/references, source IDs, visible boundary, protocol, and parent single-diagram scope notes.
- [ ] T067 [P] [US4] Add immutable unsaved child/ADR draft and changed-subtype capture, fresh-context overlay that retains own name/scope/containerType, pending local source additions, source-fetch failure, scope mismatch, and editor-retention cases in `frontend/tests/container-html-export.test.tsx`.
- [ ] T068 [P] [US4] Add saved-only container export, both subtype round trips and labels, own-name/canonical-scope retention, unsaved browser-versus-saved CLI subtype comparison, field retention, invalid-context/no-file failure, empty-child HTML success, and general-package regressions in `cli/tests/container-export-command.test.ts` and `backend/tests/container-export.test.ts`.
- [ ] T069 [US4] Extend `e2e/tests/container-diagrams.spec.ts` before recovery/export implementation with ADR lifecycle/linking, unsupported source retype rejection in active/recoverable children and actionable occurrence feedback, protected removals, and child-initiated parent-batch restoration through trash-list and owner entry actions. Verify named confirmation/cancel, exact batch recovery, earlier-independent-child exclusion and separate restore, fresh confirmation after stale impact, full list refresh, keyboard focus and affected unsaved child/ADR guards; retain offline HTML/Mermaid checks with both subtype labels and child own name/scope.

### Implementation for User Story 4

- [ ] T070 [US4] Extend the existing transactional source guard in `backend/src/services/diagram-service.ts` to report each dependent active/recoverable occurrence's componentId/sourceComponentId and child ID/name/status with explicit removal guidance for unsupported source reclassification. Preserve source/occurrence/relationship/ADR data, allow otherwise valid Person/Software System changes, and retain stricter owner protection. Surface DIAGRAM_DEPENDENCY and existing ADR/relationship/group blockers through `backend/src/api/diagram-routes.ts`, `frontend/src/api/diagram-client.ts`, `frontend/src/components/WorkspaceInspector.tsx`, and `frontend/src/state/diagram-store.ts`; explain restoration before editing recoverable occurrences without dropping drafts, links or content.
- [ ] T071 [US4] Integrate container/external/relationship targets with existing ADR picker, summaries, counts, lifecycle, and undo context in `frontend/src/components/AdrLinkPicker.tsx`, `frontend/src/components/ComponentAdrSummary.tsx`, `frontend/src/components/RelationshipAdrSummary.tsx`, and `frontend/src/state/adr-store.ts`; keep links local and stable, exclude the synthetic boundary, and retain parent ADR isolation.
- [ ] T072 [US4] Implement locked trash-impact enumeration and batch trash in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`: recheck the confirmed root/active-child ID set, write fresh common batch/root provenance only to those rows, retain previously trashed child markers, and roll back changed-impact/failure cases.
- [ ] T073 [US4] Implement read-only restore-impact enumeration and exact restoration in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`: a child with a trashed parent previews that parent's root/batch, returns named IDs/batch identity/requestedDiagramIncluded, and excludes earlier independent children. Root restore rechecks confirmedDiagramIds/confirmedTrashBatchId under the parent-first graph lock, rejects stale impact or missing multi-diagram confirmation, validates the entire post-restore graph, preserves artifact data and clears only restored provenance. Direct child restore requires an active parent and valid sources; return PARENT_INACTIVE with root ID otherwise. Keep server-only memory provenance in rollback snapshots and support legacy single-row null provenance (depends on T072).
- [ ] T074 [US4] Define restore-impact and confirmation request shapes in `shared/src/domain/types.ts`, `shared/src/validation/schemas.ts` and `shared/src/index.ts`, then wire GET restore-impact and root POST restore in `backend/src/api/recovery-routes.ts` with typed serialization from `backend/src/api/errors.ts`. Match OpenAPI 1.2.0 requested/root IDs, nullable batch, affected IDs/summaries and inclusion flag; require both confirmation fields when a body is supplied, return the restored root document, and preserve RESTORE_IMPACT_CHANGED/RESTORE_CONFIRMATION_REQUIRED/PARENT_INACTIVE root metadata. Retain trash-impact, DELETE 204 and legacy bodyless single-row operations in `backend/src/api/diagram-routes.ts`; reject malformed requests without mutation (depends on T073).
- [ ] T075 [US4] Add validated restore-impact calls and root restore confirmation bodies to `frontend/src/api/diagram-client.ts`, preserving typed root/stale-impact metadata. Reconcile `frontend/src/state/diagram-store.ts` after success by refreshing every affected active/trash summary and nested parent group by UUID, clearing deletion filters, and distinguishing the returned root document from the originally requested child. Preserve retry/error state and current drafts; exit/reset an affected editor/ADR only after successful mutation, and never register an excluded child as restored (depends on T074).
- [ ] T076 [US4] Coordinate named trash/restore-impact confirmations across `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/SavedDiagramList.tsx`, `frontend/src/components/RecoveryControls.tsx`, and `frontend/src/components/DiagramDeletionUnsavedDialog.tsx`. A child request with a trashed parent offers the exact parent batch, submits its confirmed IDs/batch to the root, and issues no mutation on cancellation. Explain requestedDiagramIncluded false and offer a separately confirmed child restore only after parent recovery. Re-preview/reconfirm changed impact; protect current child/ADR drafts and focus, and distinguish successful recovery from a subsequent load failure (depends on T075).
- [ ] T077 [US4] Wire native Restore container diagram, double-click and trash-list recovery to the T076 coordinator in `frontend/src/components/WorkspaceInspector.tsx`, `frontend/src/components/DiagramWorkspace.tsx`, and `frontend/src/components/DiagramCanvas.tsx`. Use canonical child/root identities, refresh both lists, and load the requested child through existing dirty-work/stale-response guards only after it is active. Retain the independent-child follow-up offer, never create a replacement or load an excluded child, and retry failed loading without replaying a successful restore (depends on T076).
- [ ] T078 [US4] Extend `shared/src/export/mermaid-export.ts` for validated populated child scope/source comments, escaped full multiline Application/Datastore labels from validated containerType and complete container metadata, labeled system subgraph, external nodes/relationships after its end, and protocol; return actionable EMPTY_CONTAINER_MERMAID for empty children and add a parent single-diagram/unbundled-child scope note without dummy nodes.
- [ ] T079 [US4] Extend `shared/src/export/svg-layout.ts` and `shared/src/export/svg-export.ts` for empty/populated system boundaries, child own name/canonical scope, current owner/source metadata and Application/Datastore labels from validated containerType, wrapped full responsibilities/technology/protocol, stable artifact data IDs, accessible scope text, and a viewBox covering every boundary/node/relationship label; preserve general/group rendering (depends on T078).
- [ ] T080 [US4] Extend `shared/src/export/html-snapshot.ts`, `shared/src/export/diagram-page.ts`, `shared/src/export/styles.ts`, and `shared/src/export/html-package.ts` to retain child own name, canonical scope, containerType and all source fields, printable full details with Application/Datastore labels, empty-state boundary, stable local ADR anchors, and explicit single-diagram scope; keep existing ZIP paths/offline links and replace general-only internal type rejection with role-aware validation and reject missing/unsupported subtype or other unsupported content before file generation (depends on T079).
- [ ] T081 [US4] Integrate immutable browser draft/ADR capture and fresh same-scope container-context resolution in `frontend/src/components/ExportButton.tsx` and `frontend/src/api/export-client.ts` using `frontend/src/api/diagram-client.ts`; overlay only authoritative source display fields without replacing child own name/scope/subtype, validate references including unsaved new occurrences, and preserve draft/view with no download on failure (depends on T080).
- [ ] T082 [US4] Integrate saved resolved child documents/ADRs into `cli/src/api-client.ts` and `cli/src/export-command.ts`, preserving child own name/canonical scope/containerType and every new field plus existing overwrite/error behavior; generate the existing complete HTML ZIP without recursive parent/child packages or live-app links (depends on T080).
- [ ] T083 [US4] Use consistent source-resolved documents in `backend/src/services/export-service.ts` and `backend/src/api/export-routes.ts`, sharing `backend/src/services/container-context.ts`; reject inactive/broken graphs and map empty-child Mermaid to 422 EMPTY_CONTAINER_MERMAID before producing files (depends on T078).
- [ ] T084 [US4] Complete DESIGN.md styling, visible focus, readable diagram-level/type labels, native Create/Open/Restore controls, live progress/errors, accessible boundary description, and non-nested ADR interactions in `frontend/src/styles.css`, `frontend/src/components/recovery.css`, `frontend/src/components/ContainerBoundaryNode.tsx`, and `frontend/src/components/ComponentNode.tsx`; verify T061–T069 and keyboard recovery/export feedback after all US4 integrations.

**Checkpoint**: ADR references, dependency safeguards, exact recoverability, and complete supported exports work with all four stories and existing diagrams.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Establish implementation evidence and compatibility across the complete feature.

- [ ] T085 [P] Add the 100-container/100-external/300-relationship validation/layout/export envelope and general-diagram baseline comparison in `shared/tests/container-scale.test.ts` and `e2e/tests/performance.spec.ts`; record timing and batched-resolution behavior in `specs/009-c4-container-diagrams/validation.md` without introducing a product limit or per-source lookup loop.
- [ ] T086 [P] Update `README.md` and `specs/009-c4-container-diagrams/quickstart.md` for preserved 0005 and forward 0006, application-only compatibility backfill/deployment order, exactly-two-choice editing, stale form reset, both entry points, source editing, canonical child save/retry, nested library filters/counts and navigation. Document active/recoverable occurrence blockers and explicit removal, restore-impact root/batch confirmation, stale preview retry, earlier-independent-child exclusion/separate restore, browser-draft versus saved CLI exports and empty Mermaid alternatives; keep examples aligned with implemented OpenAPI 1.2.0 behavior.
- [ ] T087 Run `npm.cmd run build` and `npm.cmd test` from `package.json` with a dedicated DATABASE_URL and RUN_POSTGRES_TESTS enabled; verify clean installation through 0006 and populated 0005-to-0006 upgrade, subtype round trips, active/recoverable source-type protection, occurrence blocker identities and artifact preservation, restore-impact/confirmation contracts, stale set/batch rejection and whole-batch rollback. Require real PostgreSQL races to execute without skips and existing general/group/ADR/CLI/export compatibility to pass; fix failures and record results in `specs/009-c4-container-diagrams/validation.md`.
- [ ] T088 Run the feature browser suite in `e2e/tests/container-diagrams.spec.ts` plus affected saved-diagram, grouping, ADR, recovery and HTML-portability workflows in `e2e/tests/`; rerun the previously inconclusive combined entry suite and cover SC-009 subtype/navigation and SC-010 repeated-save/list/failure cases. Verify clarified FR-015/FR-017 occurrence feedback, child-initiated parent confirmation/cancel, earlier-independent-child separate restore, stale preview retry and full list reconciliation. Complete the keyboard-only select/create/edit/connect/save/return journey and focus/error checks; fix failures and record outcomes in `specs/009-c4-container-diagrams/validation.md` (depends on T087).
- [ ] T089 Perform observed SC-001 creation, SC-003 modeling, and SC-004 readability checks using prepared architecture information in `specs/009-c4-container-diagrams/quickstart.md`; record participant counts, observed times, success rates, and errors against the 90%/30-second, five-minute, and 90%/one-minute targets in `specs/009-c4-container-diagrams/validation.md`, and inspect exported SVG/HTML/ADR links offline (depends on T088).
- [ ] T090 Reconcile FR-001–FR-024 and SC-001–SC-010 evidence in `specs/009-c4-container-diagrams/validation.md` against `specs/009-c4-container-diagrams/plan.md` and `specs/009-c4-container-diagrams/contracts/`; require new evidence for subtype/save/list gates and clarified FR-015/FR-017 source preservation and confirmed parent-batch recovery. Confirm unchanged identities/creation times, no unsupported export omission/placeholders and accurate completion in `specs/009-c4-container-diagrams/tasks.md`; leave unexecuted/failed gates explicitly outstanding (depends on T085–T089).

## Dependencies & Execution Order

### Phase dependencies

```text
Setup (T001–T003, completed)
  -> Foundation (T004–T016, completed)
      -> US1 (T017–T028, completed): canonical entry + empty child
          -> US2 (T029–T047): subtype migration + useful editing
              -> US3 (T048–T060): canonical save + nested library/navigation
                  -> US4 (T061–T084): source protection + confirmed exact recovery + exports
                      -> Polish (T085–T090): full release evidence
```

- Default execution follows numeric phase order. Existing checked tasks retain their prior scope/evidence; new work starts at T029. Do not apply 0006 as part of task generation.
- US1 depends on Foundation. Its external-source cases use prepared occurrences, and its completed empty-child milestone remains the suggested MVP demonstration.
- US2 depends on the US1 session/API/boundary and shared foundation. T029–T041 add subtype support to those established boundaries before later stories consume revised schemas. Deploy 0006 before runtime schemas requiring subtype; never rewrite applied 0005.
- US3 depends on US1 navigation and US2 schemas/serialization. Its independent test uses prepared populated children; hierarchy derives from canonical saved scope, never the latest navigation origin.
- US4 depends on Foundation graph/ADR guards, US1 navigation, US2 subtype/editor content and US3 save/list/dirty guards. Its independent test can use saved fixtures; integrated recovery/export acceptance waits for those prior surfaces.
- Release validation waits for all stories. A fixture-driven independent test does not allow simultaneous edits to shared stores/services/UI files or waive earlier-story dependencies.

### Within each phase/story

- Author each listed test batch first and confirm meaningful failures before its implementation. Existing foundation ordering remains T007 -> T008/T009 -> T010 -> T011 -> T012 -> T013 -> T014 -> T015 -> T016.
- US1 ordering remains T022 -> T023 -> T024 -> T025 -> T026 -> T027 -> T028; historical checkboxes and validation are unchanged.
- US2 tests T029–T034 are disjoint-file authoring work; T035 adds to the shared browser file sequentially. Then T036 domain/fixtures -> T037 migration/schema -> T038 mapping -> T039 store/history -> T040 validation -> T041 browser serialization -> T042 geometry -> T043 labels -> T044 forms -> T045 reset -> T046 sources -> T047 interactions.
- US3 tests T048–T051 are disjoint-file authoring work; T052 browser additions stay sequential. Then T053 resolution -> T054 parsing/summary -> T055 save checks -> T056 projection -> T057 nested UI -> T058 navigation -> T059 source context -> T060 CLI compatibility.
- US4 test authoring T061–T068 precedes implementation; T069 browser additions remain sequential. T061 validates occurrence-specific source protection before T070; T063–T065 define preview/confirmation, rollback/races and UI behavior before T072–T077. Dependency/ADR surfaces T070/T071 extend existing safeguards without reopening completed foundation tasks. Recovery chain: T072 provenance/trash -> T073 preview/locked restore -> T074 shared contracts/routes -> T075 client/list reconciliation -> T076 confirmation/dirty-work coordinator -> T077 owner/double-click integration.
- US4 export chain: T078 Mermaid -> T079 SVG -> T080 HTML. Browser T081 and CLI T082 follow T080; backend T083 follows T078 and source resolution. Complete all integrated surfaces before T084 accessibility/checkpoint validation.
- Polish T085 and T086 use disjoint files. T087 follows all implementation; T088 follows T087; T089 follows T088; T090 reconciles evidence after T085–T089.
- Run PostgreSQL-writing tests serially against shared fixtures or use isolated schemas/databases. Test `[P]` markers allow independent authoring, not simultaneous destructive fixture setup in one database.
- T085 owns `specs/009-c4-container-diagrams/validation.md` during its batch; later evidence tasks append sequentially.

### Parallel opportunities

- Completed foundation test authoring: T004–T006; completed US1 test authoring: T017–T021.
- Remaining US2 test authoring: T029–T034 after US1. Tests must not mutate shared fixtures until the sequential T036 fixture update.
- Remaining US3 test authoring: T048–T051 after US2 interfaces are stable.
- Remaining US4 test authoring: T061–T068 after preceding interfaces are stable.
- Final performance/evidence authoring T085 and documentation T086 are disjoint.
- These 28 marked tasks include 8 already completed and 20 outstanding. Implementation remains sequential because it shares domain, repository, store, inspector and export surfaces.

## Parallel Example: User Story 1

Historical disjoint authoring batch after Foundation:

```text
T017: backend/tests/contract/container-diagrams.test.ts
T018: backend/tests/persistence/container-diagrams.test.ts
T019: frontend/tests/container-diagram-entry-store.test.ts
T020: frontend/tests/container-diagram-entry-ui.test.tsx
T021: e2e/tests/container-diagrams.spec.ts (US1 cases)
```

## Parallel Example: User Story 2

After US1, author separate test files before changing the shared fixtures:

```text
T029: shared/tests/container-diagrams.test.ts + shared/tests/compatibility.test.ts
T030: backend/tests/persistence/container-migration.test.ts
T031: backend/tests/contract/container-editing.test.ts + backend/tests/persistence/container-editing.test.ts
T032: frontend/tests/container-diagram-store.test.ts
T033: frontend/tests/react-flow-container.test.ts
T034: frontend/tests/container-diagram-ui.test.tsx
```

T035 uses the feature browser file and remains sequential; T036–T047 then integrate in dependency order.

## Parallel Example: User Story 3

After US2 interfaces are stable:

```text
T048: backend/tests/contract/container-navigation.test.ts
T049: frontend/tests/container-diagram-navigation.test.tsx
T050: frontend/tests/diagram-list.test.ts
T051: frontend/tests/saved-diagram-list.test.tsx
```

T052 uses the feature browser file and remains sequential.

## Parallel Example: User Story 4

After preceding phase interfaces are stable, representative disjoint authoring tasks:

```text
T061: backend/tests/contract/container-dependencies.test.ts
T063: backend/tests/contract/container-recovery.test.ts
T065: frontend/tests/container-diagram-recovery.test.tsx
T066: shared/tests/container-export.test.ts
T067: frontend/tests/container-html-export.test.tsx
T068: cli/tests/container-export-command.test.ts + backend/tests/container-export.test.ts
```

T062 and T064 have additional disjoint ADR/database test files; T069 browser additions remain sequential.

## Requirement Coverage

| Requirement group | Implementation tasks | Principal validation tasks |
| --- | --- | --- |
| FR-001–FR-005: entry, canonical identity, eligibility, persisted owner, retry | T011–T013, T022–T028 | T017–T021, T088 |
| FR-006–FR-009, FR-022: roles, metadata, boundary, sources, placement/endpoints | T007–T012, T026, T036–T047 | T004–T006, T029–T035 |
| FR-007, FR-024, SC-009: exactly Application/Datastore, subtype retention, form reset, forbidden commands | T036–T045, T078–T083 | T029–T035, T066–T069, T087–T088 |
| FR-010–FR-013: guarded navigation, scope/layout/history, saved reopening | T010–T012, T025, T039–T042, T053–T060 | T019, T032–T033, T048–T052 |
| FR-011, FR-023, SC-010: own child name/ID/kind/scope, repeated PUT/retry, nested library/filter counts | T039, T041–T042, T053–T059 | T033, T048–T052, T088 |
| FR-014–FR-018: decisions, safeguards, exact recovery and confirmed removal | T013–T015, T070–T077 | T016, T061–T065, T069 |
| FR-015, clarification 2026-10-02: unsupported source retyping blocked for active/recoverable occurrences; actionable IDs and no artifact/link changes | T070 | T061, T064–T065, T069, T087–T088, T090 |
| FR-016–FR-017, clarification 2026-10-02: child-requested parent-batch confirmation, cancellation, stale batch safety and separate earlier-independent-child restore | T072–T077 | T063–T065, T069, T087–T088, T090 |
| FR-019: complete supported exports, subtype labels, explicit unsupported cases, single-diagram scope | T078–T083 | T066–T069, T089 |
| FR-020: legacy/general/group compatibility and 0005-to-0006 upgrade | T002, T007, T009–T010, T036–T038, T060, T078–T083 | T004, T006, T029–T031, T068, T087–T088 |
| FR-021: keyboard/focus, readable scope/type and progress/errors | T027–T028, T042–T047, T055–T059, T070–T077, T084 | T020–T021, T033–T035, T049–T052, T065, T069, T088–T089 |
| SC-001–SC-004: timed creation/modeling/readability and canonical identity | T022–T028, T036–T047 | T017–T021, T035, T089 |
| SC-005–SC-006: stable links and actionable no-loss failures | T010–T015, T025, T036–T041, T053–T059, T070–T083 | T016–T019, T029–T033, T048–T052, T061–T069, T087–T088 |
| SC-007–SC-008: keyboard journey and existing-diagram compatibility | T007–T010, T027–T028, T036–T047, T053–T060, T084 | T004, T006, T021, T029–T035, T048–T052, T068, T087–T088 |
| SC-009–SC-010: revised subtype choices and child save/list placement | T036–T060, T078–T083 | T029–T035, T048–T052, T066–T069, T087–T090 |

## Task Summary

| Phase/story | Total | Complete | Outstanding |
| --- | ---: | ---: | ---: |
| Setup | 3 | 3 | 0 |
| Foundation | 13 | 13 | 0 |
| US1 (P1) | 12 | 12 | 0 |
| US2 (P1) | 19 | 19 | 0 |
| US3 (P2) | 13 | 0 | 13 |
| US4 (P2) | 24 | 0 | 24 |
| Polish | 6 | 0 | 6 |
| **Total** | **90** | **47** | **43** |

## Implementation Strategy

### MVP First (User Story 1)

1. Preserve completed Setup/Foundation/US1 and their recorded database and contract checks.
2. US1 remains the first demo milestone: saved Software System -> Create/Open -> same empty labeled child with parent-save/retry safeguards.
3. The nine current entry/authoring browser scenarios pass together; extend and rerun the complete feature suite in T088 after later stories.
4. Continue at US3 for the revised behavior. Complete all stories/release gates before treating recovery, exports or SC-010 as delivered.

### Incremental Delivery

1. US2 extends established storage/domain boundaries with subtype and forward migration, then delivers exactly-two-choice authoring, source inclusion, geometry and history.
2. US3 preserves canonical child save identity and adds nested library/filter projection and guarded contextual navigation.
3. US4 completes linked decisions, occurrence-specific source protection, confirmed child-initiated parent-batch recovery and complete subtype-aware exports.
4. Polish records database/browser/export results and observed usability outcomes; each checkpoint runs affected earlier acceptance checks. Leave unavailable, failed or skipped evidence outstanding.

### Coordinated Parallel Work

Use the listed disjoint test-authoring batches and performance/documentation pair. Integrate shared implementation files sequentially. Shared PostgreSQL fixtures and `e2e/tests/container-diagrams.spec.ts` require coordinated ownership; these examples describe implementation opportunities, not permission to start agents during task generation.

## Notes

- Keep React Flow as a visual adapter; exports/persistence consume validated domain data.
- Preserve applied 0005. Only 0006 backfills existing generic internal subtype to application; new writes and exporters must not invent a missing subtype. Retain legacy type, UUIDs, timestamps, content, layout and links.
- Do not widen parent C4/source helpers to Application/Datastore. Internal subtype changes keep role/type container and all artifact references.
- Child scope is persisted canonical identity. Names, source refresh, latest navigation origin and library grouping never reassign it or substitute Parent Diagram for the child's own name.
- Parent headings retained for child filter matches are context, not additional matching diagrams. An absent parent summary never promotes a child to a top-level parent.
- Boundary fitting/displaced externals belong to the same edit snapshot; invalid edits create no partial artifacts/history.
- A trashed child reserves ownership and requires explicit restore. Previously trashed children do not join a later parent restore batch.
- Child-requested recovery with a trashed parent previews and confirms the parent's exact batch first. An earlier independently trashed requested child stays trashed until separately confirmed afterward; a restored root response is not a child response. Recheck both IDs and batch identity under lock, and preserve work/focus on cancel or failure.
- Unsupported source reclassification cannot bypass active or recoverable occurrence dependencies. Identify the exact child/source/occurrence IDs and require explicit occurrence removal through existing relationship/ADR safeguards; never silently unlink or cascade-delete. These decisions reuse 0005 provenance and require no additional recovery migration.
- Do not introduce auth, collaboration, deeper C4 levels, permanent deletion, ownership detachment, recursive packages, a new import workflow or revision-history subsystem.
- Keep T001–T028 completion flags/evidence unchanged. T029–T047 now have phase 4 implementation/validation evidence; T048–T090 remain unchecked until their implementation and required validation exist.
