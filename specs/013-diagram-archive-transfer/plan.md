# Implementation Plan: Lossless Diagram Export and Import

**Branch**: `013-diagram-archive-transfer` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Clarified specification in `specs/013-diagram-archive-transfer/spec.md`.

## Summary

Add browser export/import of one saved diagram's complete top-level hierarchy and recursively required complete dependency hierarchies, including Trash. A versioned UTF-8 JSON file carries all 69 fields across the eight existing artifact record types, retaining UUIDs, original metadata, microsecond timestamps, layout, ADR references, recovery provenance, and portable revision counters.

Use strict shared archive validation, raw transaction-scoped persistence operations, and three additive API endpoints. Prepare a coherent export once; review the exact import file and destination delta; capture a downloadable recovery file before replacing existing contents; then revalidate and apply atomically using the existing collection writer barrier. Recovery restores overwritten contents, keeps added diagrams, and blocks dependencies that would break.

## Technical Context

**Language/Version**: Existing TypeScript 5.8; Node.js 22 runtime (repository evidence uses 22.17.1); browser JavaScript through Vite.

**Primary Dependencies**: Existing React 19, Zustand 5, Fastify 5.4, Zod 3.25, Drizzle ORM 0.44 and node-postgres 8.16. No new package, framework, upload plugin, worker, queue, or authentication service.

**Storage**: PostgreSQL, existing eight artifact tables. One pending migration adds installation-local confirmation epochs and changes one source-reference unique index into an equivalent deferrable constraint. Retain applied migrations 0001–0008. Memory repositories retain unit/API parity without becoming production persistence.

**Testing**: Plan future Vitest domain/schema/service/HTTP tests, actual PostgreSQL isolated-schema migration/precision/constraint/rollback/race tests, and Playwright browser/keyboard workflows. This planning run does not execute application tests.

**Target Platform**: Existing desktop browser frontend, containerized API, managed PostgreSQL. Current PostgreSQL 17 documentation was consulted; do not change the deployed database version as part of this feature.

**Project Type**: Existing multi-package browser application: shared domain/validation, backend API/persistence, frontend editor. CLI has no new archive command; existing deletion remains protected against imported historical state.

**Performance Goals**: Initial local acceptance budget is p95 <5 seconds each for export preparation, preview, and committed apply over 20 samples after two warmups, using the representative graph described in [research.md](research.md). Exclude user and network time; report transaction/lock wait separately. These are targets, not measured results.

**Constraints**: Archive and generated recovery file <=8 MiB UTF-8 each; preview/import JSON envelopes <=24 MiB; archive JSON nesting <=64. Strict no-loss validation, exact original stored values, UUID stability, atomic persistence, explicit replacement consent, recovery acknowledgement, accessible keyboard use, no automatic commit retry. Operational epochs are local coordination metadata and are excluded from transport; portable artifact revision values remain exact.

**Scale/Scope**: Single-user first release. Representative acceptance collection: 100 diagrams, selected valid three-level hierarchy with 1,000 components, 1,000 relationships and 100 ADRs plus groups/links within the file boundary. Counts are performance fixtures, not search or format limits. Coarse collection writes may queue while preview/commit runs; no locks are held during review or download.

## Constitution Check

*Pre-research and post-design gate: PASS. No exceptions or unresolved design questions.*

| Principle | Pre-research gate | Post-design evidence |
| --- | --- | --- |
| I. Linked, versioned artifacts | Preserve stable identities and references; carry a declared format version. | Eight-table raw snapshots, typed UUID/pair identity, scope closure, destination-union validation, original timestamps/revisions and a recovery artifact. Local epochs distinguish operations without rewriting artifact history. |
| II. Explainable decisions | Preserve every ADR field, state, replacement and link. | Data model includes both link kinds and their timestamps, all lifecycle values, and existing valid replacement behavior. No new lifecycle restriction. |
| III. Protect architectural data | Review and confirm replacement; recover prior overwritten contents; no partial changes. | Bound exact-file review, complete removal counts, required recovery download/acknowledgement, atomic transaction, dependency blocks, stale-confirmation invalidation and uncertain-outcome handling. |
| IV. Verify artifact boundaries | Plan automated coverage for import/export, identity, precision, persistence and compatibility. | Quickstart maps all requirements and success criteria to schema, HTTP, real database and browser validation, including source swaps and older confirmation paths. Evidence remains an implementation gate. |
| V. Simplicity and accessibility | Reuse existing stack and interaction system; add only required functionality. | Three routes, JSON, existing locks/repos/dialog styling, no new dependency; one focused coordinator/review dialog with keyboard focus, labels and safe cancellation. |

The specification's preservation inventory governs architecture artifacts. Installation-specific epoch bookkeeping is excluded from portable values because importing its old value would revive stale destructive consent; this is coordination state, not a new artifact revision/history feature. The design preserves the existing `deletionRevision` rather than weakening its fidelity requirement.

## Project Structure

### Documentation (this feature)

```text
specs/013-diagram-archive-transfer/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  checklists/requirements.md
  contracts/archive.schema.json
  contracts/openapi.json
  contracts/http-and-ui.md
```

`tasks.md` belongs to the next `$speckit-tasks` phase and is not generated here.

### Source Code (repository root)

```text
shared/src/archive/
  types.ts                         # Eight raw record types, envelopes and outcomes
  validation.ts                    # Strict parse, primitive and graph validation
shared/src/index.ts                 # Export archive contracts
shared/src/domain/types.ts          # Trash/restore impact token additions
shared/src/validation/schemas.ts     # Existing confirmation shapes extended
backend/drizzle/0009_diagram_archive.sql
backend/src/persistence/
  archive-repository.ts             # Raw codecs and apply helpers; no editor projections
  diagram-repository.ts             # Five-table archive operations, epochs, memory snapshots
  adr-repository.ts                 # Three-table archive operations, raw link timestamps
  schema.ts                        # Epoch table, actual constraints
  graph-transaction.ts             # Reuse coordinated transaction-scoped repository pair
backend/src/services/
  archive-service.ts               # Closure, preview/delta/recovery/hash, atomic apply
  diagram-service.ts               # Include local epochs in all relevant confirmations
backend/src/api/
  archive-routes.ts                # Three routes, local limits and error boundary
  app.ts                           # Wire archive service/routes into existing repositories
  recovery-routes.ts               # Forward new Trash/restore impact tokens
frontend/src/api/
  archive-client.ts
  diagram-client.ts                # Trash/restore token forwarding
frontend/src/components/
  DiagramArchiveTransfer.tsx       # One workflow coordinator
  ArchiveReviewDialog.tsx          # Scope/impact/recovery acknowledgement
  DiagramWorkspace.tsx             # Mount coordinator and export action
  SavedDiagramList.tsx             # Import entry, active/Trash row export
  RecoveryCoordinator.tsx          # Existing impact-token caller
  RecoveryControls.tsx             # Older impact-token caller
frontend/src/state/
  diagram-store.ts                 # Affected retained draft/history/cache handling
  adr-store.ts                     # Affected retained ADR draft/history/cache handling
shared/tests/archive-*.test.ts
backend/tests/contract/diagram-archive-*.test.ts
backend/tests/persistence/diagram-archive-*.test.ts
frontend/tests/                     # Follow existing frontend state/component test layout
e2e/tests/diagram-archive-transfer.spec.ts
README.md                          # File scope, recovery and migration instructions
```

**Structure Decision**: Retain shared domain, visual adapter, export adapter and persistence/API boundaries. Raw archive rows are a separate transport adapter, not React Flow state or an enlarged editor document. Extend the existing paired repositories with transaction-scoped read/upsert/remove operations rather than introducing another durable artifact store or production storage backend. File names shown are intended task targets; reuse the nearest existing helper when implementation reaches them.

## Phase 0: Research Results

[research.md](research.md) resolves format, limits, precision, source/ADR constraints, snapshot consistency, import ordering, local epochs, older confirmation compatibility, exact-file fingerprinting and browser integration. Research agents inspected existing paths and retrieved current primary documentation with Context7. All design unknowns are resolved; no library upgrade is required.

## Phase 1: Design and Contracts

- [data-model.md](data-model.md): eight collections and all fields, raw primitives, scope closure, combined-state validation, local ledger, ordering, recovery and memory parity.
- [contracts/archive.schema.json](contracts/archive.schema.json): strict version-1 file structure. Runtime semantic checks supplement this schema.
- [contracts/openapi.json](contracts/openapi.json): three HTTP operations and request/result/error shapes, using OpenAPI 3.1 to share JSON Schema-compatible primitives.
- [contracts/http-and-ui.md](contracts/http-and-ui.md): exact-byte handling, confirmation semantics, legacy Trash/restore extension, errors, draft handling and keyboard workflow.
- [quickstart.md](quickstart.md): future implementation validation commands, fixtures, expected outcomes and evidence gates.

### Implementation sequence for task generation

1. Add shared raw record types, bounded file parser and strict primitive/graph validation, with fixtures covering all 69 persisted fields. Ensure unknown fields, duplicate JSON keys, case-normalized duplicate identities and unsupported primitives fail without normalization. Keep identities scoped by table as in current persistence.
2. Add migration 0009 and raw codecs/operations to both repository pairs. Preserve microseconds and signed-zero binary64, exact bigint and nullable/text values. Extend memory link/membership metadata and collection rollback snapshots, including the epoch ledger; update existing writers to maintain those sidecars. Export uses repeatable-read raw rows; memory uses coordinated cloned rows.
3. Implement scope closure and import's proposed combined graph/delta in the archive service. Raw reads are complete; validation projections never become output or writes. Upsert common identities and references before deleting stale owned endpoints. Respect actual SQL FKs and defer only source uniqueness. Preserve every destination-only diagram.
4. Add preview/recovery generation and commit fingerprint verification within collection coordination. Recovery includes the closure of every changed pre-existing diagram, with a deterministic reviewed time. Commit compares all data and epochs before writes, validates final state/deferred constraints, increments affected local epochs and commits once.
5. Extend all existing confirmation paths: new browser Trash/restore impact tokens, legacy epoch-zero fallback only, token forwarding in both UI paths, epoch inclusion in single/collection deletion, and tombstone retention across purge/reintroduction. Update shared types, strict schemas, callers, fixtures and HTTP compatibility tests together.
6. Register three routes with isolated 24 MiB request limits, strict envelopes and feature-local parser/error normalization. Preserve existing non-archive body limits and error contracts. Add the browser client/coordinator/review dialog, active/Trash export and empty-list import, save/discard handling, recovery acknowledgement, affected cache/history reset and post-commit refresh handling.
7. Complete the requirement-mapped validation in quickstart and update operational documentation. Do not claim precision/race/recovery safety from memory tests, recorded older-feature evidence, or database-gated skips.

## Validation and Delivery Gates

| Requirement group | Required evidence during implementation |
| --- | --- |
| FR-001–FR-005, FR-015 | One coherent export, declared closure, exact eight-table values, raw caches, UTC microseconds, maximum bigint, finite signed-zero layout, unsupported value/version errors. |
| FR-006–FR-008 | Case-insensitive stable UUID/pair identity, cross-table identity namespaces, file-local and combined graph validation, ownership refusal, both ADR link kinds. |
| FR-009–FR-014 | Complete impact and removal preview, cancellation, exact reimport, required recovery acknowledgement, source swaps, atomic replacement, retained children/dependencies, recovery choice B, rollback and stale confirmations across all older paths. |
| FR-016–FR-018 | Draft/save/discard, request sequence guards, known-commit refresh retry, uncertain outcome, keyboard focus/labels, real database and browser end-to-end behavior. |
| SC-001–SC-005 | Explicit before/after raw database comparisons for round trip, override, no-op and recovery; failure and race matrices with zero unintended mutation. |
| SC-006 | Record first-time-author completion results separately; automated keyboard coverage alone does not establish the 90% usability target. |

Before implementation completion: run focused meaningful suites, actual PostgreSQL migration/precision/race/rollback coverage, lint, build and relevant browser regressions. Broaden once to the full available suite after focused checks pass. Measure the stated scale budget and inspect archive/recovery size boundaries. Record skips, failures and unmeasured usability explicitly. Planning performs document/contract checks only.

## Complexity Tracking

No constitutional violations. The raw persistence adapter, source-constraint deferral and local epoch ledger are required by exact preservation and stale-consent protection. The design adds no accounts, workspaces, collaboration, streaming job service, clone mode, record-level conflict picker, CLI archive command, or revision browser.
