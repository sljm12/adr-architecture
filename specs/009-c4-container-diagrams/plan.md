# Implementation Plan: C4 Container Diagrams

**Branch**: `009-c4-container-diagrams` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Updated**: 2026-10-02 to incorporate the clarified FR-015 source-type protection and FR-017 child-initiated parent recovery, retaining the subtype/save/list revision.

**Input**: Feature specification from `specs/009-c4-container-diagrams/spec.md`

## Summary

Add one canonical C4 container diagram per Software System through double-click and a selected/viewed-system action. Extend the shared domain and existing PostgreSQL tables with diagram scope, containers, source-linked external occurrences, technology/protocol metadata and exact recovery. Keep local component UUIDs so existing relationship and ADR links remain diagram-local.

Use transactional create-or-open and source-parent locking, contextual source resolution, a separate visual system boundary and guarded navigation. Preserve general diagrams, grouping and package formats. This phase changes documentation only.

Update internal component creation and editing to offer exactly Application and Datastore, persisted as `containerType` while retaining `role: container` and `type: container`. Save edits to the existing child, preserving its own name, kind and canonical parent/owner IDs, and render it beneath its parent in the library. Source-linked external participants retain their separate inclusion workflow.

When a child restoration is requested while its parent is trashed, preview and confirm restoration of the parent and exactly its affected trash batch. Earlier independently trashed children require a separate restore after the parent is active. Block unsupported source type changes while active or recoverable occurrences depend on the source, and identify those occurrences without deleting relationships or ADR links.

### Current implementation and revision scope

Setup, foundation and US1 tasks T001–T028 are already checked in [tasks.md](./tasks.md); their recorded validation is in [validation.md](./validation.md). The 0005 migration and canonical child creation/loading are present. This revision preserves that completed work and plans the remaining editor/list/export changes plus subtype support through a new 0006 migration. Existing checked tasks do not establish coverage of the revised requirements; task reconciliation follows this planning command.

Repository review confirms that the save client PUTs the child's ID and the backend rejects kind/parent/owner reassignment. No literal "Parent Diagram" name assignment was found. The confirmed UI gaps are general-type component controls in child views and a flat library that omits child scope labels. Treat the reported save behavior as a required regression scenario, and preserve the existing backend guards while completing hierarchy and feedback.

## Technical Context

**Language/Version**: TypeScript 5.8-compatible configuration; Node.js 22 (workspace v22.17.1), npm 11. Exact versions remain governed by package-lock.json; no upgrade planned.

**Primary Dependencies**: Existing React 19.1, Vite 7, @xyflow/react 12.8, Zustand 5, Zod 3.25, Fastify 5.4, Drizzle ORM 0.44, pg 8.16 and JSZip 3.10 package ranges. No new runtime dependencies.

**Storage**: PostgreSQL through existing repositories. Existing additive `backend/drizzle/0005_c4_container_diagrams.sql` provides scope/roles/recovery. Plan a new `backend/drizzle/0006_container_component_types.sql` for container_type and its role constraint; preserve applied migration history and ADR/link tables.

**Testing**: Vitest 3.2 for domain/schema/layout, state/history, adapter, API, migration/persistence and export; Playwright 1.54 for user journeys and keyboard workflows. Real PostgreSQL requires DATABASE_URL; RUN_POSTGRES_TESTS enables existing conditional group coverage.

**Target Platform**: Browser editor, static frontend, containerized API and managed PostgreSQL; current pointer/keyboard and responsive layouts.

**Project Type**: Shared TypeScript domain, React frontend, Fastify REST backend and existing read-only CLI.

**Performance Goals**: Meet SC-001–SC-004 creation/modeling/readability targets. Compute layout once per edit, batch source hydration and avoid per-occurrence network/database calls. Validate an envelope of 100 internal containers, 100 external occurrences and 300 relationships without imposing a product limit; compare general-diagram interaction against the existing baseline.

**Constraints**: Stable UUIDs; ownership unique across trash; independent occurrence layout; immutable scope; atomic dependency/recovery checks; complete bounded history; no export omission; accessible feedback and DESIGN.md. No auth, collaboration, deeper C4 levels, recursive packages or new revision-history infrastructure.

**Scale/Scope**: Existing single-user system. One child per source Software System in a general parent; external Software Systems open their source's canonical child. Internal containers do not introduce another diagram level.

## Constitution Check

Pre-research and post-design gates pass. The checks below assess design compliance, not completed implementation or passing implementation tests.

| Principle | Design evidence |
| --- | --- |
| I. Linked, versioned artifacts | Stable IDs/source references, subtype-preserving history/serialization, immutable child save scope, existing timestamps, validated export snapshots. |
| II. First-class decisions | Existing ADR content/lifecycle/replacement rules, local links, no inherited parent decisions. |
| III. Data protection | Locked PUT/DELETE guards for active and recoverable occurrences, activity checks before ADR writes, named restore-impact confirmations, exact recovery and rollback. |
| IV. Artifact boundary quality | Domain/contract/store/adapter/export coverage, 0005-to-0006 compatibility, subtype/save/list regressions, child-initiated recovery and source-type preservation tests, and real PostgreSQL races required before completion. |
| V. Simplicity and accessibility | Existing stack/tables, one separate boundary, native keyboard actions, persistent keyboard geometry and existing design system. |

No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/009-c4-container-diagrams/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/openapi.yaml
  contracts/ui-contract.md
  contracts/export-contract.md
  checklists/requirements.md
  tasks.md                          # Existing tracker; reconcile after this revision
  validation.md                     # Existing implementation evidence
```

### Source Code (repository root)

Existing paths to extend:

- `shared/src/domain/{types,c4,invariants}.ts`, `shared/src/validation/schemas.ts`, `shared/src/index.ts`.
- `shared/src/export/{mermaid-export,svg-layout,svg-export,html-snapshot,diagram-page,styles}.ts`.
- `backend/src/persistence/{schema,diagram-repository,adr-repository}.ts`.
- `backend/src/services/{diagram-service,adr-service,export-service}.ts`.
- `backend/src/api/{diagram-routes,recovery-routes,errors,app}.ts`.
- `frontend/src/api/diagram-client.ts`, `frontend/src/state/{diagram-store,diagram-list,adr-store,history}.ts`.
- `frontend/src/adapters/react-flow/diagram-adapter.ts`.
- `frontend/src/components/{DiagramCanvas,DiagramWorkspace,WorkspaceInspector,DiagramToolbar,ComponentNode,RelationshipEdge,SavedDiagramList,RecoveryControls,DiagramSwitchDialog,ExportButton}.tsx`.
- `frontend/src/styles.css`, `cli/src/api-client.ts`, CLI API/export tests and README.md.

Feature paths (existing foundation and remaining additions):

```text
shared/src/domain/container-layout.ts
backend/drizzle/0005_c4_container_diagrams.sql
backend/drizzle/0006_container_component_types.sql
backend/src/persistence/graph-transaction.ts
backend/src/services/container-context.ts
backend/src/api/container-diagram-routes.ts
frontend/src/components/ContainerBoundaryNode.tsx
shared/tests/container-diagrams.test.ts
shared/tests/container-layout.test.ts
shared/tests/container-export.test.ts
backend/tests/contract/container-diagrams.test.ts
backend/tests/persistence/container-diagrams.test.ts
frontend/tests/container-diagram-store.test.ts
frontend/tests/container-diagram-ui.test.tsx
frontend/tests/react-flow-container.test.ts
frontend/tests/saved-diagram-list.test.tsx
frontend/tests/diagram-list.test.ts
e2e/tests/container-diagrams.spec.ts
```

**Structure Decision**: Extend the existing shared/backend/frontend/CLI structure. Thin additions isolate geometry, source resolution, graph write coordination and boundary rendering. React Flow remains a visual adapter. Test names are planned and will be aligned with conventions during task generation.

## Phase 0: Research

Completed [research.md](./research.md) with decisions/rationale/alternatives, repository risks and source citations. Research agents independently reviewed persistence/recovery and editor/export. Context7 verified Drizzle, React Flow and Mermaid mechanisms; PostgreSQL primary documentation supports constraints/locking. No unresolved product or technical clarifications remain.

The 2026-10-01 revision adds independent repository research for subtype propagation and child save/list behavior. Current Context7 Drizzle guidance supports named CHECK constraints and forward migrations; the compatibility backfill and library grouping are project design decisions. The established stack and previously researched editor/export mechanisms remain in use.

The 2026-10-02 repository review confirms source reclassification protection already checks active and trashed children, but its blockers need occurrence identities and additional preservation coverage. Recovery still delegates to single-row repository operations; batch recovery, restore-impact and typed conflict handling remain planned implementation work. This revision changes business rules and contracts using the existing stack; no new library mechanism, dependency or migration is required for these two decisions.

## Phase 1: Design and Contracts

Completed [data-model.md](./data-model.md), [REST contract](./contracts/openapi.yaml), [UI contract](./contracts/ui-contract.md), [export contract](./contracts/export-contract.md) and [quickstart validation guide](./quickstart.md).

### Persistence and concurrency

1. Add diagram kind/owner/parent/boundary and trash batch/root fields, component role/technology/source fields, and relationship protocol. Preserve IDs, creation times, groups and ADR links.
2. Enforce unique owner across active/trashed children, restrictive owner/source FKs, composite owner-parent membership and unique external source per child. Legacy rows default to general/element without reclassifying free-form types.
3. A graph transaction helper shared by diagram/ADR writes locks the canonical source parent, then affected children in UUID order, and rereads identity/activity/dependencies. General operations lock their general row.
4. Atomic create-or-open returns 201 new/200 existing and 409 RESTORE_REQUIRED for a trashed child. A uniqueness conflict rolls back before fresh winner resolution.
5. Replacement compares previous/incoming documents before physical diffs. Protect owners/sources, omitted ADR-linked artifacts, local relationship/group dependencies and immutable scope. PUT cannot change status/provenance or bypass DELETE. Unsupported source reclassification returns DIAGRAM_DEPENDENCY for every active or recoverable occurrence, with its child/source/occurrence identity and explicit removal action. Preserve the source, occurrences, relationships and ADR links on rejection; otherwise valid Person/Software System changes remain allowed unless owner protection applies.
6. ADR create/update/delete/link/lifecycle operations check active parent/child before mutation in the same locked transaction. Repository writes must use that transaction rather than perform a separate write after a precheck.
7. Parent trash validates the confirmed affected set and marks only active children with a common batch/root. Restore exactly that batch; previously trashed children remain trashed. Independent child restore requires an active parent and valid sources. GET restore-impact resolves a requested child with a trashed parent to that parent as the restoration root. The confirmed POST targets the root, compares the full affected ID set and batch identity under the graph lock, and restores the batch atomically. Direct child POST while its parent is inactive returns PARENT_INACTIVE with the root ID and performs no restoration. Stale confirmation returns RESTORE_IMPACT_CHANGED without writes.
8. Memory test repositories model the contracts; real PostgreSQL proves uniqueness, rollback, race safety and recovery.

9. Preserve 0005 and add 0006 with nullable container_type, backfill only existing internal role rows to application, then replace the named role CHECK: internal containers require application/datastore and other roles require null. Keep type container, IDs, timestamps, layout, endpoints and ADR links unchanged. Mirror the check in Drizzle schema and include the field in both repository component write paths and reads. Application is the explicit compatibility default for formerly generic containers; never infer Datastore from names or technology.

### Source resolution and compatibility

Use a contextual resolver for load/save/summaries/export. Batch-hydrate source fields, preserve local occurrence layout, and reject missing references. Existing required database fields may hold server-written caches; source data remains authoritative.

Container-context supplies the external picker and fresh source metadata for unsaved browser export. Shared schemas retain new fields in responses and normalize omissions only for legacy/general inputs. A container cannot be downgraded through an old payload. Keep general grouping and legacy types; update frontend/CLI response validation together.

Add `ContainerType = application | datastore` and nullable component.containerType. Require it on internal child writes/read responses after migration; default omissions to null only for general legacy input. Keep C4ArtifactType and source eligibility restricted to Person/Software System. Shared schemas, invariants and store commands reject unsupported internal subtypes and general-role commands in child documents before mutation. A pre-revision child client missing subtype must receive a field-level validation failure without stripping content or applying a default on write.

### Editor, geometry and history

Use explicit Container/External roles and separate Add component/Include external participant forms. In a child, add/edit offers exactly Application and Datastore and requires name/responsibilities/technology in one atomic store command. Reset creation drafts on document-kind switches; external name/type/details stay source-derived and read-only. Preserve subtype during undo/redo, sizing and adapter conversion. Wrap responsibilities/technology/protocol and show the subtype label on canvas/SVG without clipping complete content.

Render a separate nonconnectable boundary with a synthesized React Flow identity excluded from domain components and ADR endpoints. Keep absolute positions and general grouping. Shared helpers fit internal bounds and relocate intersecting externals; completed edits push all geometry effects as one history snapshot.

Pointer and keyboard moves use the same domain command. Keyboard changes cannot remain only in React Flow state. Preserve node/edge focus, native Create/Open/Restore buttons, selection and Shift behavior.

### Navigation and recovery

One coordinator handles both entry points, external source opening, parent link and library navigation. Guard dirty diagram/ADR states, require successful parent save for unsaved owners, prevent overlapping requests/stale switches and commit navigation only after valid data loads. Reset history/selection/ADR context after successful switching.

Ordinary Save and Save-before-navigation PUT the captured child's own ID, name, kind, scope and boundary. Verify response ID, normalized own name, kind and parent/owner IDs before replacing editor state or registering summaries; retain draft/retry intent on mismatch or failure and preserve existing revision guards for edits during save. Never recreate a child through generic create, assign "Parent Diagram", or apply child content to the parent. Direct library loading and refresh retain persisted canonical scope; the latest navigation origin never determines a new parent. The toolbar shows the child's own name as well as level/owner and returns through guarded load of scope.parentDiagramId.

Keep the list API as a flat summary array and build nested UI groups keyed by parent UUID using frontend diagram-list helpers. Apply existing own-name/date filters first, render contextual parent headings for matching children, and count only matching diagrams. A parent match does not expand filter matches to unrelated children. Sort parent groups and child siblings using current comparators/UUID tie breakers. Use scope metadata as a contextual heading if the parent summary is unavailable; never promote that child to a top-level parent. Reconcile successful saves by child ID and show name/level/owner/parent in accessible list actions. Keep recovery scope labels consistent without adding a nested API or new save endpoint.

Retain list arrays, DELETE 204 and restore document responses. Add diagramBlockers alongside existing ADR blockers, trash-impact and restore-impact preflights. Recheck confirmed IDs and restoration batch under lock; changed impact requires another confirmation. Multi-diagram restoration requires a confirmation body; bodyless single-diagram restores remain compatible only when the parent is active or absent. Use the standard typed error serializer on recovery routes.

All child restore entry points preview the canonical root and affected names before confirmation. Cancellation changes no trash states. After root restoration, refresh the full active/trash lists and load the requested child only if it was included and navigation guards succeed. If the requested child was independently trashed earlier, explain that it remains trashed and offer its separate confirmed restore after the parent is active. Never activate it as an unconfirmed addition to the batch. Preserve current editor/ADR work on failure, and distinguish successful recovery from a subsequent failed load.

All library/workspace/RecoveryControls trash paths use named confirmation. Protect unsaved work in any currently edited affected child/ADR before parent trash. Refresh every affected active/trash summary. Permanent deletion and ownership detachment remain outside this feature.

### Exports

Extend Mermaid/SVG/HTML snapshots and renderers for scope, roles, source IDs, responsibilities, technology and protocol. Browser HTML keeps draft capture and resolves current source context without saving; CLI uses persisted resolved content. Preserve existing ZIP paths and offline ADR links.

Preserve containerType and display Application/Datastore with role-aware validation/label helpers. Do not widen general C4 source helpers; the current HTML snapshot rejection of type container must be addressed explicitly. Keep the child's own name and canonical scope in snapshots and validate missing/unsupported subtype before export rather than omit it.

Populated Mermaid uses existing flowchart/subgraph grammar, escaped multiline labels, and external nodes/relationships after the system subgraph. Empty SVG/HTML retains the boundary; empty-child Mermaid returns 422 EMPTY_CONTAINER_MERMAID with alternatives. Insert no dummy artifacts. Parent exports declare single-diagram scope and unbundled children without per-child requests. Unsupported/invalid content fails before file generation.

## Implementation Sequence for Task Generation

1. Reconcile existing tasks with this revision, preserve T001–T028 completion/evidence and identify additional subtype/save/list coverage without assuming existing checks prove it.
2. Extend established domain/schema/invariants with containerType, add forward 0006 and compatibility fixtures, and round-trip the field in memory/PostgreSQL repositories. Retain completed transactional APIs/guards and add the revised validation to them.
3. Complete editor/adapter/rendering with Application/Datastore choices, source picker, metadata/history, draft reset and pointer/keyboard layout.
4. Add save-response identity checks, guarded parent navigation, grouped library/filter projection, scope labels, occurrence-specific source blockers and confirmed child-initiated parent-batch recovery.
5. Complete shared export and browser/CLI subtype snapshot integration with package regressions.
6. Validate 0005-to-0006 upgrade, subtype round trips, repeated child saves and failed retries, grouped/filter list behavior, active/trashed source-type guards, restoration cancellation/stale batches/rollback, existing database concurrency, end-to-end, accessibility/usability and README.

Include meaningful checks at each artifact boundary. This workflow stops at design: task generation, application changes, migration application and implementation tests belong to subsequent phases.

## Validation Matrix

| Requirements | Required implementation validation |
| --- | --- |
| FR-001–FR-005 | Both entry points, eligibility, grouped/duplicate owners, repeated/concurrent creation, persisted-owner prerequisite, external resolution, retry. |
| FR-006–FR-009, FR-022 | Kind/role/text/endpoint/source rules, empty/fitted boundary, clearance/displacement, readable metadata, independent layout. |
| FR-010–FR-013 | Dirty diagram/ADR Save/Discard/Cancel, stale responses, list reopen/source refresh, pointer/keyboard moves, atomic undo/redo. |
| FR-014–FR-018 | ADR lifecycle/ownership, DELETE/PUT bypass, blockers, trash races, exact batch recovery, inactive-write guards. |
| FR-015, clarification 2026-10-02 | Unsupported source retype rejected with active and recoverable occurrence IDs; source/relationship/ADR preservation; supported type changes and owner restriction; PUT versus occurrence creation/removal races. |
| FR-016–FR-017, clarification 2026-10-02 | Child-triggered parent/batch preview and confirmation, cancellation, earlier-independent-child exclusion/separate restore, direct-child inactive conflict, stale set/batch rejection, atomic rollback and full list refresh. |
| FR-019 | Content/escaping, empty-child outcomes, offline package/ADR links, draft vs persisted CLI state, reference failures, parent scope. |
| FR-020 | Additive migration/old payloads, no type reclassification, general edit/group/ADR/export regressions. |
| FR-021 | Keyboard actions/editing, visible focus/live feedback and non-color scope/type cues. |
| FR-007, FR-024, SC-009 | Application/Datastore-only add/edit, persisted subtype, undo/redo, parent form reset, rejected commands/writes without partial artifacts, external picker unchanged, subtype labels in all exports. |
| FR-011, FR-023, SC-010 | Repeated child PUTs, child own name/kind/scope, same ID on save-before-navigation/refresh/list reopen/retry, malformed response rejection, duplicate names across parents, parent unchanged, nested list/filter counts. |
| FR-020, subtype compatibility | Upgrade an existing 0005 schema to 0006 with active/trashed generic containers; preserve all identities/timestamps/links/layout, backfill internal subtype only, general/free-form rows unchanged. |
| SC-001–SC-010 | Timed creation/modeling/readability, integrity/failure coverage, keyboard journey, exact subtype choices, canonical child save placement and compatibility. |

PostgreSQL suites must execute without skips for release validation. In-memory checks cannot prove database concurrency. Usability timing/readability requires observed outcomes rather than inference from unit tests.

## Post-Design Constitution Check

All five principles pass against concrete artifacts and validation responsibilities. No new runtime dependency, storage system, auth/collaboration scope or unjustified exception is introduced. Implementation gates remain for task execution.

## Complexity Tracking

No constitution violations require justification.

## Planning Artifact Review

Reviewed on 2026-09-30. OpenAPI YAML parsed successfully; all 12 documented operations have responses and required path parameters; 70 contract references and 19 local Markdown links resolve. No unresolved clarification/template placeholders remain in the design artifacts. Application builds, migrations and implementation tests were not run in this planning phase.

Revision review on 2026-10-01 covers the updated plan, research, data model, UI/REST/export contracts and quickstart. OpenAPI 1.1.0 YAML parses; all 12 documented operations have responses and required path parameters; all 71 contract references and 22 local Markdown links in these design artifacts resolve. Diff formatting passes and no unresolved clarification/template placeholders remain. Prior implementation outcomes remain recorded separately in validation.md. No application build, migration application or implementation test was run for this plan update. All five constitution design gates pass. The next workflow is speckit-tasks to reconcile remaining work with FR-023/FR-024 and SC-009/SC-010.

Revision review on 2026-10-02 incorporates both accepted clarifications into the plan, research, data model, UI/REST contracts and quickstart. The export contract remains applicable without changes. OpenAPI 1.2.0 YAML parses with unique-key checking; all 13 documented operations have responses and required path parameters, 77 contract references resolve including the cross-feature group schema, and 22 local Markdown links resolve. No unresolved clarification/template placeholders remain and diff formatting passes. All five constitution design gates pass before research and after design, without exceptions. No application build, migration application or implementation test was run for this documentation update. Reconcile remaining tasks with clarified FR-015/FR-017 as well as the prior subtype/save/list revision; preserve existing completion markers and implementation evidence.
