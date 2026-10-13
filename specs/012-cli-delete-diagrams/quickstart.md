# Validation Guide: CLI Diagram Deletion

## Update validation (2026-10-13)

The recorded phase evidence below covers the earlier single-root implementation only. --all-matches and clear-trash are planned, not implemented by this workflow. Use disposable data; clearing Trash permanently removes all retained diagrams and ADRs. Existing SC-005 participant evidence remains unverified; historical task completion does not prove SC-006–SC-008.

After implementing the update, retain the setup/check commands below and run the new scenarios through the real HTTP CLI, memory repositories, and PostgreSQL with database tests enabled. No new migration is required; retain applied migration 0008. Authoritative request/response fields are in [contracts/openapi.json](contracts/openapi.json), command syntax in [contracts/cli.md](contracts/cli.md), and entity rules in [data-model.md](data-model.md).

Create several exact-name Payments roots across Context graphs, matching parent/child names, near matches, mixed active/Trash statuses, independent recovery batches, and representative ADR replacements/links. Record complete saved state and raw normalized row counts before each destructive test; recreate fixtures between modes.

```powershell
npm run cli -- diagrams delete --name "Payments" --all-matches --trash
npm run cli -- diagrams delete --name "Payments" --all-matches --permanent --yes
npm run cli -- diagrams clear-trash
npm run cli -- diagrams clear-trash --yes
```

| Scenario | Expected result |
|---|---|
| Default duplicate name | Existing command refuses and lists candidates; guidance explains UUID or --all-matches. |
| Zero/one/several matches | Zero fails safely; one retains single-root scope; several select every eligible exact match and unique descendant union. |
| Eligibility and near matches | Trash selects active exact matches only; permanent includes trashed matches; partial/case/whitespace variants outside selected subtrees stay unchanged. |
| Overlapping and disjoint roots | Each UUID listed/processed once; selected nested matches still reported; restore each disjoint outermost Trash batch separately with identities/content intact. |
| Cross-root references | Dependencies wholly within the permanent union succeed; outside dependencies block the entire invocation without detachment. |
| Invalid flag/action usage | --all-matches with UUID/no name and clear-trash with selectors/modes/output flags exit 2 without mutation. |
| Empty Trash | Exit 0, already-empty message/count zero; no consent prompt or execution request, including without --yes. |
| Nonempty clear/cancel | Full named preview, irreversible warning/count; cancel/EOF/no scripted consent exit 1 with saved state unchanged. |
| Confirmed clear | Every trashed diagram/artifact/ADR/provenance row absent; active documents and owned artifacts unchanged. |
| Active descendant/external blocker | Clearing fails without any removal and identifies the blocker/next action. |
| Stale set/content | New matching root, owner rename, Trash/restore, or affected edit after preview rejects the whole action; queued supported edits remain intact. |
| Rollback across graphs | Inject failure after removing one subtree and after removing the last root; all documents, ADR/indexes, revisions and provenance restore in memory/PostgreSQL. |
| Interrupted result | Suppress response after actual commit; uncertain outcome advice, one execution only, no false rollback/success claim. |

Use two real PostgreSQL connections and barriers: writer commits before collection lock -> stale rejection; writer starts behind collection lock -> waits, then acts on post-operation state without resurrection. Cover top-level matching create, child create, owner rename, ADR/link writes and Trash/restore. Run overlapping/disjoint roots in opposite orders; verify table-before-row order prevents deadlocks. Memory queues must preserve unrelated creation that resumes after rollback. These tests must not substitute a single-graph transaction loop for invocation-wide atomicity.

After focused schemas/CLI/HTTP/persistence tests pass, run existing single-root list/export/recovery/save compatibility, full Vitest/build and relevant Playwright regressions. Record actual PostgreSQL runs separately from skipped tests. Measure the plan's p95 budget for overlapping matches, disjoint graphs and clear Trash; update SC-006–SC-008 evidence only from new checks. Do not overwrite historical evidence or claim usability trials from automated timings.

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

## Phase 6 scale and operational evidence (2026-10-13)

- T034 adds README examples for both selectors/modes, saved-only scope, migration 0008 before runtime,
  consent/cancellation/exit statuses, duplicate resolution and response-loss verification. Existing
  list/export/recovery configuration and guidance remain available. No runtime changes or dependencies
  are required for this phase; existing Git/Docker ignore rules cover generated test/build outputs.
- T035 adds `backend/tests/persistence/diagram-deletion-scale.test.ts`, using the existing deletion
  fixture and UUID-isolated migrated PostgreSQL schema helper. The selected four-diagram, three-level
  subtree contains exactly **1,000 components, 1,000 relationships and 100 linked ADRs**, within
  **100 saved diagrams**. Both modes use two warmups and 20 measured preview/committed-execution
  samples. Restoration/reseeding and assertions occur outside the timing intervals. Preview includes
  exact-name resolution and graph locking; execution includes token revalidation, mutation and commit.
  p95 uses the nearest-rank 19th sorted observation of 20; preview and execution each assert <2,000 ms.
- Standalone scale run: **1 test passed, zero skips**, 30.75 seconds. Environment: Windows x64,
  Node **22.17.1**, Intel Core **i7-13700H**, local **PostgreSQL 17.10** (MSVC 19.44, 64-bit),
  localhost **55412**, disposable `spec012-phase4-postgres-17` cluster/database, migrations 0001–0008.
  This is an in-process service measurement over local TCP PostgreSQL, excluding CLI input and HTTP
  transport. It establishes the local plan budget, not production/network latency or SC-005 usability.

| Mode | Preview p95 | Committed execution p95 | Separate budget |
|---|---:|---:|---:|
| Trash | 107.19 ms | 129.09 ms | <2,000 ms each: PASS |
| Permanent | 113.37 ms | 197.31 ms | <2,000 ms each: PASS |

- The same test grows the saved collection to 105 diagrams and resolves a late exact-name target;
  at 106 diagrams it refuses a duplicate root name with candidate diagnostics. Fixture size is not
  a search limit. The first run failed only on this new test's incorrect expected error field/code;
  correction to the existing `detail` / `DELETE_NAME_AMBIGUOUS` contract required no runtime change.
- Final scale-only check after adding an explicit assertion that the late target occurs beyond the
  first 100 saved entries: **1 passed, zero skips**, exit 0, 31.34 s (`spec012-phase6-scale-final.log`).
  Trash preview/execution p95 **104.96/126.72 ms**, permanent **111.03/237.41 ms**; all budgets pass.
- Raw samples and environment are emitted as `Spec 012 PostgreSQL deletion scale:` in test output;
  local transcript: `spec012-phase6-scale.log` (ignored generated output). To repeat:

```powershell
$env:DATABASE_URL = '<dedicated disposable PostgreSQL database URL>'
$env:RUN_POSTGRES_TESTS = '1'
npm test -- backend/tests/persistence/diagram-deletion-scale.test.ts
```

## Phase 6 regression results (T036, 2026-10-13)

| Check | Result | Local generated transcript |
|---|---|---|
| Focused stories, CLI/schema/API and complete persistence suite with actual PostgreSQL | **33 files / 317 tests passed, zero skips**, exit 0, 51.13 s | `spec012-phase6-focused.log` |
| Full `npm test`, database gating disabled for this separate run | **127 files passed / 761 tests passed / 109 database-gated skips**, exit 0, 63.91 s | `spec012-phase6-full.log` |
| Full `npm run build` (shared/backend/frontend/CLI) | **PASS**, exit 0 | `spec012-phase6-build.log` |
| Recovery/save/list/export Playwright regressions | **22 passed, zero skips**, exit 0, 58.1 s | `spec012-phase6-browser.log` |
| `git diff --check` | **PASS** | Terminal output |

The database run used `RUN_POSTGRES_TESTS=1` and the dedicated disposable local PostgreSQL cluster
described above, using its `spec012` role/database and isolated schemas; existing public-table
regressions used that cluster's previously migrated public tables. No application database or
connection configuration changed. The full unit suite's database skips are **not** database passes;
the separate complete persistence run supplies actual migration, rollback, purge and race evidence.
The scale test passed again during the combined run despite concurrent unit/build load: Trash
preview/execution p95 **207.60/242.79 ms**, permanent **209.71/416.69 ms**.

Reproducible focused run (with the dedicated database URL and `RUN_POSTGRES_TESTS=1` configured):

```powershell
npm test -- cli/tests shared/tests/diagram-deletion-validation.test.ts backend/tests/contract/diagram-deletion.test.ts backend/tests/contract/diagram-deletion-stale.test.ts backend/tests/persistence
```

Playwright used the existing `playwright.component.config.ts` headless Chromium harness and frontend
server, with seven files: `component-diagram-persistence`, `component-diagram-recovery`,
`create-edit-reopen`, `saved-diagrams`, `diagram-list-management`, `recovery`, and `mermaid-export`.
The two real HTTP/PostgreSQL workflows ran without skips, proving a permanently removed UUID cannot
be recreated by an open browser's stale save and proving ADR/save/reopen/exact recovery compatibility.
Memory browser cases cover both deletion modes and saving the retained draft after Trash restoration.
Listing/filtering/duplicate identities, draft guards, component/relationship recovery and Mermaid
success/error feedback also pass. This targeted run does not establish every browser engine or the
entire E2E suite.

Existing pg concurrent-query deprecation, frontend bundle-size and terminal color warnings remain;
none caused failures. The sandbox shell helper could not start, so commands ran outside it after
approval; the prerequisite script used a process-only execution-policy bypass. Existing app servers
were retained; the initially stopped disposable PostgreSQL cluster was stopped again after checks.
No `.specify/extensions.yml` exists; pre/post implementation hooks are skipped.
No blocking automated evidence remains for phase 6; **SC-005 remains unverified** as recorded below.

Use disposable data; permanent deletion is irreversible.

## Phase 6 success-criterion review (T037, 2026-10-13)

SC-001–SC-004 pass for the recorded automated validation cases; this is bounded evidence from the
tested workflows, not a claim about every possible input. The focused run below has no failures or
database skips. Existing story assertions check complete before/after state and unrelated data,
not just successful status codes.

| Criterion | Recorded workflow evidence | Outcome |
|---|---|---|
| SC-001: intended target or safe refusal | CLI deletion (42 cases), API client (13), help (4), HTTP deletion (19), stale/exact-name tests (46), plus late target/duplicate scale checks; literal case/whitespace/Unicode/UUID-shaped names, UUID parity and eligible duplicate statuses | All tested targeting cases pass; no unintended selection |
| SC-002: recoverable identity/content retention | Trash persistence (4 cases, memory and PostgreSQL), graph/revision rollback, and existing three-level recovery/browser regressions; full document/ADR/link equality and earlier batch provenance | All tested Trash/restoration assertions pass |
| SC-003: complete scoped purge | Purge persistence (28 cases, including 14 actual PostgreSQL cases), raw normalized-table absence, mixed-status subtree/child scope, replacements, owner-slot reuse and unrelated preservation | All tested removal/preservation assertions pass |
| SC-004: safe non-success | Strict boundaries (10 cases), CLI cancellation/EOF/interruption/non-TTY/usage/HTTP response loss; 46 stale cases, 30 actual PostgreSQL barrier races, dependency/rollback tests and stale-browser draft retention | All tested rejection/atomicity assertions pass; uncertainty never claims rollback or retries |
| SC-005: ≥90% of first-time authors finish within two minutes using help only | **0 participants available; completion times N/A; completion percentage N/A** | **UNVERIFIED**; automated help tests and service timings are not participant evidence |

Pending SC-005 protocol: recruit at least 10 representative first-time architecture authors. Use
fresh disposable hierarchies per participant, including duplicate/near names and mixed active/Trash
descendants. Assign a named intended root and mode; permit built-in CLI help only, without coaching
or separate instructions. Start the timer when the task is shown, stop after committed intended
deletion, and record participant identifier, selector/mode/consent correctness, elapsed seconds,
wrong selections, cancellation/failure and assistance. Report correct unassisted completions within
120 seconds divided by all participants; at least 9 of 10 must succeed. Participation scheduling
and execution remain pending with the project maintainer. No author trials were fabricated or
messages sent to recruit participants. T037's allowed explicit-unverified outcome is used; passing
the full product usability gate still requires those trials.

## Setup

Use Node.js 22, repository dependencies and a dedicated PostgreSQL database. Follow README for pending migrations 0001–0007; retain applied migrations. Apply existing migration 0008 only if not yet applied; this update adds no migration:

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

## Phase 7–8 collection foundation audit (T038–T045, 2026-10-13)

This evidence covers the collection foundation only. The all-matches and clear-trash commands,
HTTP routes and confirmed collection mutations remain in phases 9–10. The private collection
snapshot helper is exercised under `GraphTransaction.runCollection`; no lock spans CLI input.

| Supported entry points | Coordination and affected callers |
|---|---|
| `DiagramService.create` | API `diagram-routes.ts` already awaits MaybePromise creation. PostgreSQL top-level INSERT takes ROW EXCLUSIVE before writing; memory creation waits behind any queued writer. |
| `DiagramService.save`, component/relationship removal | Existing `graph.run` now takes the table writer barrier before graph discovery and row locks; existing validation and revisions remain intact. |
| Container/Component create-or-open | `container-context.ts` and `diagram-service.ts` already await transaction-scoped `diagrams.create`; owner-slot and ancestor checks remain inside graph coordination. |
| Browser Trash/restore and single-root CLI deletion | Existing recovery and deletion graph transactions adopt the same writer barrier; snapshot hashes remain version 1 with the same canonical contents and ordering. |
| ADR create/update/link/relationship-link/remove | `AdrService.graphWrite` retains one diagram/ADR transaction and the owning revision increment; it inherits table-before-row ordering. |
| Graph reads, hydration and HTML export capture | Existing coordinated read paths also use the ordinary graph barrier, preserving their coherent snapshots. |
| Collection discovery and future execution | `withCollectionTransaction` takes SHARE ROW EXCLUSIVE before discovery and supplies one scoped diagram/ADR pair. Nested graph/collection calls reuse that collection transaction; promotion from an ordinary graph transaction is refused before a lock-order inversion. |

The audit searched all DiagramRepositoryLike implementations, service/API callers and test proxies.
There are two implementations and no independent object-literal repository doubles to rebuild.
`html-export-source-fixtures.ts::scopedRepository` now wraps collection transactions as well as
graph transactions. Graph-only instrumentation in `container-diagrams.test.ts`,
`container-recovery.test.ts`, `html-export-source.test.ts` and `diagram-deletion-concurrency.test.ts`
continues to instrument ordinary graph calls and forwards other methods with their receivers intact.

Memory uses one repository-wide writer queue with async-context reentry limited to an active
transaction. Idle `create` stays synchronous to retain `componentRecoveryFixture`, `sourceFixture`,
legacy synchronous repository tests and E2E fixture setup compatibility. Production creation callers
already await MaybePromise; the new queued-create test awaits it explicitly. The old independent-root
memory transaction test now releases the first transaction before awaiting the queued unrelated
diagram/ADR writer and still checks that rollback preserves its committed changes.

Collection memory rollback restores all documents, provenance and bigint revisions even after the
last root disappears, plus complete ADR records and registration indexes. It also removes entries
created within the failed transaction. Queued unrelated creation and ordinary graph/ADR writes
resume after rollback and survive. PostgreSQL rollback uses one executor for both repositories.
Direct fixture seeding and administrative SQL remain outside the public writer/revision protocol.

`collectionDeletionFixture` retains the original fixture API and adds two populated disjoint graphs,
six nested/exact matching roots, near names, independent Trash batches, cross-root internal/external
ADR references and an active-descendant blocker. Full snapshots include documents, ADR content,
provenance, revisions and memory registration indexes.

Shared collection schemas are exported through the existing `shared/src/index.ts` wildcard. They
enforce strict tagged targets, literal names, sorted unique reviewed roots, all matching roots in
the affected set, unique absolute-depth/UUID ordering, counts, mode/status eligibility and empty
clear-Trash boundaries. No revision or ADR contents enter public deletion responses. The reusable
service helpers gather validated hierarchies, inspect dependencies once over the full union and
hash version-2 target/mode/root/membership/content/revision/provenance/ancestor snapshots. Internal
cross-root references are permitted; outside references and active descendants block removal.

Setup verification found existing `.gitignore` and `.dockerignore` cover the required project and
build artifacts. There is no ESLint, Prettier, Terraform or Helm configuration needing additional
ignore files; the private npm packages are not published. Migration 0008 and every existing migration
runner are reused unchanged; this update adds no migration or dependency.

### Phase 7–8 validation results

| Check | Final result | Evidence |
|---|---|---|
| New schemas and collection coordination/snapshot tests | 4 schema cases and 22 transaction/snapshot cases passed, including 11 actual PostgreSQL cases | Included in the database regression log below |
| PostgreSQL persistence plus single-root HTTP/schema compatibility | **28 files / 265 tests passed, zero skips**, exit 0, 85.70 s | `spec012-phase78-postgres-regressions.log` |
| Full `npm test -- --maxWorkers=2` | **129 files / 776 tests passed / 120 database-gated tests skipped**, exit 0, 85.54 s | `spec012-phase78-full-unit.log` |
| `npm run build` | Shared, backend, frontend and CLI production builds passed, exit 0 | `spec012-phase78-build.log` |
| `git diff --check` | Passed | Final workspace verification |

Reproduce the database run with a dedicated disposable `DATABASE_URL` and `RUN_POSTGRES_TESTS=1`:

```powershell
npm test -- --maxWorkers=2 backend/tests/persistence shared/tests/diagram-deletion-collection-validation.test.ts shared/tests/diagram-deletion-validation.test.ts backend/tests/contract/diagram-deletion.test.ts backend/tests/contract/diagram-deletion-stale.test.ts
```

Environment: Node 22.17.1, Windows, Intel Core i7-13700H, local PostgreSQL 17.10 on port 55412.
Reused the stopped disposable `spec012-phase4-postgres-17` cluster and its existing `spec012` role;
created a dedicated `spec012_phase78` test database and UUID-isolated schemas using migrations
0001–0008. Public tables in this new test database were migrated for legacy persistence tests.
The cluster's `pg_ctl start` restricted-token error was bypassed by running its existing binary
as a hidden process; the cluster was returned to its original stopped state after validation.
No application database configuration changed. The standard shell helper failed at startup, so
commands ran through the available Node runner. Prerequisites used a process-only PowerShell
execution-policy bypass. There are no pre/post extension hooks.

Tests first failed for absent collection schemas and `runCollection`. A further test demonstrated
that promotion from a graph transaction could bypass the collection barrier; both implementations
now reject that promotion while allowing collection-scoped reentry. Actual PostgreSQL barriers
observe waiting table locks and verify those waiters have no earlier RowShare graph lock. Coverage
includes opposite graph orders, top-level creation, save, child-open and ADR writes, full rollback
after every root disappears, queued writer survival, complete-union dependencies, membership and
ADR/revision/ancestor hash changes, unrelated-graph stability and active-descendant refusal.

The initial concurrent unbounded-worker checks exposed the legacy independent-memory-writer test's
now-invalid ordering and CPU-contention startup timeouts. Updated that test to await the queued
writer after releasing the first transaction; bounded-worker reruns passed without increasing
timeouts. Existing pg concurrent-query deprecation and frontend chunk-size warnings remain.
The legacy single-root scale regression passed again (Trash preview/execute p95 132.82/160.95 ms;
permanent 139.64/303.50 ms); these are not collection-action performance evidence.

Database-gated unit skips are not passes; the separate enabled persistence run provides actual
database foundation evidence. Browser E2E and first-time-author trials were not rerun for this
backend/shared foundation update. SC-005 remains unverified, and collection command/race/scale
acceptance evidence belongs to the remaining phases. Short collection transactions deliberately
delay supported writers; preview/execution must remain separate from user confirmation.
