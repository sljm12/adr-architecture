# Validation Guide: CLI Diagram Deletion

## Writer and revision coverage (T001)

| Public writer | Coordination / repository operation | Revision coverage |
|---|---|---|
| Context create | DiagramService.create / create | Initialize zero |
| Container/Component create | ContainerContextService.createOrOpen / DiagramService.createOrOpenComponentDiagram, GraphTransaction / create | Initialize zero; subtree membership guards creation |
| Diagram/component/relationship/group/metadata save | DiagramService.save, GraphTransaction / replace | Increment owning diagram |
| Component/relationship removal | DiagramService.removeComponent/removeRelationship, GraphTransaction / removeComponent/removeRelationship | Increment on successful removal only |
| Trash/restore | DiagramService.trash/restore, GraphTransaction / trash/restore | Increment each changed member |
| ADR create/update/component links/relationship links/delete | AdrService.graphWrite, GraphTransaction / AdrRepository | Increment owning diagram after success, same transaction |

Affected implementations: `backend/src/persistence/{diagram-repository,adr-repository,graph-transaction,schema}.ts`; services `diagram-service.ts`, `adr-service.ts`, `container-context.ts`, `component-context.ts`; API `recovery-routes.ts`, `errors.ts`; CLI `main.ts`, `api-client.ts`, new `delete-command.ts`; shared validation exports. Repository test doubles use subclasses or bound proxies (`backend/tests/html-export-source-fixtures.ts`), so new methods inherit/delegate. Direct fixture ADR writes are not public writers. Memory rollback must restore registration indexes as well as records.

Migration runners updated: `backend/tests/persistence/component-test-database.ts`, `container-diagrams.test.ts`, `container-editing.test.ts`, `container-recovery.test.ts`, and `html-export-source.test.ts`. Deliberate pre-0007 fixtures retain their component-migration boundary; the additive counter is present whenever updated repositories run. The 0008 migration test seeds raw pre-counter rows. Shared-database tests require all runtime migrations applied by their test harness. No public/import/export document accepts the internal counter. Existing ignore files cover Node/build/coverage/environment and Docker outputs; repository is private, so no publishing ignore file is needed.

## Phase 1–3 implementation evidence (2026-10-12)

- Branch: `012-cli-delete-diagrams-phase-1-3`; T001–T020 deliver recoverable Trash only. Permanent execution remains unavailable pending Phase 4.
- T003/T004 and T011–T013 tests were written first and failed on the missing schemas/revision APIs/endpoints/CLI flow, then passed after implementation. Actual readline yes/EOF/Ctrl+C tests prove no execution on cancellation.
- Actual PostgreSQL 17.4 tests ran against newly created UUID-named disposable databases, with migration 0001–0008 and isolated schemas. Migration preservation/default/non-negative/large counters passed. Writer coverage includes all diagram/ADR writes, same-clock edit/revert, failed link/write rollback and failure during revision increment. Trash/restore retains all artifacts/ADRs/links and earlier batch provenance; injected mid-batch failure rolls back documents, provenance and revisions.
- A broader PostgreSQL run passed 59 revision/graph/Container recovery/editing/export tests. New migration plus existing Component migration passed 5 tests; new Trash persistence passed all 4 tests (both memory and PostgreSQL, no database skips).
- Production `npm run build` passed (existing frontend bundle-size warning). Backend, frontend and CLI suites completed separately (190, 211 and 55 tests respectively at that checkpoint; database-disabled skips are not database evidence).
- The first full-suite attempts were stopped by a 50-second process limit while the existing two-minute aggregate HTML scale test was still running; these are not recorded as passes.
- Final full suite: 125 files passed, 12 database-gated files skipped; **665 tests passed, 64 skipped**, exit 0, 53.63 seconds. The aggregate scale test completed in 51.66 seconds. Skips are not substituted for the real PostgreSQL evidence above. Subsequent strict-summary and reserved-mode checks use the focused Phase 1–3 suite.
- Final focused Phase 1–3 checks: **59 passed, 3 database-gated skips**; final real PostgreSQL persistence suite: **20 files / 105 tests passed, zero skips**, exit 0, 30.00 seconds, including every new database case. Final production build and `git diff --check` passed. Existing pg concurrent-query deprecation and frontend bundle-size warnings remain.
- Phase 4–6 permanent purge, dedicated deletion race/scale proofs, first-time-author trials and Playwright validation remain outside this increment; their task markers stay unchecked. Apply migration 0008 before starting updated runtime against an existing database.

## Phase 4 implementation evidence (2026-10-12)

- T021–T027 are complete. Permanent previews and confirmed execution include active and trashed descendants; child selection preserves ancestors, siblings and the outside owner. Existing recovery routes already dispatch through `DiagramService`, so no route change was necessary. Repository proxies/subclasses inherit the added operations.
- Tests were written first: 21 cases failed on unavailable permanent execution or absent dependency checks. The implemented flow then passed HTTP/OpenAPI and CLI checks for both selectors, irreversible warnings, committed summaries, dependency diagnostics and uncertain responses without retries or success claims.
- `diagram-deletion-purge.test.ts`: **28 tests passed**, including **14 actual PostgreSQL cases**. Raw normalized artifact/link/group tables are empty after whole-graph purge; the sole unrelated diagram retains null provenance. Memory documents, provenance, counters and ADR registration indexes are removed. Internal replacement chains succeed; outside parent/owner/source/endpoint/group/Trash-root/ADR-link/replacement references block without detachment, including trashed outside owners.
- Failure injection verifies that the descendant or root is physically absent before throwing, then proves complete rollback of documents, ADRs/links/indexes, revisions and prior batch provenance. Unexpected restrictive constraints become actionable dependency errors after rollback. Child purge frees the owner slot for a new UUID.
- Database environment: disposable local **PostgreSQL 17.10**, localhost port 55412, isolated UUID-named schemas with migrations 0001–0008; existing public-table regressions used the same disposable cluster with those migrations. The configured port 5432 was offline, and the installed PostgreSQL 18 lacked initialization files, so temporary PostgreSQL 17 binaries were used without changing project dependencies. An initial broad database run failed two legacy suites because public tables were not yet migrated; migration and rerun resolved both setup failures.
- Final focused database/persistence/HTTP/CLI run: **29 files / 211 tests passed, zero skips**, exit 0, 20.29 seconds. Full unit suite: **126 files passed / 696 tests passed / 78 database-gated skips**, exit 0, 62.94 seconds; these skips are separate from the actual database evidence. Production `npm run build` and `git diff --check` passed. Existing pg concurrent-query deprecation and frontend bundle-size warnings remain.
- Existing browser save/reopen, exact three-level recovery, draft protection, saved-diagram listing and Mermaid export regressions: **10 passed**, zero skips, 30.9 seconds using `playwright.component.config.ts`; the real HTTP/PostgreSQL workflow used an isolated migrated schema. Existing application servers were left running.
- No `.specify/extensions.yml` exists, so pre/post implementation hooks were skipped. Phases 5–6 remain unchecked: dedicated deletion race/stale-browser/scale proofs, operational documentation and first-time-author trials are outside this increment.

## Phase 5 implementation evidence (2026-10-12)

- T028–T033 are complete. CLI/help now describe both available modes, exact selectors, eligible duplicate statuses, saved-only recursive scope, consent and uncertain-outcome verification. Invalid-option diagnostics escape terminal controls while retaining readable line breaks. A second deletion queued behind permanent removal now returns `DELETE_NOT_FOUND` instead of advising repair of an already removed hierarchy. Existing public writer guards passed the new tests without further changes.
- Tests were written first. Help failed on the obsolete reserved-permanent wording; invalid-option output failed terminal safety; the real queued-second-delete test failed with `DIAGRAM_REFERENCE_BROKEN`. Each passes after its focused fix. Initial stale-test fixture errors (invalid boundary geometry, comparison of unordered diagram lists, and a whitespace name normalized by existing read behavior) were corrected without changing production validation/name normalization. Literal padded selectors remain unnormalized and refuse a different resolved saved name.
- `diagram-deletion-stale.test.ts`: **46 HTTP/service tests passed**, covering both modes, component/relationship/group/metadata changes, ADR and both link kinds, frozen-clock edit/revert with the original document restored, root/owner/ancestor/source changes, membership/status/provenance changes, mismatched root/mode/token, removed roots, unrelated graph edits, exact Unicode/punctuation/UUID-shaped names and eligible-status duplicate diagnostics. Rejected operations preserve saved edits.
- CLI tests use a listening HTTP server and a barrier after preview for interactive and `--yes` stale consent in both modes. Response suppression after actual commit verifies uncertainty advice and exactly one execution request. Malformed/mismatched responses, candidate UUID/status output, invalid usage, terminal controls, streams and exit statuses are covered. Final CLI regression suite: **7 files / 78 tests passed**, zero skips.
- `diagram-deletion-concurrency.test.ts`: **30 actual PostgreSQL tests passed**, zero skips. Two connections queue on the canonical graph lock for save, create-child, ADR updates, component-link updates, ancestor rename, Trash and restore in both modes, plus competing deletion confirmations. Barriers observe PostgreSQL lock waits for the isolated schema rather than assuming ordering from a delay. Writes committed before deletion invalidate consent; writes queued behind deletion fail without partial edits or UUID resurrection.
- Database environment: reused the stopped Phase 4 disposable **PostgreSQL 17.10** cluster on localhost port 55412, using its existing `spec012` role and per-test UUID schemas migrated through 0008. Initial attempts with `postgres`/`Stephen` failed because those roles do not exist; the existing owner was identified before successful execution. No configured application database or connection settings were changed.
- Focused deletion/CLI/schema/persistence/graph regression run: **14 files / 225 tests passed**, zero skips, 16.31 seconds (before the final additional terminal-control case, separately covered by the 78-test CLI run). Includes the complete new race matrix and existing purge/rollback/Trash/restore tests.
- Playwright using `playwright.component.config.ts`: **5 passed**, zero skips, 24.9 seconds. New memory tests cover stale browser saves after both modes and saving the retained draft after Trash restoration. New real HTTP/PostgreSQL coverage verifies permanent removal rejects a stale open-browser save, visibly retains the draft and does not recreate its UUID. Existing save/reopen/ADR/recovery workflows pass.
- Final full unit suite: **127 files passed / 761 tests passed / 108 database-gated tests skipped**, exit 0, 58.74 seconds. The first broad run encountered the configured offline localhost:5432 database in a legacy suite that gates on `DATABASE_URL` alone; rerunning with that variable empty resolved the environment issue. Skips are separate from the actual PostgreSQL evidence above. Production build, final CLI rebuild and `git diff --check` passed. Existing pg concurrent-query deprecation and frontend bundle-size warnings remain.
- No `.specify/extensions.yml` exists; pre/post hooks were skipped. Phase 6 tasks T034–T037 remain unchecked: operational README updates, dedicated deletion scale measurements, the complete Phase 6 validation run and first-time-author trials are outside this increment.

Use disposable data; permanent deletion is irreversible.

## Setup

Use Node.js 22, repository dependencies and a dedicated PostgreSQL database. Follow README for pending migrations 0001–0007; retain applied migrations. Then apply the planned additive migration before updated runtime:

```powershell
npm install
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/drizzle/0008_diagram_deletion_revision.sql
npm run build
npm run dev
```

DATABASE_URL belongs in the API process environment. In-memory tests do not prove durability/database race safety. ADR_DIAGRAM_API_URL defaults to http://localhost:3000.

## Automated checks

```powershell
npm test -- cli/tests backend/tests/contract shared/tests
$env:RUN_POSTGRES_TESTS = '1'
npm test -- backend/tests/persistence
npm test
npm run build
npm run test:e2e
```

Database helpers must include migration 0008 in isolated schemas. Confirm database tests run rather than skip. Reuse component-recovery-fixture and graph-transaction tests; include existing list/export/ADR/recovery/save regressions.

## Workflow fixture

Create disposable Payments Context, Container and Component hierarchy, mixed active/independently trashed branches, populated groups/relationships and all ADR statuses with replacements and both link kinds. Add unrelated Payments API, payments, duplicate names and a UUID-shaped name. Record UUIDs.

| Scenario | Action and expected result |
|---|---|
| Exact name/cancel | diagrams delete --name "Payments" --trash; decline. Correct root/active descendants preview; exit 1, no changes. |
| UUID parity | Replace --name with --id <uuid>; same affected set. |
| Trash/recovery | Confirm Trash; restore through existing application. UUIDs/content/references retained; earlier Trash batch unchanged. |
| Permanent | --id <uuid> --permanent from active and trashed roots. Confirm warning; entire selected subtree absent from active/Trash, unrelated data intact. |
| Scripts | --yes still previews; redirected input without --yes fails promptly. |
| Duplicate/near names | Duplicates show candidates and fail; partial/case/whitespace variants never select a root accidentally. |
| Invalid usage | Missing/conflicting modes/selectors, repeated options or malformed UUID exit 2; no mutation request. |
| Child root | Only subtree removed; ancestors/siblings/owner component preserved. |
| Saved changes | Pause at prompt and edit/save content or ADR. Confirm → stale rejection and fresh preview required. |
| Inherited name | Rename parent owner after child preview → stale rejection and new resolved name. |
| Response loss | HTTP fixture suppresses response after commit → uncertainty diagnostic, no automatic retry. |

Prefix actions with npm run cli --. Scripted stale tests need an HTTP barrier between preview and execution. Include edit/revert under frozen clock and ADR/link-only edits; counters must invalidate old previews.

## Persistence and concurrency proof

- Exercise strict request/response schemas and root/mode/token mismatch through [OpenAPI](contracts/openapi.json).
- Verify raw residual counts in every normalized artifact table, internal replacements and trash-root references, plus unrelated preservation and external blockers.
- Inject failure after descendant AND root removal; memory and PostgreSQL restore documents, ADR/indexes, provenance and revisions.
- Two database connections: writer before delete locks → stale rejection; writer queued behind deletion → missing/inactive failure with no UUID resurrection. Cover save, create-child, ADR links, Trash/restore and ancestor rename.
- Migration preserves original identities/timestamps/artifacts; counters default zero and increase on supported writes; failures roll back increments.
- Keep deleted diagram open in browser: stale save fails clearly while preserving local draft; never recreates removed UUID.
- Measure p95 fixture budget from plan.md; record actual database/network environment. SC-005 needs representative first-time-user validation, not just automated checks.

See [CLI contract](contracts/cli.md) and [data model](data-model.md) for authoritative fields and behavior.
