# Tasks: C4 Container Diagrams

**Input**: Design documents from `specs/009-c4-container-diagrams/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [contracts/ui-contract.md](./contracts/ui-contract.md), [contracts/export-contract.md](./contracts/export-contract.md), [quickstart.md](./quickstart.md), `.specify/memory/constitution.md`, and `DESIGN.md`.

**Tests**: Required by the specification's implementation-validation assumption and the constitution's artifact-boundary gate. Author the dedicated test batches before their corresponding implementation and confirm that the new behavior fails for the intended reason; T016 additionally checks the integrated foundation. Keep existing fixtures compatible. Real PostgreSQL checks must execute without skips for release validation; memory repositories do not prove concurrency.

**Organization**: Setup, shared foundations, four user-story increments in specification priority order, then cross-cutting validation. This is an existing application: retain its stack, migrations, package format, general diagrams, groups, and ADR workflows.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means tasks can run concurrently with other marked tasks in the same stated batch, in different files, after their prerequisites are complete. It does not waive phase dependencies.
- `[US1]` through `[US4]` map to the four stories in `spec.md`.
- Paths are relative to the repository root. New paths are explicitly named; other paths refer to existing implementation/test surfaces.
- Availability, request progress, and source context are transient session state, outside diagram history. Scope IDs, component/occurrence IDs, relationship endpoints, and ADR links are domain identities.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repeatable fixtures and validation using the existing project, without adding runtime dependencies.

- [ ] T001 Add reusable general-parent, empty/populated-child, duplicate-name, grouped-owner, external-source, and legacy-payload fixtures with stable UUIDs in `shared/tests/container-fixtures.ts`, preserving existing fixtures in `shared/tests/html-export-fixtures.ts`.
- [ ] T002 Adapt PostgreSQL fixture cleanup to remove child ADR links, child relationships/occurrences, child diagrams, then parent/source rows without violating the planned restrictive FKs in `backend/tests/fixtures.ts`, `backend/tests/persistence/diagram-repository.test.ts`, `backend/tests/persistence/system-groups.test.ts`, and `backend/tests/acceptance/adr-postgres-quickstart.test.ts`; preserve test isolation and existing gates.
- [ ] T003 Record the current build/test results, database/browser prerequisites, and general-diagram interaction baseline in `specs/009-c4-container-diagrams/validation.md` using `package.json`, `e2e/tests/performance.spec.ts`, and `specs/009-c4-container-diagrams/quickstart.md`; distinguish executed, failed, and skipped checks and retain the existing lockfile/dependencies.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the domain, storage, source resolution, and data-protection boundaries that every story needs.

**Critical**: Complete this phase before user-story implementation. Tests T004–T006 can be authored together after Setup; implementation tasks then follow their declared dependencies.

### Foundation tests

- [ ] T004 [P] Add structural/invariant and legacy-normalization cases in `shared/tests/container-diagrams.test.ts` and `shared/tests/compatibility.test.ts` for diagram kinds/scopes, roles, required trimmed text, UUIDs, finite geometry, directed/nonblank child relationships, endpoint rules, empty child groups, unknown feature fields, and unchanged legacy free-form types.
- [ ] T005 [P] Add deterministic empty/fitted-boundary, 24-unit clearance, 44-unit header, minimum-size, UUID-ordered external displacement, collision, fractional-coordinate, and rejected direct-placement cases in `shared/tests/container-layout.test.ts` using `specs/009-c4-container-diagrams/data-model.md`.
- [ ] T006 [P] Add dedicated-database migration and round-trip cases in `backend/tests/persistence/container-migration.test.ts` that seed migrations 0001–0004, apply planned 0005, and verify unchanged IDs, creation times, legacy types, groups, relationships, and ADR links plus owner uniqueness across trash, owner-parent membership, source FKs, and duplicate-source constraints.

### Foundation implementation

- [ ] T007 Extend domain types, C4 helpers, structural schemas, invariants, and public exports in `shared/src/domain/types.ts`, `shared/src/domain/c4.ts`, `shared/src/domain/invariants.ts`, `shared/src/validation/schemas.ts`, and `shared/src/index.ts` with kind/scope/boundary, element/container/external roles, technology/protocol, source IDs, resolved summaries, and availability/context/blocker shapes; normalize omitted fields only for general/legacy inputs and reject invalid or unknown feature content.
- [ ] T008 Implement pure fitting, containment/clearance checks, deterministic external relocation, and atomic layout-result helpers in `shared/src/domain/container-layout.ts` and export them through `shared/src/index.ts`; implement the exact empty/minimum/padding rules from `specs/009-c4-container-diagrams/data-model.md` without coupling to React Flow (depends on T007).
- [ ] T009 Add `backend/drizzle/0005_c4_container_diagrams.sql` and mirror it in `backend/src/persistence/schema.ts` with kind/ownership/boundary/provenance, roles/source/technology/protocol, restrictive FKs, composite owner-parent membership, all-status owner uniqueness, duplicate external-source prevention, indexes, and role/finite-size checks; use additive general/element defaults without reclassifying existing data (depends on T007).
- [ ] T010 Extend memory and PostgreSQL serialization and ID-preserving document diffs in `backend/src/persistence/diagram-repository.ts` to round-trip all new fields and original creation timestamps, keep server-only trash provenance outside client documents, and expose transaction-aware graph lookup/write interfaces; hydrate cached external display fields before resolved validation (depends on T009).
- [ ] T011 Add `backend/src/persistence/graph-transaction.ts` and integrate it with `backend/src/persistence/diagram-repository.ts` and `backend/src/persistence/adr-repository.ts` so graph writes resolve and lock the canonical general parent first, then affected children in UUID order, reread eligibility/activity/dependencies, and execute checks and mutations on the same transaction; provide equivalent rollback/coordination semantics for memory test repositories (depends on T010).
- [ ] T012 Add batched contextual resolution in `backend/src/services/container-context.ts` for canonical owner/source identities, current source metadata, valid parent membership, eligible picker sources, and consistent read snapshots; share it with `backend/src/services/diagram-service.ts` and reject broken/inactive graphs without copying source layout or parent relationships (depends on T011).
- [ ] T013 Apply previous-versus-incoming document dependency checks inside graph transactions in `backend/src/services/diagram-service.ts` and `backend/src/persistence/diagram-repository.ts`: reject ownership/kind changes, child downgrade through old payloads, status/provenance changes, existing occurrence role/source reassignment, protected owner/source omission or invalid retyping, and omitted ADR-linked artifacts; preserve existing local relationship/group blockers and prevent generic creation from bypassing canonical child ownership (depends on T012).
- [ ] T014 Coordinate every ADR create/update/delete/link/lifecycle write with graph activity and stable local target checks in `backend/src/services/adr-service.ts` and `backend/src/persistence/adr-repository.ts`; keep validation and mutation in the same transaction, preserve replacement/lifecycle rules, and reject boundary targets or writes to inactive child/parent graphs (depends on T013).
- [ ] T015 Extend actionable typed conflict/validation envelopes in `backend/src/api/errors.ts`, `backend/src/api/diagram-routes.ts`, `backend/src/api/adr-routes.ts`, and `backend/src/api/app.ts` to retain existing ADR/local blockers and add diagram blockers, immutable-scope, broken-reference, and inactive-parent errors matching `specs/009-c4-container-diagrams/contracts/openapi.yaml` (depends on T014).
- [ ] T016 Add and run foundation write-boundary contract tests in `backend/tests/contract/container-write-guards.test.ts` and transaction/rollback tests in `backend/tests/persistence/container-graph-transactions.test.ts` for PUT/DELETE bypass attempts, generic-create bypass, invalid source/type/scope changes, parent mutation versus child writes, ADR-linked omissions, and inactive ADR mutations; rerun T004–T006 and ensure real database cases execute after T015.

**Checkpoint**: Shared data is compatible, geometry is deterministic, and graph writes cannot silently detach dependencies. Child workflow endpoints/UI remain story work.

## Phase 3: User Story 1 — Create or Open from a Software System (Priority: P1) — MVP

**Goal**: Both requested entry points create/open one canonical child for the intended Software System, retaining current work on errors.

**Independent Test**: In a saved general diagram with two Software Systems and a Person, double-click the first system and use the selected-system action on the second. Each opens its own empty labeled child; repeating either action returns that same ID. Group membership and duplicate names do not alter ownership. Failure/retry leaves the current diagram intact and creates no duplicate. Exercise source resolution using a prepared child containing an external Software System.

### Tests for User Story 1

- [ ] T017 [P] [US1] Add availability/create-or-open REST contract cases in `backend/tests/contract/container-diagrams.test.ts` for GET without mutation, POST 201 new/200 existing, 409 RESTORE_REQUIRED, ineligible artifacts, source-occurrence canonicalization, membership/path mismatch, inactive parent, empty default boundary/name, and actionable failures.
- [ ] T018 [P] [US1] Add real PostgreSQL concurrent/repeated creation, duplicate-name/grouped-owner, uniqueness-race rollback/winner resolution, creation-versus-owner-change/trash, and failed-creation rollback cases in `backend/tests/persistence/container-diagrams.test.ts`; verify exactly one complete canonical child across active/trash states.
- [ ] T019 [P] [US1] Add request deduplication, successful-parent-save prerequisite, wholly unsaved owner Save/Cancel, discarded unpersisted owner rejection, dirty ADR guarding, stale response, and create-succeeded/load-failed retry cases in `frontend/tests/container-diagram-entry-store.test.ts`.
- [ ] T020 [P] [US1] Add double-click/inspector eligibility, grouped owners, external-source action, availability loading/retry, keyboard button, ordinary click/Shift selection, and empty-boundary/header cases in `frontend/tests/container-diagram-entry-ui.test.tsx`.
- [ ] T021 [P] [US1] Add browser entry-point/identity/failure scenarios in `e2e/tests/container-diagrams.spec.ts` for two owners, duplicate labels, grouped owners, Person/group rejection, repeated activation, unsaved parent, keyboard action, and retry; prepare source-occurrence navigation fixtures without requiring US2 authoring UI.

### Implementation for User Story 1

- [ ] T022 [US1] Implement atomic canonical create-or-open in `backend/src/persistence/diagram-repository.ts` using `backend/src/persistence/graph-transaction.ts`, all-status owner uniqueness, and complete empty-child insertion; return existing active children, preserve trashed ones, and roll back uniqueness conflicts before resolving the winner in a fresh transaction.
- [ ] T023 [US1] Implement canonical eligibility, read-only availability, create-or-open, and container-context endpoints in `backend/src/services/diagram-service.ts`, `backend/src/services/container-context.ts`, and new `backend/src/api/container-diagram-routes.ts`, registered in `backend/src/api/app.ts`; match the feature contract's status codes and source-occurrence resolution (depends on T022).
- [ ] T024 [US1] Add validated availability/create-or-open/context calls and typed error parsing in `frontend/src/api/diagram-client.ts`, preserving normalized kind/scope/role/source fields and RESTORE_REQUIRED child summaries rather than stripping feature content (depends on T023).
- [ ] T025 [US1] Implement one guarded create/open navigation intent in `frontend/src/state/diagram-store.ts` and `frontend/src/components/DiagramWorkspace.tsx`, coordinating `frontend/src/state/adr-store.ts` and `frontend/src/components/DiagramSwitchDialog.tsx`: deduplicate requests, save required parent/ADR drafts, recheck persisted owners after discard, commit only validated loaded data, retain retry intent on failure, and reset history/selection/ADR context only on success (depends on T024).
- [ ] T026 [US1] Add `frontend/src/components/ContainerBoundaryNode.tsx` and adapt `frontend/src/adapters/react-flow/diagram-adapter.ts` and `frontend/src/components/DiagramCanvas.tsx` to render a synthesized, labeled, nonselectable/nonconnectable/nondeletable boundary behind components, including empty children; exclude it from domain conversion, ADR targets, and relationship endpoints.
- [ ] T027 [US1] Wire Software System double-click and native selected/viewed-system Create/Open actions in `frontend/src/components/DiagramCanvas.tsx` and `frontend/src/components/WorkspaceInspector.tsx` to T025; retain plain-click/Shift behavior, progress/retry feedback, external-source identity, and a clear restoration-required response without creating a replacement (depends on T026).
- [ ] T028 [US1] Show the Container diagram/current owner heading, empty-child instruction, and DESIGN.md focus/live-feedback styling in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/DiagramToolbar.tsx`, and `frontend/src/styles.css`; verify T017–T021, including saved empty-child reopen (depends on T027).

**Checkpoint**: US1 is demonstrable with saved/empty children and prepared external fixtures. Full Restore entry-point integration is completed in US4; the MVP checkpoint is not a release waiver for recovery or export safety.

## Phase 4: User Story 2 — Describe Containers and Communication (Priority: P1)

**Goal**: Author complete C4 container content with readable metadata, source-linked externals, deterministic geometry, and ordinary undo/redo.

**Independent Test**: Model a web application, service, and data store with responsibilities/technology, directed interactions, and a parent Person and Software System outside the boundary. Move/resize containers, displace an overlapping external, undo/redo, and save/reopen. Check stable IDs, clear errors, readable labels, persistent keyboard geometry, and unchanged parent layout/relationships.

### Tests for User Story 2

- [ ] T029 [P] [US2] Add child save/source-context contract and database round-trip cases in `backend/tests/contract/container-editing.test.ts` and `backend/tests/persistence/container-editing.test.ts` for required metadata/protocol, read-only source projection, owner/duplicate/other-parent/source-chain rejection, invalid external-to-external/boundary endpoints, invalid geometry, and no partial writes.
- [ ] T030 [P] [US2] Add atomic add/edit/move/resize/remove, relationship validation, bounded history, UUID retention, fitted boundary, displaced external, and invalid-command no-dirty/no-history cases in `frontend/tests/container-diagram-store.test.ts`.
- [ ] T031 [P] [US2] Add adapter boundary exclusion, roles/metadata/protocol, absolute positions, and pointer/keyboard geometry round-trip cases in `frontend/tests/react-flow-container.test.ts`.
- [ ] T032 [P] [US2] Add container form, source picker, duplicate-source explanation, read-only external details, directed relationship form, long metadata, and invalid connection feedback cases in `frontend/tests/container-diagram-ui.test.tsx`.
- [ ] T033 [US2] Extend `e2e/tests/container-diagrams.spec.ts` with three-container modeling, parent-source inclusion, optional protocol, keyboard/pointer movement and resizing, external-clearance rejection, boundary displacement with one-step undo/redo, and save/reopen assertions before implementing the corresponding editor behavior.

### Implementation for User Story 2

- [ ] T034 [US2] Add validated container/external/relationship commands in `frontend/src/state/diagram-store.ts` and extend `frontend/src/state/history.ts` so complete metadata, node sizing, fitting, and external displacement commit as one bounded domain snapshot; failed commands leave document/history unchanged, and IDs survive undo/redo.
- [ ] T035 [US2] Complete child edit validation and persistence in `backend/src/services/diagram-service.ts`, `backend/src/services/container-context.ts`, and `backend/src/persistence/diagram-repository.ts`, resolving current eligible sources under the graph transaction, overwriting display caches, retaining local layout, and rejecting invalid incoming geometry instead of repairing it on save.
- [ ] T036 [US2] Route completed pointer drag/resize and keyboard node movement through the same domain command in `frontend/src/components/DiagramCanvas.tsx` and `frontend/src/adapters/react-flow/diagram-adapter.ts`; group pointer gestures, persist keyboard changes, restore rejected external geometry, and keep boundary/ADR focus behavior (depends on T034).
- [ ] T037 [US2] Render wrapped complete Container/Person/Software System metadata and relationship protocol in `frontend/src/components/ComponentNode.tsx`, `frontend/src/components/RelationshipEdge.tsx`, and `frontend/src/styles.css`; grow domain node dimensions when needed before fitting the boundary, preserving accessible badges and avoiding clipped content (depends on T036).
- [ ] T038 [US2] Add atomic Add/Edit container forms and container-specific toolbar/inspector modes in `frontend/src/components/DiagramToolbar.tsx` and `frontend/src/components/WorkspaceInspector.tsx`, requiring name/responsibilities/technology and hiding general-diagram group/type commands in child views (depends on T037).
- [ ] T039 [US2] Add the Include external participant picker and read-only source inspector using fresh context in `frontend/src/components/WorkspaceInspector.tsx` and `frontend/src/state/diagram-store.ts`; exclude the owner, disable already-included sources, distinguish duplicate labels by IDs, and create local occurrence identities/layout without copying parent relationships (depends on T038).
- [ ] T040 [US2] Add directed-only child interaction creation/editing with required description and optional protocol in `frontend/src/components/DiagramCanvas.tsx`, `frontend/src/components/WorkspaceInspector.tsx`, and `frontend/src/state/diagram-store.ts`; reject unsupported connections before persisting an edge and retain existing confirmed removal/blocker behavior; verify T029–T033 (depends on T039).

**Checkpoint**: US2 is independently testable on a prepared child, and the US1 workflow now leads to a useful editable container diagram.

## Phase 5: User Story 3 — Navigate and Continue Without Losing Context (Priority: P2)

**Goal**: Restore saved child content, show current owner/source context, and guard every navigation path against losing diagram or ADR drafts.

**Independent Test**: Save a populated child, return to the parent, rename/move its owner and a source participant, refresh, and reopen through both the owner and library. Verify current source names and unchanged IDs/layout/links. Exercise Save/Discard/Cancel and failed save for dirty diagrams and ADRs through parent, library, and external-system entry points.

### Tests for User Story 3

- [ ] T041 [P] [US3] Add resolved GET/active-list/trash-list/source-refresh contract cases in `backend/tests/contract/container-navigation.test.ts` for duplicate owner names, renamed/reclassified eligible sources, independent child names/layout, stable timestamps/IDs, and broken contextual references.
- [ ] T042 [P] [US3] Add parent/library/external navigation, combined diagram/ADR dirty states, failed-save/cancel retention, edits during loading, out-of-order responses, selection/focus reset, and source refresh outside history cases in `frontend/tests/container-diagram-navigation.test.tsx`.
- [ ] T043 [US3] Extend `e2e/tests/container-diagrams.spec.ts` with populated-child refresh/reopen, library search/filter labels, owner/source rename and regroup/reposition, parent owner highlighting, and Save/Discard/Cancel/failed-save browser scenarios.

### Implementation for User Story 3

- [ ] T044 [US3] Resolve current scope/source details for active and trash summaries and saved child GET in `backend/src/services/diagram-service.ts`, `backend/src/services/container-context.ts`, and `backend/src/api/diagram-routes.ts`; batch hydration, preserve independently editable child names/local geometry, and avoid manufacturing local edits on source rename.
- [ ] T045 [US3] Retain kind/scope summary fields and expose searchable/filterable diagram level, owner, parent, and stable-ID distinctions in `frontend/src/api/diagram-client.ts`, `frontend/src/state/diagram-list.ts`, `frontend/src/components/SavedDiagramList.tsx`, and `frontend/src/components/saved-diagram-list.css` without changing the list-array contract (depends on T044).
- [ ] T046 [US3] Extend the T025 coordinator to all parent, library, new-diagram, and external-source navigation in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/DiagramSwitchDialog.tsx`, `frontend/src/state/diagram-store.ts`, and `frontend/src/state/adr-store.ts`; guard both drafts, retain failed intent, re-guard revision changes during load, and highlight the owner/focus the heading after successful parent return (depends on T045).
- [ ] T047 [US3] Separate fresh source context from local geometry/history in `frontend/src/state/diagram-store.ts` and `frontend/src/components/WorkspaceInspector.tsx`; refresh owner/external names on load/context refresh, preserve dirty local edits and occurrence IDs, and offer guarded parent navigation to edit read-only source details (depends on T046).
- [ ] T048 [US3] Extend shared-response parsing and diagram listing in `cli/src/api-client.ts`, `cli/src/diagrams-command.ts`, `cli/tests/api-client.test.ts`, and `cli/tests/diagrams-command.test.ts` to preserve child kind/scope and owner/parent identity with legacy compatibility; verify T041–T043 and saved reopen across clients (depends on T047).

**Checkpoint**: Navigation and reopening preserve both architecture data and current source context. Stories can be checked independently using saved fixtures; actual navigation shares the US1 coordinator.

## Phase 6: User Story 4 — Preserve Decisions and Recoverable Data (Priority: P2)

**Goal**: Keep ADR references, explain dependency blockers, recover exactly the diagrams affected by trash, and export a complete validated single-diagram artifact.

**Independent Test**: Link ADRs to a container and relationship, rename/move/save/reopen, and attempt protected removal/type changes through UI and whole-document PUT. Independently trash one child, then trash/restore its parent; only the parent's affected batch returns. Restore the independent child explicitly through its owner. Inspect populated/empty exports, offline ADR links, source refresh, and unsupported-content failures.

### Tests for User Story 4

- [ ] T049 [P] [US4] Add dependency endpoint and PUT/DELETE safeguard contract cases in `backend/tests/contract/container-dependencies.test.ts` for active/trashed owning children, recoverable source occurrences, allowed eligible source reclassification, blocked invalid reclassification, ADR-linked local removals, and typed next-action feedback.
- [ ] T050 [P] [US4] Add child ADR lifecycle/link/replacement/activity contract cases in `backend/tests/contract/container-adrs.test.ts` proving stable local container/occurrence/relationship targets, no inherited parent links, retained replacement rules, and rejected boundary or inactive-graph writes.
- [ ] T051 [P] [US4] Add trash-impact, confirmed DELETE 204, bodyless legacy delete, TRASH_IMPACT_CHANGED, independent Restore, RESTORE_REQUIRED, exact parent batch, previous-trash preservation, and failure/rollback contract cases in `backend/tests/contract/container-recovery.test.ts`.
- [ ] T052 [P] [US4] Add real PostgreSQL trash/restore provenance, broken-source rollback, source deletion/retyping versus occurrence writes, changed-impact versus creation, ADR mutation versus parent/child trash, and stable-link recovery cases in `backend/tests/persistence/container-recovery.test.ts`; coordinate competing transactions deterministically rather than relying on timing sleeps.
- [ ] T053 [P] [US4] Add named multi-diagram confirmation, current affected child/ADR dirty guards, cancellation, changed-impact reconfirmation, failed operations, full list reconciliation, Restore entry actions, and dependency feedback cases in `frontend/tests/container-diagram-recovery.test.tsx`.
- [ ] T054 [P] [US4] Add validated Mermaid/SVG/HTML content/escaping/empty-child/offline-link/package-compatibility cases in `shared/tests/container-export.test.ts`, covering every new label, long/multiline/Unicode content, unsupported controls/roles/references, source IDs, visible boundary, protocol, and parent single-diagram scope notes.
- [ ] T055 [P] [US4] Add immutable unsaved child/ADR draft capture, fresh-context overlay, pending local source additions, source-fetch failure, scope mismatch, and editor-retention cases in `frontend/tests/container-html-export.test.tsx`.
- [ ] T056 [P] [US4] Add saved-only container export, field retention, invalid-context/no-file failure, empty-child HTML success, and general-package regressions in `cli/tests/container-export-command.test.ts` and `backend/tests/container-export.test.ts`.
- [ ] T057 [US4] Extend `e2e/tests/container-diagrams.spec.ts` with ADR lifecycle/linking, protected removals/retyping, independently trashed child versus parent cascade/restore, owner Restore through both entry points, affected unsaved child/ADR decisions, and offline HTML/Mermaid outcomes before implementing recovery/export integration.

### Implementation for User Story 4

- [ ] T058 [US4] Surface diagram blockers alongside existing ADR/relationship/group blockers in dependency endpoints and inspector/remove flows in `backend/src/api/diagram-routes.ts`, `frontend/src/api/diagram-client.ts`, `frontend/src/components/WorkspaceInspector.tsx`, and `frontend/src/state/diagram-store.ts`; name affected active/recoverable children or occurrences and supported next actions, and prevent owner retyping without overwriting current drafts.
- [ ] T059 [US4] Integrate container/external/relationship targets with existing ADR picker, summaries, counts, lifecycle, and undo context in `frontend/src/components/AdrLinkPicker.tsx`, `frontend/src/components/ComponentAdrSummary.tsx`, `frontend/src/components/RelationshipAdrSummary.tsx`, and `frontend/src/state/adr-store.ts`; keep links local and stable, exclude the synthetic boundary, and retain parent ADR isolation.
- [ ] T060 [US4] Implement locked trash-impact enumeration and batch trash in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`: recheck the confirmed root/active-child ID set, write fresh common batch/root provenance only to those rows, retain previously trashed child markers, and roll back changed-impact/failure cases.
- [ ] T061 [US4] Implement exact batch restoration and independent-child restoration in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`, checking active parent/valid sources for child restore, validating the whole batch, preserving UUIDs/content/links/layout, and clearing only restored provenance (depends on T060).
- [ ] T062 [US4] Wire trash-impact, optional confirmedDiagramIds DELETE, and resolved-document restore in `backend/src/api/diagram-routes.ts` and `backend/src/api/recovery-routes.ts`, preserving DELETE 204, restore response shape, and legacy bodyless deletes with no affected children; return actionable TRASH_IMPACT_CHANGED/PARENT_INACTIVE errors (depends on T061).
- [ ] T063 [US4] Extend recovery API calls and state reconciliation in `frontend/src/api/diagram-client.ts` and `frontend/src/state/diagram-store.ts` to refresh every affected active/trash summary, clear deletion filters after restore, preserve error/retry state, and exit an affected editor/reset ADR context only after successful mutation (depends on T062).
- [ ] T064 [US4] Apply a single named trash-impact confirmation and dirty-work coordinator across `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/SavedDiagramList.tsx`, `frontend/src/components/RecoveryControls.tsx`, and `frontend/src/components/DiagramDeletionUnsavedDialog.tsx`; protect any currently edited affected child/ADR, require fresh confirmation after changed impact, and preserve drafts/view on cancel or failure (depends on T063).
- [ ] T065 [US4] Complete native Restore container diagram and double-click restoration confirmation in `frontend/src/components/WorkspaceInspector.tsx`, `frontend/src/components/DiagramWorkspace.tsx`, and `frontend/src/components/DiagramCanvas.tsx`, using the canonical child summary and guarded restore/load flow without replacement or stale switches (depends on T064).
- [ ] T066 [US4] Extend `shared/src/export/mermaid-export.ts` for validated populated child scope/source comments, escaped full multiline container metadata, labeled system subgraph, external nodes/relationships after its end, and protocol; return actionable EMPTY_CONTAINER_MERMAID for empty children and add a parent single-diagram/unbundled-child scope note without dummy nodes.
- [ ] T067 [US4] Extend `shared/src/export/svg-layout.ts` and `shared/src/export/svg-export.ts` for empty/populated system boundaries, current owner/type/source metadata, wrapped full responsibilities/technology/protocol, stable artifact data IDs, accessible scope text, and a viewBox covering every boundary/node/relationship label; preserve general/group rendering (depends on T066).
- [ ] T068 [US4] Extend `shared/src/export/html-snapshot.ts`, `shared/src/export/diagram-page.ts`, `shared/src/export/styles.ts`, and `shared/src/export/html-package.ts` to retain all child/scope/source fields, printable full details, empty-state boundary, stable local ADR anchors, and explicit single-diagram scope; keep existing ZIP paths/offline links and reject unsupported content before file generation (depends on T067).
- [ ] T069 [US4] Integrate immutable browser draft/ADR capture and fresh same-scope container-context resolution in `frontend/src/components/ExportButton.tsx` and `frontend/src/api/export-client.ts` using `frontend/src/api/diagram-client.ts`; overlay only authoritative source display fields, validate references including unsaved new occurrences, and preserve draft/view with no download on failure (depends on T068).
- [ ] T070 [US4] Integrate saved resolved child documents/ADRs into `cli/src/api-client.ts` and `cli/src/export-command.ts`, preserving every new field and existing overwrite/error behavior; generate the existing complete HTML ZIP without recursive parent/child packages or live-app links (depends on T068).
- [ ] T071 [US4] Use consistent source-resolved documents in `backend/src/services/export-service.ts` and `backend/src/api/export-routes.ts`, sharing `backend/src/services/container-context.ts`; reject inactive/broken graphs and map empty-child Mermaid to 422 EMPTY_CONTAINER_MERMAID before producing files (depends on T066).
- [ ] T072 [US4] Complete DESIGN.md styling, visible focus, readable diagram-level/type labels, native Create/Open/Restore controls, live progress/errors, accessible boundary description, and non-nested ADR interactions in `frontend/src/styles.css`, `frontend/src/components/recovery.css`, `frontend/src/components/ContainerBoundaryNode.tsx`, and `frontend/src/components/ComponentNode.tsx`; verify T049–T057 and keyboard recovery/export feedback after all US4 integrations.

**Checkpoint**: ADR references, dependency safeguards, exact recoverability, and complete supported exports work with all four stories and existing diagrams.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Establish implementation evidence and compatibility across the complete feature.

- [ ] T073 [P] Add the 100-container/100-external/300-relationship validation/layout/export envelope and general-diagram baseline comparison in `shared/tests/container-scale.test.ts` and `e2e/tests/performance.spec.ts`; record timing and batched-resolution behavior in `specs/009-c4-container-diagrams/validation.md` without introducing a product limit or per-source lookup loop.
- [ ] T074 [P] Update `README.md` and `specs/009-c4-container-diagrams/quickstart.md` for migration 0005, both entry points, external-source editing, list/parent navigation, ownership blockers, exact trash restoration, browser-draft versus saved CLI exports, and empty Mermaid alternatives; keep examples aligned with implemented contracts.
- [ ] T075 Run `npm.cmd run build` and `npm.cmd test` from `package.json` with a dedicated DATABASE_URL and RUN_POSTGRES_TESTS enabled; verify migration, feature PostgreSQL race/rollback suites execute without skips and existing general/group/ADR/CLI/export compatibility passes, fixing affected implementation/tests and recording results in `specs/009-c4-container-diagrams/validation.md`.
- [ ] T076 Run the feature browser suite in `e2e/tests/container-diagrams.spec.ts` plus affected saved-diagram, grouping, ADR, recovery, and HTML-portability workflows in `e2e/tests/`; complete the keyboard-only select/create/edit/connect/save/return journey and focus/error checks, fixing failures and recording executed scenarios in `specs/009-c4-container-diagrams/validation.md` (depends on T075).
- [ ] T077 Perform observed SC-001 creation, SC-003 modeling, and SC-004 readability checks using prepared architecture information in `specs/009-c4-container-diagrams/quickstart.md`; record participant counts, observed times, success rates, and errors against the 90%/30-second, five-minute, and 90%/one-minute targets in `specs/009-c4-container-diagrams/validation.md`, and inspect exported SVG/HTML/ADR links offline (depends on T076).
- [ ] T078 Reconcile FR-001–FR-022 and SC-001–SC-008 evidence in `specs/009-c4-container-diagrams/validation.md` against `specs/009-c4-container-diagrams/plan.md` and `specs/009-c4-container-diagrams/contracts/`; confirm unchanged identities/creation times, no unsupported export omission, no unresolved placeholders, and accurate checkbox completion in `specs/009-c4-container-diagrams/tasks.md`; leave unexecuted/failed gates explicitly outstanding (depends on T073–T077).

## Dependencies & Execution Order

### Phase dependencies

```text
Setup (T001–T003)
  -> Foundation (T004–T016)
      -> US1 (T017–T028): canonical entry points + empty child
          -> US2 (T029–T040): useful container editing
          -> US3 (T041–T048): complete navigation + source/list context
          -> US4 (T049–T072): ADR/recovery/export integration
US2 + US3 + US4
  -> Polish and release validation (T073–T078)
```

- Execute in numeric phase order for the default single-developer workflow: Setup → Foundation → US1 → US2 → US3 → US4 → Polish.
- US1 depends on Foundation, not another story. Its external-source cases use seeded occurrences. T026 consumes the foundation layout/domain contract.
- US2 depends on US1's child session/visual boundary/API context integration. Its independent test can start from a prepared saved child.
- US3 depends on US1's coordinator and child loading. Populated acceptance scenarios use either US2 output or equivalent saved fixtures.
- US4 depends on foundation transactional guards and US1's canonical navigation; its full UI/export journey uses US2 editor output and US3 draft/navigation/list integration. Backend recovery and shared-export work can be prepared after Foundation/US1, but the integrated US4 checkpoint waits for US2/US3.
- Independent testing means each story has a bounded fixture-driven acceptance check; it does not mean shared application files can be edited concurrently without coordination.
- Release validation depends on all stories. Do not expose an incomplete recovery/export workflow as a completed release merely because the US1 demo passes.

### Within each phase/story

- Author the listed test batch first, confirm meaningful failures, then implement and run it at the checkpoint. T016 adds integration coverage after the complete shared foundation is wired.
- Foundation implementation order: T007 → T008/T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016. T008 and T009 use separate files and can be coordinated after T007 even though the default numeric execution is sequential.
- US1 backend chain is T022 → T023 → T024 → T025. Boundary integration T026 and the entry/heading tasks T027–T028 follow the established coordinator/domain interfaces.
- US2 commands T034 precede geometry/UI T036–T040; T035 completes server acceptance of the same edits.
- US3 uses T044 → T045 → T046 → T047 → T048 to keep source/list/navigation behavior aligned.
- US4 recovery chain is T060 → T061 → T062 → T063 → T064 → T065. T058/T059 integrate existing foundation safeguards and ADR targets before the user journey is validated.
- US4 export chain is T066 → T067 → T068, followed by T069/T070; T071 follows T066 and source resolution. T072 waits for every integrated surface it validates.
- Run PostgreSQL-writing test processes serially against shared fixtures, or provide isolated databases/schemas. `[P]` on test tasks authorizes independent test authoring, not simultaneous destructive fixture setup in one database.

### Parallel opportunities

- Foundation test authoring: T004, T005, and T006 after Setup.
- US1 test authoring: T017–T021 after Foundation.
- US2 test authoring: T029–T032 after US1; T033 writes the same browser file used by other story phases and stays sequential.
- US3 test authoring: T041 and T042 after US1/US2; T043 browser additions stay sequential.
- US4 test authoring: T049–T056 after preceding phase interfaces are stable; T057 browser additions stay sequential.
- Final T073 performance work and T074 documentation use separate files. T073 owns `validation.md` during that batch; later evidence tasks append sequentially.
- Implementation tasks share stores, services, and UI files across stories. Use the default sequential integration order; do not infer unrestricted story-level parallelism from the fixture-driven tests.

## Parallel Example: User Story 1

After Foundation, author these independent files together:

```text
T017: backend/tests/contract/container-diagrams.test.ts
T018: backend/tests/persistence/container-diagrams.test.ts
T019: frontend/tests/container-diagram-entry-store.test.ts
T020: frontend/tests/container-diagram-entry-ui.test.tsx
T021: e2e/tests/container-diagrams.spec.ts (US1 cases only)
```

## Parallel Example: User Story 2

After US1 interfaces are ready, author these independent files together:

```text
T029: backend/tests/contract/container-editing.test.ts + backend/tests/persistence/container-editing.test.ts
T030: frontend/tests/container-diagram-store.test.ts
T031: frontend/tests/react-flow-container.test.ts
T032: frontend/tests/container-diagram-ui.test.tsx
```

## Parallel Example: User Story 3

After preceding phase interfaces are stable:

```text
T041: backend/tests/contract/container-navigation.test.ts
T042: frontend/tests/container-diagram-navigation.test.tsx
```

## Parallel Example: User Story 4

After preceding phase interfaces are stable, representative independent test tasks are:

```text
T049: backend/tests/contract/container-dependencies.test.ts
T051: backend/tests/contract/container-recovery.test.ts
T053: frontend/tests/container-diagram-recovery.test.tsx
T054: shared/tests/container-export.test.ts
T055: frontend/tests/container-html-export.test.tsx
T056: cli/tests/container-export-command.test.ts + backend/tests/container-export.test.ts
```

## Requirement Coverage

| Requirement group | Implementation tasks | Principal validation tasks |
| --- | --- | --- |
| FR-001–FR-005: entry points, canonical identity, eligibility, persisted owner, retry | T011–T013, T022–T028 | T017–T021 |
| FR-006–FR-009, FR-022: boundary, metadata, source occurrences, placement and endpoints | T007–T012, T026, T034–T040 | T004–T006, T029–T033 |
| FR-010–FR-013: guarded navigation, list context, saved identity/layout, history | T010–T012, T025, T034–T036, T044–T048 | T019, T030–T031, T041–T043 |
| FR-014–FR-018: ADR workflows, safeguards, exact trash/restore, removal confirmation | T013–T015, T058–T065 | T016, T049–T053, T057 |
| FR-019: complete supported exports, explicit unsupported cases, single-diagram parent scope | T066–T071 | T054–T057, T077 |
| FR-020: legacy storage/payload/general/group/ADR/export compatibility | T002, T007, T009–T010, T048, T066–T071 | T004, T006, T056, T075–T076 |
| FR-021: keyboard/focus/feedback and non-color scope/type cues | T027–T028, T036–T040, T045–T047, T058–T065, T072 | T020–T021, T031–T033, T042–T043, T053, T057, T076–T077 |
| SC-001–SC-004: observed creation/modeling/readability and identity behavior | T022–T028, T034–T040 | T017–T021, T033, T077 |
| SC-005–SC-006: integrity and actionable no-loss failures | T010–T015, T025, T034–T035, T044–T047, T058–T071 | T016–T019, T029–T031, T041–T043, T049–T057, T075–T076 |
| SC-007–SC-008: keyboard journey and existing-diagram compatibility | T007–T010, T027–T028, T036–T040, T045–T048, T072 | T004, T006, T021, T033, T043, T056, T075–T076 |

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundation, including executable migration/transaction checks.
2. Deliver US1: saved Software System → Create/Open → same empty labeled child, with parent-save and retry safeguards.
3. Validate both entry points, group/duplicate-name identity, canonical external-source resolution, and failure retention. This is the first demo milestone.
4. Keep full release approval gated on the remaining stories and validation, especially recoverability and export completeness.

### Incremental Delivery

1. US2 adds useful container/communication authoring and complete atomic layout/history.
2. US3 adds full parent/library/source navigation and contextual saved reopening.
3. US4 completes linked decisions, dependency feedback, exact recovery, and supported exports.
4. Polish records executed database/browser/export checks and observed usability results; every increment reruns affected earlier acceptance checks.

### Coordinated Parallel Work

Use the explicitly listed test-authoring batches and disjoint performance/documentation work. Integrate shared domain/repository/store/UI changes sequentially using the task dependencies. Shared PostgreSQL fixtures and the feature browser file require coordinated ownership.

## Notes

- Keep React Flow as a visual adapter; exports and persistence consume validated domain data.
- Do not add authentication, collaboration, deeper C4 levels, permanent deletion, ownership detachment, recursive packages, a new import workflow, or a new revision-history subsystem.
- Source rename hydration updates displayed context, not parent layout, child identity, or local undo history.
- Boundary fitting/displaced externals belong to the same edit snapshot. Invalid edits do not create partial artifacts or history entries.
- A trashed canonical child reserves ownership and must be restored explicitly. Previously trashed children do not join a later parent restore batch.
- Confirm task completion only after its implementation/validation exists; task generation alone leaves all boxes unchecked.
