# Implementation Plan: C4 Container Diagrams

**Branch**: `009-c4-container-diagrams` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-c4-container-diagrams/spec.md`

## Summary

Add one canonical C4 container diagram per Software System through double-click and a selected/viewed-system action. Extend the shared domain and existing PostgreSQL tables with diagram scope, containers, source-linked external occurrences, technology/protocol metadata and exact recovery. Keep local component UUIDs so existing relationship and ADR links remain diagram-local.

Use transactional create-or-open and source-parent locking, contextual source resolution, a separate visual system boundary and guarded navigation. Preserve general diagrams, grouping and package formats. This phase changes documentation only.

## Technical Context

**Language/Version**: TypeScript 5.8-compatible configuration; Node.js 22 (workspace v22.17.1), npm 11. Exact versions remain governed by package-lock.json; no upgrade planned.

**Primary Dependencies**: Existing React 19.1, Vite 7, @xyflow/react 12.8, Zustand 5, Zod 3.25, Fastify 5.4, Drizzle ORM 0.44, pg 8.16 and JSZip 3.10 package ranges. No new runtime dependencies.

**Storage**: PostgreSQL through existing repositories. Planned additive `backend/drizzle/0005_c4_container_diagrams.sql`; extend diagrams/components/relationships and retain ADR/link tables.

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
| I. Linked, versioned artifacts | Stable IDs/source references, existing timestamps/history, ID-preserving persistence, validated export snapshots. |
| II. First-class decisions | Existing ADR content/lifecycle/replacement rules, local links, no inherited parent decisions. |
| III. Data protection | Locked PUT/DELETE guards, activity checks before ADR writes, named confirmations, exact recovery and rollback. |
| IV. Artifact boundary quality | Domain/contract/store/adapter/export coverage, additive migration and real PostgreSQL races required before completion. |
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
  tasks.md                          # Later speckit-tasks output
```

### Source Code (repository root)

Existing paths to extend:

- `shared/src/domain/{types,c4,invariants}.ts`, `shared/src/validation/schemas.ts`, `shared/src/index.ts`.
- `shared/src/export/{mermaid-export,svg-layout,svg-export,html-snapshot,diagram-page,styles}.ts`.
- `backend/src/persistence/{schema,diagram-repository,adr-repository}.ts`.
- `backend/src/services/{diagram-service,adr-service,export-service}.ts`.
- `backend/src/api/{diagram-routes,recovery-routes,errors,app}.ts`.
- `frontend/src/api/diagram-client.ts`, `frontend/src/state/{diagram-store,adr-store,history}.ts`.
- `frontend/src/adapters/react-flow/diagram-adapter.ts`.
- `frontend/src/components/{DiagramCanvas,DiagramWorkspace,WorkspaceInspector,DiagramToolbar,ComponentNode,RelationshipEdge,SavedDiagramList,RecoveryControls,DiagramSwitchDialog,ExportButton}.tsx`.
- `frontend/src/styles.css`, `cli/src/api-client.ts`, CLI API/export tests and README.md.

Planned focused additions:

```text
shared/src/domain/container-layout.ts
backend/drizzle/0005_c4_container_diagrams.sql
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
e2e/tests/container-diagrams.spec.ts
```

**Structure Decision**: Extend the existing shared/backend/frontend/CLI structure. Thin additions isolate geometry, source resolution, graph write coordination and boundary rendering. React Flow remains a visual adapter. Test names are planned and will be aligned with conventions during task generation.

## Phase 0: Research

Completed [research.md](./research.md) with decisions/rationale/alternatives, repository risks and source citations. Research agents independently reviewed persistence/recovery and editor/export. Context7 verified Drizzle, React Flow and Mermaid mechanisms; PostgreSQL primary documentation supports constraints/locking. No unresolved product or technical clarifications remain.

## Phase 1: Design and Contracts

Completed [data-model.md](./data-model.md), [REST contract](./contracts/openapi.yaml), [UI contract](./contracts/ui-contract.md), [export contract](./contracts/export-contract.md) and [quickstart validation guide](./quickstart.md).

### Persistence and concurrency

1. Add diagram kind/owner/parent/boundary and trash batch/root fields, component role/technology/source fields, and relationship protocol. Preserve IDs, creation times, groups and ADR links.
2. Enforce unique owner across active/trashed children, restrictive owner/source FKs, composite owner-parent membership and unique external source per child. Legacy rows default to general/element without reclassifying free-form types.
3. A graph transaction helper shared by diagram/ADR writes locks the canonical source parent, then affected children in UUID order, and rereads identity/activity/dependencies. General operations lock their general row.
4. Atomic create-or-open returns 201 new/200 existing and 409 RESTORE_REQUIRED for a trashed child. A uniqueness conflict rolls back before fresh winner resolution.
5. Replacement compares previous/incoming documents before physical diffs. Protect owners/sources, omitted ADR-linked artifacts, local relationship/group dependencies and immutable scope. PUT cannot change status/provenance or bypass DELETE.
6. ADR create/update/delete/link/lifecycle operations check active parent/child before mutation in the same locked transaction. Repository writes must use that transaction rather than perform a separate write after a precheck.
7. Parent trash validates the confirmed affected set and marks only active children with a common batch/root. Restore exactly that batch; previously trashed children remain trashed. Independent child restore requires an active parent and valid sources.
8. Memory test repositories model the contracts; real PostgreSQL proves uniqueness, rollback, race safety and recovery.

### Source resolution and compatibility

Use a contextual resolver for load/save/summaries/export. Batch-hydrate source fields, preserve local occurrence layout, and reject missing references. Existing required database fields may hold server-written caches; source data remains authoritative.

Container-context supplies the external picker and fresh source metadata for unsaved browser export. Shared schemas retain new fields in responses and normalize omissions only for legacy/general inputs. A container cannot be downgraded through an old payload. Keep general grouping and legacy types; update frontend/CLI response validation together.

### Editor, geometry and history

Use explicit Container/External roles and separate Add container/Include external participant forms. Validate metadata in one atomic store command. Wrap responsibilities/technology/protocol and grow dimensions when needed; canvas/SVG must retain readable complete content.

Render a separate nonconnectable boundary with a synthesized React Flow identity excluded from domain components and ADR endpoints. Keep absolute positions and general grouping. Shared helpers fit internal bounds and relocate intersecting externals; completed edits push all geometry effects as one history snapshot.

Pointer and keyboard moves use the same domain command. Keyboard changes cannot remain only in React Flow state. Preserve node/edge focus, native Create/Open/Restore buttons, selection and Shift behavior.

### Navigation and recovery

One coordinator handles both entry points, external source opening, parent link and library navigation. Guard dirty diagram/ADR states, require successful parent save for unsaved owners, prevent overlapping requests/stale switches and commit navigation only after valid data loads. Reset history/selection/ADR context after successful switching.

Retain list arrays, DELETE 204 and restore document responses. Add diagramBlockers alongside existing ADR blockers and trash-impact preflight. Recheck confirmed IDs under lock; changed impact requires another confirmation.

All library/workspace/RecoveryControls trash paths use named confirmation. Protect unsaved work in any currently edited affected child/ADR before parent trash. Refresh every affected active/trash summary. Permanent deletion and ownership detachment remain outside this feature.

### Exports

Extend Mermaid/SVG/HTML snapshots and renderers for scope, roles, source IDs, responsibilities, technology and protocol. Browser HTML keeps draft capture and resolves current source context without saving; CLI uses persisted resolved content. Preserve existing ZIP paths and offline ADR links.

Populated Mermaid uses existing flowchart/subgraph grammar, escaped multiline labels, and external nodes/relationships after the system subgraph. Empty SVG/HTML retains the boundary; empty-child Mermaid returns 422 EMPTY_CONTAINER_MERMAID with alternatives. Insert no dummy artifacts. Parent exports declare single-diagram scope and unbundled children without per-child requests. Unsupported/invalid content fails before file generation.

## Implementation Sequence for Task Generation

1. Domain/schema/invariants, deterministic layout, additive migration and legacy fixtures.
2. Transactional repositories/resolver, child APIs, PUT/DELETE/ADR guards and exact recovery.
3. Editor/adapter/rendering, source picker, metadata/history and pointer/keyboard layout.
4. Guarded navigation/list scope and dependency-aware deletion.
5. Shared export and browser/CLI snapshot integration with package regressions.
6. Database concurrency/migration, contracts, end-to-end, accessibility/usability validation and README.

Include meaningful checks at each artifact boundary. This workflow stops at design: task generation, application changes, migration application and implementation tests belong to subsequent phases.

## Validation Matrix

| Requirements | Required implementation validation |
| --- | --- |
| FR-001–FR-005 | Both entry points, eligibility, grouped/duplicate owners, repeated/concurrent creation, persisted-owner prerequisite, external resolution, retry. |
| FR-006–FR-009, FR-022 | Kind/role/text/endpoint/source rules, empty/fitted boundary, clearance/displacement, readable metadata, independent layout. |
| FR-010–FR-013 | Dirty diagram/ADR Save/Discard/Cancel, stale responses, list reopen/source refresh, pointer/keyboard moves, atomic undo/redo. |
| FR-014–FR-018 | ADR lifecycle/ownership, DELETE/PUT bypass, blockers, trash races, exact batch recovery, inactive-write guards. |
| FR-019 | Content/escaping, empty-child outcomes, offline package/ADR links, draft vs persisted CLI state, reference failures, parent scope. |
| FR-020 | Additive migration/old payloads, no type reclassification, general edit/group/ADR/export regressions. |
| FR-021 | Keyboard actions/editing, visible focus/live feedback and non-color scope/type cues. |
| SC-001–SC-008 | Timed creation/modeling/readability, integrity/failure coverage, keyboard journey and compatibility. |

PostgreSQL suites must execute without skips for release validation. In-memory checks cannot prove database concurrency. Usability timing/readability requires observed outcomes rather than inference from unit tests.

## Post-Design Constitution Check

All five principles pass against concrete artifacts and validation responsibilities. No new runtime dependency, storage system, auth/collaboration scope or unjustified exception is introduced. Implementation gates remain for task execution.

## Complexity Tracking

No constitution violations require justification.

## Planning Artifact Review

Reviewed on 2026-09-30. OpenAPI YAML parsed successfully; all 12 documented operations have responses and required path parameters; 70 contract references and 19 local Markdown links resolve. No unresolved clarification/template placeholders remain in the design artifacts. Application builds, migrations and implementation tests were not run in this planning phase.
