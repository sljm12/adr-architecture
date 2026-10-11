# Implementation Plan: CLI Diagram Deletion

**Branch**: `012-cli-delete-diagrams` | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-cli-delete-diagrams/spec.md`

## Summary

Extend the existing CLI with exact-name or UUID deletion, explicit Trash/permanent mode, preview and confirmation. Resolve targets on the backend, then execute against the resolved UUID. Add separate endpoints to retain existing browser Trash/restore contracts. Reuse GraphTransaction for atomic hierarchy mutation. Add a per-diagram revision counter so any affected saved edit invalidates confirmation, including ADR-only edits and edit/revert under equal timestamps.

## Technical Context

**Language/Version**: TypeScript 5.8; Node.js 22 (inspected runtime 22.17.1); existing ESM CLI.

**Primary Dependencies**: Existing Fastify 5, Drizzle ORM 0.44, node-postgres 8, Zod 3; Node util, readline/promises and crypto. No new packages.

**Storage**: PostgreSQL; existing in-memory repositories for development/tests. Add `0008_diagram_deletion_revision.sql`: internal `diagrams.deletion_revision bigint NOT NULL DEFAULT 0`. No confirmation table or tombstone storage.

**Testing**: Vitest schema, CLI, API, memory rollback and PostgreSQL migration/race/purge tests; existing Playwright recovery/save regressions plus stale-browser-save coverage where absent.

**Target Platform**: Windows/macOS/Linux Node CLI, interactive terminals and scripts; existing containerized API.

**Project Type**: CLI extension backed by existing web service.

**Performance Goals**: Planning validation budget: local PostgreSQL preview and execution each below 2 seconds p95 with 100 diagrams and an affected subtree containing 1,000 components/relationships and 100 ADRs, excluding user input. Record actual measurements; do not sacrifice correctness for the budget. User task target remains SC-005.

**Constraints**: One root per invocation; supported three-level hierarchy; exact name equality; explicit mode and confirmation; atomic changes; no automatic mutation retries. All public saved-data writers share graph locks and revision tracking. Direct administrative SQL is outside this concurrency protocol.

**Scale/Scope**: Existing single-user system. Search every eligible diagram without silent truncation; measurement fixture sizes are not product limits. No accounts, workspaces, bulk roots or graphical controls.

## Constitution Check

*Initial gate: PASS. Post-design gate: PASS. No exceptions required.*

| Principle | Evidence |
|---|---|
| Linked, versioned artifacts | Stable UUID ownership, internal revisions, external dependency checks and preserved references. |
| First-class decisions | Trash retains ADR lifecycle content; permanent warning includes ADRs; bulk owned ADR removal handles internal replacement chains. |
| Data protection | Recoverable Trash, explicit irreversible choice, confirmation checked under locks, atomic rollback. |
| Verified artifact boundary | Shared strict schemas, OpenAPI, CLI/HTTP workflows, real PostgreSQL concurrency/migration/deletion tests. |
| Simplicity/accessibility | Existing CLI/services/repositories/locks; no dependencies; keyboard confirmation and plain readable warnings. |

Permanent deletion was explicitly requested. Offering Trash and a separately confirmed irreversible mode retains the recoverable path without introducing backups.

## Project Structure

### Documentation (this feature)

```text
specs/012-cli-delete-diagrams/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  checklists/requirements.md
  contracts/cli.md
  contracts/openapi.json
```

The later speckit-tasks workflow creates tasks.md.

### Source Code (repository root)

```text
cli/src/main.ts                         # options and help
cli/src/api-client.ts                   # validated preview/execute writes
cli/src/delete-command.ts               # new confirmation flow
cli/src/output.ts                       # existing diagnostics/output
cli/tests/                             # command/client/help/HTTP tests
shared/src/validation/schemas.ts        # deletion boundary schemas
shared/src/domain/types.ts              # shared deletion types if needed
shared/src/index.ts                     # existing exports
backend/src/api/recovery-routes.ts      # additive routes
backend/src/api/errors.ts
backend/src/services/diagram-service.ts # preview/execute orchestration
backend/src/services/adr-service.ts     # owning revision in graphWrite
backend/src/persistence/diagram-repository.ts # revision and purge
backend/src/persistence/adr-repository.ts     # owned ADR/index purge
backend/src/persistence/graph-transaction.ts # root-independent rollback
backend/src/persistence/schema.ts
backend/drizzle/0008_diagram_deletion_revision.sql
backend/tests/contract/
backend/tests/persistence/
backend/tests/component-recovery-fixture.ts
backend/tests/persistence/component-test-database.ts
e2e/                                   # stale save regression if absent
README.md                              # command and migration guidance
```

**Structure Decision**: Extend existing boundaries; only a focused CLI command module is needed. Inspect callers, repository implementations, test doubles, fixtures and every hard-coded migration runner when extending interfaces. Existing list/export and browser recovery requests remain compatible.

## Implementation Design

1. Validate selector/mode; server resolves one eligible saved summary name exactly, including Container/Component owner-derived titles. Lock its canonical Context graph and recheck UUID/name/status before preview; do not reuse substring list filtering.
2. Discover/validate the subtree. Trash affects active members only; permanent affects all statuses. Load affected full diagrams, full ADRs/links and provenance through transaction-scoped repositories, bypassing active-only read service guards for Trash contents.
3. Return an opaque SHA-256 token covering version, resolved UUID, mode, displayed summaries, complete subtree membership/status, affected contents/provenance/revisions, and required ancestor/source dependencies. Sort object keys and unordered identity collections; retain meaningful ordering.
4. CLI displays impact, accepts interactive yes or explicit --yes, and executes once using UUID/mode/token. EOF, cancellation and absent non-interactive consent change nothing. Never re-resolve names at execution or automatically refresh/retry a rejected confirmation.
5. Execute takes existing graph locks, recomputes token and dependency checks, and mutates inside that same transaction. Trash retains existing provenance rules. Permanent rejects outside references and purges only authorized rows in foreign-key-safe leaf-first order.
6. Repository diagram writes (save/removal/Trash/restore) increment an internal per-diagram counter. Existing AdrService.graphWrite increments the owning counter after a successful create/update/link/delete, in the same transaction. Creation initializes it. Reject client counter writes; use decimal strings rather than JavaScript numbers.
7. Retain restrictive foreign keys. Bulk-remove owned ADR links/records without public single-ADR replacement blockers. Remove groups/members and relationships, then leaf components/diagrams. Clear internal trash-root references before removing batch roots; never modify external blockers.
8. Memory rollback must retain pre-action IDs and safely include new members without traversing a deleted root. Restore documents, provenance, revisions, ADR records and registration indexes. PostgreSQL rollback remains transaction-native.

## Validation and Delivery Gates

- Cover FR-001–FR-016 using [quickstart.md](quickstart.md); test contract schemas and real requests/responses rather than OpenAPI text presence alone.
- Include ADR-only edit, same-clock edit/revert, owner rename, queued saves/creates/restores and stale browser saves.
- Real PostgreSQL tests prove normalized row removal, unrelated preservation and rollback after descendant AND root removal; skipped tests do not prove these properties.
- Run full Vitest/build and browser recovery/save compatibility checks after focused implementation tests pass.
- Deploy additive migration 0008 before runtime; internal counters remain absent from existing documents/summaries/import/export.
- Reuse existing logging/configuration. No new telemetry or automatic retry infrastructure. Response loss after execution is uncertain: require saved-state verification before retry.
