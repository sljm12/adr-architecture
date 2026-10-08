# Implementation Plan: C4 Component Diagrams

**Branch**: `010-c4-component-diagrams` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-c4-component-diagrams/spec.md`, including the accepted immediate-parent source occurrence deletion safeguard.

## Summary

Add one canonical C4 Component child beneath each Application or Datastore through double-click and a visible keyboard action. Reuse the Container workflow for owner-derived titles, internal editing, supporting participants, local ADRs, stable saves/list placement, guarded navigation and exact recovery across System Context → Container → Component.

Extend the existing domain, PostgreSQL constraints, root-coordinated graph services, editor and export adapters. Retain immediate source occurrence IDs so removal from the Container parent is blocked while active or recoverable Component children use it. Browser packages include active descendants to the requested depth; single-diagram and CLI exports remain selected-only. This planning phase changes documentation only.

## Technical Context

**Language/Version**: TypeScript 5.8 package range and Node.js 22 environment. Installed versions remain governed by package-lock.json; no upgrade planned.

**Primary Dependencies**: Existing React 19.1, Vite 7, @xyflow/react 12.8, Zustand 5, Zod 3.25, Fastify 5.4, Drizzle ORM 0.44, pg 8.16 and JSZip 3.10 package ranges. No new runtime dependencies/services.

**Storage**: Existing PostgreSQL diagram/component/relationship/ADR/link tables. Planned forward migration `0007_c4_component_diagrams.sql` updates kind/scope/role CHECK constraints; existing parent, owner, source, boundary and recovery columns suffice. Do not rewrite 0005/0006.

**Testing**: Vitest 3.2 domain/schema/store/adapter/contract/persistence/export/CLI checks; Playwright 1.54 pointer/keyboard/offline workflows. Release database validation requires a dedicated migrated DATABASE_URL and RUN_POSTGRES_TESTS=1 without skipped PostgreSQL suites.

**Target Platform**: Existing browser application, static frontend, containerized API and managed PostgreSQL. Export acceptance remains current stable desktop Chrome, Edge, Firefox and Safari with normal direct-from-disk settings.

**Project Type**: Shared TypeScript domain, React frontend, Fastify REST backend and existing read-only CLI.

**Performance Goals**: Meet SC-001/SC-003 observed usability timings; preserve the existing selected HTML 100-artifact/200-relationship/100-ADR 10-second scale bound. Batch source hydration and fit boundary once per edit. Record five warmups/twenty measured samples against comparable Container baselines; investigate median regressions above 20% with hardware/runtime/browser recorded. These are engineering validation targets, not new product caps.

**Constraints**: Stable UUIDs; immutable kind/parent/owner/source identities; owner uniqueness across trash; immediate-source dependencies; atomic root-first diagram/ADR writes and recovery; retained drafts/bounded history; complete exports; DESIGN.md and keyboard access. No Code level, authentication, collaboration or new history infrastructure.

**Scale/Scope**: Single-user release, one canonical child per container. Cover 100 internals/100 supporting occurrences/300 relationships per scoped diagram and a hierarchy of 1 Context, 3 Container and 6 Component diagrams with linked/unlinked ADRs. No hard artifact count limit is introduced.

## Constitution Check

Pre-research: PASS. Post-design: PASS against the artifacts and validation obligations below. These gates assess design compliance, not completed implementation.

| Principle | Evidence and required implementation checks |
| --- | --- |
| I. Linked, versioned artifacts | UUID ownership/source chains, local ADR endpoints, immutable scope, existing timestamps/history and validated snapshots; migration/identity regressions. |
| II. First-class decisions | Existing lifecycle/replacement/count rules and exact local links without inherited ADRs; decision/link tests. |
| III. Data protection | Root-first shared graph transaction, PUT/delete/history guards, exact named batches and retries; PostgreSQL races/rollback. |
| IV. Artifact-boundary quality | Domain, REST, persistence, adapter and format contracts with compatibility and browser checks mapped below. |
| V. Simplicity and accessibility | Existing stack/tables, bounded depth, shared helpers, native keyboard actions, text scope/type labels and established design system. |

No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/010-c4-component-diagrams/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/openapi.json
  contracts/ui-contract.md
  contracts/export-contract.md
  quickstart.md
  tasks.md                         # Future speckit-tasks output; not created here
```

### Source Code (repository root)

Existing paths to extend:

- `shared/src/domain/{types,c4,invariants,diagram-name,container-layout}.ts`, `shared/src/validation/schemas.ts`, `shared/src/index.ts`.
- `backend/src/persistence/{schema,diagram-repository,adr-repository,graph-transaction}.ts`; `backend/src/services/{diagram-service,container-context,adr-service,html-export-source,export-service}.ts`; `backend/src/api/{app,container-diagram-routes,diagram-routes,recovery-routes,export-routes,errors}.ts`.
- `frontend/src/api/diagram-client.ts`, `frontend/src/state/{diagram-store,diagram-list,adr-store,history}.ts`, `frontend/src/adapters/react-flow/diagram-adapter.ts`.
- `frontend/src/components/{DiagramWorkspace,DiagramCanvas,WorkspaceInspector,DiagramToolbar,ComponentNode,ContainerBoundaryNode,ContainerComponentForm,ExternalParticipantPicker,SavedDiagramList,RecoveryImpactDialog,DiagramSwitchDialog,ExportButton}.tsx` and `frontend/src/styles.css`.
- `shared/src/export/{html-snapshot,html-package-snapshot,html-package,package-links,diagram-page,adr-page,adr-markdown,container-labels,svg-layout,svg-export,mermaid-export}.ts`.
- `cli/src/{api-client,diagrams-command,export-command}.ts`, existing test directories and README.md during implementation.

Planned additions: `backend/drizzle/0007_c4_component_diagrams.sql`, `backend/src/services/component-context.ts`, `backend/src/api/component-diagram-routes.ts`, `frontend/src/components/C4ComponentForm.tsx`, Component-pattern tests under `shared/tests`, `backend/tests/{contract,persistence}`, `frontend/tests`, `cli/tests` and `e2e/tests`.

**Structure Decision**: Extend the existing shared/backend/frontend/CLI structure. Extract only small level/scope/geometry/hierarchy helpers. Domain coordinates stay absolute; synthetic visual boundaries are not persisted elements or endpoints.

## Phase 0: Research

Completed [research.md](research.md). Separate backend and frontend/export research examined depth-one assumptions, root-lock races, constraints, naming reconciliation, package sources and browser acceptance. Context7 checked Fastify, Drizzle and React Flow mechanisms. All technical unknowns and validation-scale/recovery decisions are resolved; no runtime dependency upgrade is required.

## Phase 1: Design and Contracts

Completed [data-model.md](data-model.md), [REST contract](contracts/openapi.json), [UI contract](contracts/ui-contract.md), [export contract](contracts/export-contract.md) and [quickstart.md](quickstart.md).

### Domain and persistence

Add explicit Component document/scope validation while preserving legacy missing-kind normalization and existing Container scope. Reuse generic artifact IDs and parent/owner/source columns. External sibling containers carry source-derived subtype/technology; people/systems retain immediate Container occurrence references and null subtype/technology. Keep general C4 type helpers separate from level-specific predicates.

Forward migration widens three named CHECK constraints, explicitly rejects null child boundary values, and preserves unique indexes/FKs. Reconcile Drizzle declarations with SQL's existing owner-parent composite and diagram parent/trash-root FKs. Cross-row kind/activity/source rules are locked service checks. Preserve stable upsert/diff behavior, identities and timestamps; no wholesale component deletion/reinsertion or backfill.

### Graph operations and recovery

Resolve the highest System Context root, lock it first, reread membership, then lock descendants by depth/UUID and validate. Every diagram/ADR mutation and consistent saved-export read shares this protocol/transaction. Eligibility is rechecked under lock; expected unique create conflicts are read after leaving the failed transaction.

Whole-document PUT, delete, omissions through undo/redo and source reclassification enforce active/recoverable dependencies at both levels. Application↔Datastore remains valid. Trash records the exact active descendant batch; restore confirms current IDs/batch, activates ancestor-first and validates before atomic commit. Earlier independent batches remain separate; deeply requested children may need another confirmation after ancestor recovery. Changed impact requires re-preview.

### Editor and hierarchy

Reuse guarded navigation and retained draft/history/ADR stores. Generalize scope-aware entry/naming/list/save response helpers; Container owner drafts must drive Component title previews before filtering/sorting. Keep stale-response guards and preserve newer edits. Reset level-specific forms on navigation. Reuse fitted boundaries/clearance without storing React Flow grouping in the domain. A blocked history removal preserves document and history cursor.

### Exports

Extend all validated renderers and ADR scope metadata to the Component role. Mermaid preserves semantic details, not exact geometry; empty Component Mermaid uses an actionable unsupported-empty error while HTML/SVG show an empty boundary. Browser packages gather bounded active descendants, apply only retained overlays ancestor-first and verify complete local links before ZIP creation. Context-only ancestors are hydrated but not bundled. CLI and single builders retain selected-only scope and flat UUID package paths.

### Validation responsibilities

| Requirements | Required checks |
| --- | --- |
| FR-001–005 | Pointer/keyboard entry, eligibility/source resolution, duplicate/racing creation, save cancel/failure and post-create load retry. |
| FR-006–010 | Required metadata/type rules, fitting/clearance as one history edit, endpoints, immediate/canonical source chains and source navigation. |
| FR-011–016 | Three-level list/filter/navigation/save placement, duplicate names, rename preview/response races, refresh and guarded history. |
| FR-017–021 | ADR lifecycle/local links, source dependency A, independent and ancestor recovery, stale confirmation, root trash/write races and rollback. |
| FR-022–023 | Single formats, empty/invalid cases, package membership/overlays/path registry, CLI scope and offline browser matrix. |
| FR-024–025 | Old artifact/migration preservation and Context/Container regressions; keyboard-only journeys, focus return, labels and contrast. |

PostgreSQL checks must run without skips; mocked/in-memory tests cannot prove database concurrency. WebKit automation supports but does not replace Safari product acceptance. Usability and performance require recorded observations.

## Post-Design Constitution Check

PASS for all five principles. Stable storage/reference integrity, dependency A, exact recovery, validation boundaries and accessibility have concrete artifact/test responsibilities. No unresolved clarification or unjustified gate failure remains. Migration application and implementation tests are future implementation/release gates.

## Complexity Tracking

No constitution violations require justification. Bounded hierarchy helpers and per-diagram export contexts are needed for this level; a generic graph engine, new editor and new services are unnecessary.

## Planning Artifact Review

Reviewed on 2026-10-08. Six generated Markdown documents have balanced code fences, no trailing whitespace or unresolved template/clarification markers, and 18 local links that resolve. The OpenAPI 3.0.3 JSON parses; all 12 paths/15 operations have required path parameters and successful responses, operation IDs are unique, required schema properties/array items are defined, and all 116 direct local/external schema/response references resolve. This is structural/reference validation, not execution against a runtime implementation or an independent full OpenAPI conformance validator.

Active feature remains spec 010 on branch 010-c4-component-diagrams; no tasks.md was generated. Pre/post-design constitution gates pass and extension hooks are absent. No application build, migration application or implementation test was run during planning. Next: speckit-tasks to generate dependency-ordered implementation work and its validation gates.
