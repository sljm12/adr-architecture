# Implementation Plan: CLI Diagram Deletion

**Branch**: `012-cli-delete-diagrams-phase-1-3` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-cli-delete-diagrams/spec.md`

## Summary

Extend the implemented single-root deletion with name-only `--all-matches` and `diagrams clear-trash [--yes]`. Preserve existing selector/mode behavior and endpoints. Add collection preview/execute endpoints using one transaction, one confirmation, and one unique affected set. Reuse existing revision counters, snapshot hashing, dependency inspection, and owned-artifact purge; add collection-level writer coordination to prevent new matches or Trash members during execution. No new dependency, table, or migration is required.

## Technical Context

**Language/Version**: TypeScript 5.8; Node.js 22 (inspected runtime 22.17.1); existing ESM CLI.

**Primary Dependencies**: Existing Fastify 5, Drizzle ORM 0.44, node-postgres 8, Zod 3; Node util, readline/promises and crypto. No new packages.

**Storage**: PostgreSQL and existing in-memory repositories. Migration 0008 and internal revision counters already exist; retain them unchanged. No new persistent entity, token table, or migration.

**Testing**: Vitest schema, CLI, API, memory rollback and PostgreSQL migration/race/purge tests; existing Playwright recovery/save regressions plus stale-browser-save coverage where absent.

**Target Platform**: Windows/macOS/Linux Node CLI, interactive terminals and scripts; existing containerized API.

**Project Type**: CLI extension backed by existing web service.

**Performance Goals**: Planning validation budget: local PostgreSQL preview and execution each below 2 seconds p95 with 100 diagrams and an affected subtree containing 1,000 components/relationships and 100 ADRs, excluding user input. Record actual measurements; do not sacrifice correctness for the budget. User task target remains SC-005.

**Constraints**: One root by default; multiple roots only for one exact name with `--all-matches`. Clear Trash targets all trashed diagrams and never active data. Supported three-level hierarchy, exact resolved-name equality, explicit consent, invocation-wide atomicity, and no automatic mutation retries. All public writers must participate in collection coordination before graph locks. Direct administrative SQL is outside the supported writer protocol.

**Scale/Scope**: Existing single-user system. Search every eligible diagram without truncation; include disjoint Context graphs and overlapping roots. Measurement fixture sizes are not product limits. No accounts, workspaces, arbitrary selector lists, or graphical controls. Collection preview/execution may briefly delay other writes; never hold locks while waiting for user input.

## Constitution Check

*Initial gate: PASS. Post-design gate: PASS. No exceptions required.*

| Principle | Evidence |
|---|---|
| Linked, versioned artifacts | Stable UUID ownership, internal revisions, external dependency checks and preserved references. |
| First-class decisions | Trash retains ADR lifecycle content; permanent warning includes ADRs; bulk owned ADR removal handles internal replacement chains. |
| Data protection | Recoverable Trash, explicit irreversible choice, full match/Trash membership checked under collection coordination, invocation-wide rollback and active-data protection. |
| Verified artifact boundary | Shared strict schemas, OpenAPI, CLI/HTTP workflows, real PostgreSQL concurrency/migration/deletion tests. |
| Simplicity/accessibility | Existing CLI/services/repositories/locks; no dependencies; keyboard confirmation and plain readable warnings. |

Permanent deletion and clearing Trash were explicitly requested. Offering Trash and a separately confirmed irreversible action retains the recoverable path without introducing backups. Post-design review confirms that collection membership guards, whole-invocation rollback and active-data protection satisfy the same gates; existing single-root APIs and artifact identities remain unchanged. No unresolved planning clarifications or gate violations remain.

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

Existing tasks.md records completed single-root work. Refresh it with speckit-tasks for the new stories; do not treat its old completion marks as evidence for this update.

### Source Code (repository root)

```text
cli/src/main.ts                         # options and help
cli/src/api-client.ts                   # validated preview/execute writes
cli/src/delete-command.ts               # extend existing confirmation/output flow
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
backend/src/persistence/graph-transaction.ts # collection transaction and ADR rollback
backend/tests/contract/
backend/tests/persistence/
backend/tests/component-recovery-fixture.ts
backend/tests/persistence/component-test-database.ts
e2e/                                   # stale save regression if absent
README.md                              # new flag/action and irreversible scope
```

**Structure Decision**: Extend existing command, service and repository modules; no new layer. Inspect all repository implementations/proxies/test doubles and public writer callers when adding collection transactions. Existing single-root list/export/deletion and browser recovery requests remain compatible. Database schema and migration runners remain unchanged.

## Implementation Design

1. CLI validates `--all-matches` only with `--name` plus one deletion mode. `diagrams clear-trash` accepts only `--yes`; it is explicitly permanent. Default single-root requests continue using existing endpoints and response shapes.
2. Add GraphTransaction.runCollection and repository withCollectionTransaction. PostgreSQL takes `LOCK TABLE diagrams IN SHARE ROW EXCLUSIVE MODE` before resolving any target. This conflicts with ordinary writes and prevents membership phantoms. Existing withGraphTransaction must acquire `ROW EXCLUSIVE` on diagrams before any graph row lock; top-level creation acquires it before writing. Audit all public writers for this table-before-row order, including ADR writers, which share graph coordination and revision updates. Use one transaction-scoped diagrams/ADRs pair for the complete invocation, never one transaction per selected root.
3. Memory uses one repository-wide writer queue for collection operations, graph transactions, and top-level creation. Transaction-scoped calls bypass reentry. Retain complete diagram/provenance/revision and ADR/registration snapshots for collection rollback, including empty collections and removal of all roots; queued writes resume after commit/rollback. Change synchronous creation callers/test doubles to await MaybePromise where needed.
4. Under collection coordination, resolve every eligible exact saved name (active only for Trash, either status for permanent) or all trashed diagrams for clear Trash. Zero name matches fail; empty Trash previews zero items and the CLI returns already-empty success without executing or prompting. Gather complete hierarchies, validate and hydrate owner-derived names, deduplicate by UUID, and order affected summaries by saved depth then UUID. Clear Trash includes only trashed UUIDs and rejects any active descendant or outside reference that would break.
5. Separate gathering/snapshot logic from dependency checking so checks run once against the complete union; references between selected roots are internal, not blockers. Reuse saved-state hashing, revisions and required ancestors. The versioned collection hash binds target/action/mode, sorted selected root IDs, full match or Trash membership, unique affected summaries/content/provenance/revisions, and required ancestor/source state. Changes to unrelated graphs do not alone invalidate confirmation. No token registry or expiry policy.
6. Collection execution carries the previewed target, root IDs and token. Recompute membership only to compare with the reviewed set; never authorize a substituted/new root. Rebuild token and dependencies inside collection coordination before any mutation. Reject any mismatch with DELETE_IMPACT_CHANGED and no automatic retry. Preview and execute are separate short transactions; user confirmation holds no locks.
7. Trash creates one existing recovery batch per outermost selected subtree; descendants selected by the same name are reported as roots but processed once. Disjoint subtrees are independently recoverable. Previously trashed descendants retain earlier provenance. Permanent deletion/clear Trash purge owned ADRs once for the complete set, then reuse foreign-key-safe deepest-first artifact/diagram purge with internal trash-root cleanup. Never cascade outside the authorized union.
8. Extend the existing CLI preview/prompt/result code for both new actions; validate response target, mode, selected roots, unique affected set and count. Empty clear-Trash previews have no execution. Nonempty actions accept interactive yes or explicit --yes, execute once, and report committed pre-action identities/counts; interrupted execution responses remain uncertain. Escape displayed terminal controls without changing selectors or logging tokens/ADR contents.

## Validation and Delivery Gates

- Cover FR-001–FR-021 and SC-001–SC-008 using [quickstart.md](quickstart.md); test strict schemas and real requests/responses rather than OpenAPI text presence alone. Preserve existing single-root contract tests unchanged.
- Include ADR-only edit, same-clock edit/revert, owner rename, queued saves/creates/restores and stale browser saves.
- Real PostgreSQL tests prove normalized row removal, unrelated preservation and rollback after descendant AND root removal; skipped tests do not prove these properties.
- Run full Vitest/build and browser recovery/save compatibility checks after focused implementation tests pass.
- Existing installations still require migration 0008; this update adds no migration. Internal counters remain absent from existing documents/summaries/import/export.
- Real PostgreSQL barriers must prove new matching Context creation, owner rename, Trash/restore, and ADR edits before versus behind collection coordination; add reverse root ordering and ordinary writer versus collection lock-order tests. No deadlocks, partial commits, or UUID resurrection are acceptable. Memory must prove queued creation survives rollback without being overwritten.
- Retain historical quickstart evidence as single-root evidence only. SC-006–SC-008 need new automated proof; SC-005 author trials remain unverified.
- Reuse existing logging/configuration. No new telemetry or automatic retry infrastructure. Response loss after execution is uncertain: require saved-state verification before retry.
