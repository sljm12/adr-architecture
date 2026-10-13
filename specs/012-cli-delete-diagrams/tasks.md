# Tasks: CLI Diagram Deletion

**Input**: Design documents from `specs/012-cli-delete-diagrams/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli.md`, `contracts/openapi.json`, `quickstart.md`, and `.specify/memory/constitution.md`.
**Tests**: Required by FR-016, FR-021, and the constitution. Write the tests before their implementation and verify that they fail for the intended reason. PostgreSQL tests must actually execute; skipped database tests do not prove atomicity or concurrency safety.
**Organization**: Shared safety prerequisites followed by independently testable story increments. All paths are relative to the repository root. Extend existing modules and fixtures; no new dependencies, public document fields, token registry, authentication, or UI controls.

**Updated**: 2026-10-13. T001–T037 retain completed single-root implementation history; their marks do not prove the expanded scope. Execute new unchecked tasks T038–T067 in the update phases below. No new migration is required. SC-005 remains unverified until representative author trials are available.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies work that can run alongside the explicitly named independent work after its prerequisites are complete.
- `[US1]` through `[US5]` map to the specification's stories. Completed baseline phases retain their historical order; new phases place P1 stories US4/US5 before the P2 US3 update.
- Tasks sharing a file run sequentially even when their stories differ.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the existing writer, repository, and fixture scope without rebuilding project infrastructure.

- [X] T001 Inspect all diagram/ADR writers, repository callers and test doubles, graph locks, and hard-coded migration runners; record the affected paths and writer/revision coverage matrix in `specs/012-cli-delete-diagrams/quickstart.md`, and retain `.specify/feature.json` pointing to this feature.
- [X] T002 Extend `backend/tests/component-recovery-fixture.ts` with reusable disposable three-level hierarchies, mixed Trash batches, unrelated graphs, child owner-derived names, populated groups/relationships, and ADR statuses/replacements/component and relationship links; expose IDs and before-state snapshots for all story tests.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validated boundaries, saved-state revisions, and rollback infrastructure. Complete this phase before any story implementation.

- [X] T003 [P] Add strict deletion selector, mode, preview, confirmation, result, and error boundary tests in `shared/tests/diagram-deletion-validation.test.ts`; reject unknown fields, blank names without normalizing valid names, malformed UUIDs/tokens, empty or duplicate affected IDs, missing root, and invalid root-first/parent-before-child summary order.
- [X] T004 [P] Add internal revision and root-independent rollback tests in `backend/tests/persistence/diagram-deletion-revisions.test.ts`; cover every writer from T001, ADR-only writes, frozen-clock edit/revert, failed writes, counters beyond Number precision, and restoration of documents/provenance/revisions/ADR registration indexes after descendant and root removal.
- [X] T005 Define the contract-aligned strict deletion schemas and inferred types in `shared/src/validation/schemas.ts`, `shared/src/domain/types.ts` where needed, and `shared/src/index.ts`; preserve existing artifact formats and expose no editable revision field.
- [X] T006 Add server-managed non-negative bigint `deletion_revision` with default zero in `backend/src/persistence/schema.ts` and `backend/drizzle/0008_diagram_deletion_revision.sql`; preserve restrictive foreign keys and existing identities, timestamps, contents, and provenance.
- [X] T007 Implement decimal-string revision reads/increments and memory counter storage in both repository implementations and `DiagramRepositoryLike` in `backend/src/persistence/diagram-repository.ts`; initialize on creation and increment successful save, component/relationship removal, Trash, and restore inside their existing graph transactions; update callers/test doubles identified by T001 without accepting client counters.
- [X] T008 Increment the owning diagram revision after every successful create/update/link/delete through `AdrService.graphWrite` in `backend/src/services/adr-service.ts`; keep ADR write and increment in one graph transaction and preserve failed-write rollback.
- [X] T009 Repair memory snapshots/rollback in `backend/src/persistence/diagram-repository.ts`, `backend/src/persistence/graph-transaction.ts`, and `backend/src/persistence/adr-repository.ts`; retain pre-action IDs and safely track new members without traversing a removed root, restoring documents, provenance, revisions, ADR records, and diagram/component/relationship registration indexes.
- [X] T010 Update `backend/tests/persistence/component-test-database.ts` and every migration runner found by T001 to apply migration 0008 for updated-runtime tests; preserve deliberate pre-migration fixtures and add `backend/tests/persistence/diagram-deletion-migration.test.ts` proving default counters and unchanged pre-existing data before/after the additive migration.

**Checkpoint**: Strict boundary, all supported saved writers, and both memory rollback paths are ready; existing schema/repository tests and actual PostgreSQL migration coverage pass.

## Phase 3: User Story 1 - Move a named diagram hierarchy to Trash (Priority: P1)

**Goal**: Preview one exact-name or UUID root and explicitly confirm recoverable Trash of its active subtree.
**Independent Test**: Trash a populated Context/Container/Component hierarchy by exact name and by UUID, then restore through existing recovery; UUIDs, contents, references, and independently trashed batches remain intact. Decline confirmation and verify no saved changes.

### Tests for User Story 1

- [X] T011 [P] [US1] Add real preview/execute request and response tests in `backend/tests/contract/diagram-deletion.test.ts` for unique exact names, UUID parity, owner-derived child names, leaf/child roots, active-only affected scope, root-first deterministic summaries, recoverable Trash, and refusal without mutation; validate against `specs/012-cli-delete-diagrams/contracts/openapi.json` rather than checking text presence.
- [X] T012 [P] [US1] Add CLI/client tests in `cli/tests/delete-command.test.ts` and `cli/tests/api-client.test.ts` for preview printing, literal selector forwarding, exact yes consent, decline/EOF/interruption, non-TTY refusal, `--yes`, one execution using resolved UUID/mode/token, committed summaries, and token/ADR-content non-disclosure.
- [X] T013 [P] [US1] Add Trash-and-restore persistence tests in `backend/tests/persistence/diagram-deletion-trash.test.ts` using T002 fixtures for active descendants, earlier batch provenance, unrelated preservation, artifact/ADR/link identity retention, and rollback on injected mid-hierarchy failure in memory and PostgreSQL.

### Implementation for User Story 1

- [X] T014 [US1] Implement backend selector resolution and validated subtree discovery in `backend/src/services/diagram-service.ts`; search all eligible resolved saved summaries without truncation or substring filtering, retain exact strings, resolve only one root, lock its canonical Context graph, and recheck identity/name/status; reject missing, cyclic, or wrong-level ownership references.
- [X] T015 [US1] Build deterministic SHA-256 confirmation snapshots in `backend/src/services/diagram-service.ts` using transaction-scoped repositories; include version/root/mode, displayed summaries, complete membership/status, affected documents/full ADRs/links/replacements/provenance/revisions, and required ancestor/source data/revisions; sort unordered identities/object keys while retaining meaningful order, and bypass active-only read guards for required Trash contents.
- [X] T016 [US1] Implement confirmed Trash execution in `backend/src/services/diagram-service.ts`; under the same graph locks recompute token and validate dependencies before moving root/active descendants as one batch, preserving earlier batches and returning pre-action summaries only after commit; never re-resolve the name, refresh consent, or retry mutation.
- [X] T017 [US1] Register additive `POST /diagrams/deletion-preview` and `POST /diagrams/:diagramId/deletion` routes in `backend/src/api/recovery-routes.ts` with strict shared validation and contract errors in `backend/src/api/errors.ts`; preserve existing browser DELETE-to-Trash/restore routes and initially dispatch only the implemented Trash execution, safely refusing permanent execution until US2.
- [X] T018 [US1] Add validated preview/execute POST methods in `cli/src/api-client.ts` using the existing configured URL; check response root/mode correspondence and schema validity, retain structured remedies/candidates/blockers, and distinguish execution transport or invalid-response uncertainty from definite HTTP rejection without retrying.
- [X] T019 [US1] Create the focused flow in `cli/src/delete-command.ts` with existing output conventions and `node:readline/promises`; print impact and recoverability/artifact/ADR scope, sanitize terminal control characters only for display, accept trimmed case-insensitive yes or explicit `--yes`, cancel cleanly on EOF/interruption, and execute once with preview identity/token; extend `CliIo` in `cli/src/main.ts` only as needed for testable input.
- [X] T020 [US1] Wire `diagrams delete`, explicit `--id`/`--name`, `--trash`/`--permanent`, and `--yes` through `cli/src/main.ts`; reject missing/conflicting/repeated selectors/modes, positional roots, malformed UUIDs, blank names, and delete-inapplicable options before any request; preserve list/export option behavior and exit statuses 0/1/2.

**Checkpoint**: US1 works end to end and existing recovery still restores its batch. Shared token and consent safeguards are part of this increment, not deferred to US3.

## Phase 4: User Story 2 - Permanently delete a diagram hierarchy (Priority: P1)

**Goal**: Explicitly confirm physical removal of an active or trashed root and its entire subtree while preserving outside artifacts.
**Independent Test**: Permanently delete a mixed-status populated subtree and verify absence from active/Trash and all normalized storage tables; select a child and verify its ancestors, siblings, and owner component survive. External dependencies and injected failures leave all data intact.

### Tests for User Story 2

- [X] T021 [P] [US2] Extend `backend/tests/contract/diagram-deletion.test.ts` for permanent previews/execution from active and trashed roots, all-status descendants, child/leaf scope, malformed hierarchy, and external parent/owner/trash-root/source/endpoint/group/ADR-link/replacement blockers with artifact IDs and remedies; prove no silent detachment.
- [X] T022 [P] [US2] Add memory and real PostgreSQL purge tests in `backend/tests/persistence/diagram-deletion-purge.test.ts`; assert raw absence from all normalized artifact/link/group/provenance storage, removal of memory registration indexes/counters, internal ADR replacement-chain success, earlier batches, outside preservation, rollback after descendant AND root removal, and owner-slot reuse with a new child UUID.
- [X] T023 [P] [US2] Extend `cli/tests/delete-command.test.ts` for irreversible warnings, previously trashed descendants, both selectors, committed permanent output, dependency errors, and no success claim on rejection or uncertain responses.

### Implementation for User Story 2

- [X] T024 [US2] Add transaction-scoped external dependency inspection and scoped purge operations to repository interfaces/implementations in `backend/src/persistence/diagram-repository.ts` and `backend/src/persistence/adr-repository.ts`; inspect all dependency kinds in T021 without active-only filtering, return owning diagram/artifact IDs, and update the affected callers/test doubles from T001.
- [X] T025 [US2] Implement foreign-key-safe bulk owned ADR/link and artifact removal in `backend/src/persistence/adr-repository.ts` and `backend/src/persistence/diagram-repository.ts`; allow internal replacement chains, clear internal trash-root references, remove owned groups/members and relationships, then components/diagrams deepest-first, retaining outside owners and restrictive FKs; remove memory document/provenance/revision/index entries in the same transaction.
- [X] T026 [US2] Extend preview and confirmed execution in `backend/src/services/diagram-service.ts` and dispatch in `backend/src/api/recovery-routes.ts` for permanent mode; search active and Trash, include every subtree status, recompute token/blockers under locks, reject unexpected constraints with actionable errors, and return original affected summaries only after commit.
- [X] T027 [US2] Add permanent warning and success wording in `cli/src/delete-command.ts` explaining irreversible removal of all contained artifacts/ADRs and previously trashed descendants; retain the same consent, response validation, and one-shot execution flow as Trash.

**Checkpoint**: Both modes work from the appropriate statuses; permanent removal and rollback have database evidence.

## Phase 5: User Story 3 - Resolve targets and failures safely (Priority: P2)

**Goal**: Complete targeting diagnostics, help, stale-confirmation and saved-state race proofs for interactive and scripted use.
**Independent Test**: Exercise duplicate/near/Unicode/whitespace/UUID-shaped names, invalid usage, changed contents/impact, unavailable service, interrupted execution, and queued saved writes. Each unsafe operation returns an actionable non-success result without unintended deletion or UUID resurrection.

### Tests for User Story 3

- [X] T028 [P] [US3] Extend `cli/tests/delete-command.test.ts`, `cli/tests/api-client.test.ts`, and `cli/tests/cli-help.test.ts` with the complete CLI contract matrix: duplicate candidates/statuses, literal whitespace/case/punctuation/Unicode/UUID-shaped names, repeated/inapplicable options, mode errors, help coverage, streams/statuses, malformed or mismatched responses, HTTP-barrier stale consent for prompts and `--yes`, and response loss after commit with verification advice and no retry.
- [X] T029 [P] [US3] Add saved-state invalidation tests in `backend/tests/contract/diagram-deletion-stale.test.ts` for both modes: component/relationship/group/metadata/ADR/link-only edits, frozen-clock edit/revert, root/owner rename, membership/status/provenance changes, root/mode/token mismatch, removed roots, and required ancestor/source changes; show unrelated graphs do not invalidate consent and rejected deletion preserves concurrent edits.
- [X] T030 [P] [US3] Add two-connection PostgreSQL barriers in `backend/tests/persistence/diagram-deletion-concurrency.test.ts` for save, create-child, ADR/link updates, ancestor rename, Trash, and restore before/behind deletion locks; assert pre-lock edits invalidate consent and queued writes fail missing/inactive without resurrecting removed UUIDs or partially committing edits.
- [X] T031 [P] [US3] Extend `e2e/tests/component-diagram-persistence.spec.ts` and `e2e/tests/component-diagram-recovery.spec.ts` where coverage is absent to keep a deleted diagram open, attempt stale browser save, and verify visible failure plus preserved local draft and no UUID recreation; cover Trash recovery/save compatibility with the existing browser workflows.

### Implementation for User Story 3

- [X] T032 [US3] Complete safe resolution/error handling in `backend/src/services/diagram-service.ts` and `backend/src/api/errors.ts` against T029/T030: eligible-status duplicate candidates, no exact match, stale state, invalid hierarchy/dependencies, and missing/inactive queued writes; include contract codes/remedies, preserve saved edits, and fix only gaps exposed in existing public writer guards.
- [X] T033 [US3] Complete terminal-safe actionable diagnostics and help in `cli/src/main.ts`, `cli/src/delete-command.ts`, `cli/src/api-client.ts`, and `cli/src/output.ts` where needed; document exact-name/UUID selection, duplicates, modes, recursive scope, interactive/script consent, common failures and uncertain-outcome saved-state verification; maintain exit codes and never expose confirmation tokens/full ADRs.

**Checkpoint**: FR-001–FR-016 have explicit coverage; safe failure behavior works in both input modes and real writer races.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Compatibility checks, operational guidance, and measurable completion evidence.

- [X] T034 [P] Document deletion examples, saved-state scope, irreversible warning, migration-0008-before-runtime ordering, confirmation/cancellation/statuses, duplicate resolution, and response-loss verification in `README.md`; retain existing list/export/recovery guidance and configuration.
- [X] T035 [P] Add measured preview/execute p95 checks using the existing PostgreSQL fixture conventions in `backend/tests/persistence/diagram-deletion-scale.test.ts` for 100 diagrams with a selected subtree containing 1,000 components/relationships and 100 ADRs; verify no silent search truncation beyond fixture sizes and record actual environment/measurements against the separate two-second plan budget in `specs/012-cli-delete-diagrams/quickstart.md`.
- [X] T036 Run focused story tests, actual `RUN_POSTGRES_TESTS=1` database tests with a dedicated configured database, full `npm test`, `npm run build`, and recovery/save/list/export Playwright regressions per `specs/012-cli-delete-diagrams/quickstart.md`; record results and blockers there, treating unavailable/skipped database or browser checks as outstanding evidence rather than passes.
- [X] T037 Validate SC-001–SC-004 against recorded workflow outcomes and arrange representative first-time-author help-only trials for SC-005 in `specs/012-cli-delete-diagrams/quickstart.md`; record participant count, completion times, and the percentage completing intended selection/mode/consent within two minutes, or explicitly retain that criterion as unverified until participants are available.

## Phase 7: Update Setup (Shared Infrastructure)

**Purpose**: Reuse the completed baseline and establish the collection-writer/test reach without rebuilding infrastructure.

- [X] T038 Inspect collection coordination reach in `backend/src/persistence/diagram-repository.ts`, `backend/src/persistence/graph-transaction.ts`, `backend/src/services/diagram-service.ts`, and `backend/src/services/adr-service.ts`; audit every public graph writer, top-level creation caller, repository proxy/test double, and synchronous memory-create consumer; record table-before-row ordering, awaited MaybePromise callers, and reused migration 0008 in `specs/012-cli-delete-diagrams/quickstart.md`.
- [X] T039 Extend `backend/tests/component-recovery-fixture.ts` with disjoint exact-name roots, nested matching roots, near names, mixed-status/independent batches, representative cross-root internal/external references, active-descendant blockers, and complete document/ADR/index/provenance/revision snapshots; keep existing fixture callers compatible.

## Phase 8: Collection Foundation (Blocking Prerequisites)

**Purpose**: Shared strict boundaries, one transaction, membership coordination, and rollback for both new actions. Complete T038–T045 before story implementations.

### Foundation Tests

- [X] T040 [P] Add collection target/preview/confirmation/impact/result schema tests in `shared/tests/diagram-deletion-collection-validation.test.ts` aligned with `specs/012-cli-delete-diagrams/contracts/openapi.json`; reject unknown fields, blank names, malformed/repeated roots/tokens, duplicate affected UUIDs, inconsistent target/mode/count/status, missing matching roots and invalid hierarchy order; accept zero-item clear-Trash impact and retain legacy schema behavior.
- [X] T041 [P] Add collection coordination tests in `backend/tests/persistence/diagram-deletion-collection-transactions.test.ts` for memory and real PostgreSQL: one transaction-bound diagram/ADR pair, table-before-row ordering, ordinary writer/create/ADR coordination, opposite graph order, nested transaction reentry, complete rollback after all roots disappear, and queued unrelated creation surviving rollback; use deterministic barriers instead of timing sleeps.

### Foundation Implementation

- [X] T042 Add strict collection schemas and inferred types in `shared/src/validation/schemas.ts` and exports in `shared/src/index.ts` using T040 and the data model; keep existing single-root shapes unchanged, enforce target-specific nonempty roots/eligibility, unique affected identities/depth order and matching count, and expose no internal revision or ADR content.
- [X] T043 Add `withCollectionTransaction` to `DiagramRepositoryLike` and both implementations in `backend/src/persistence/diagram-repository.ts`; PostgreSQL acquires SHARE ROW EXCLUSIVE on diagrams before collection discovery, and existing graph transactions/top-level create acquire ROW EXCLUSIVE before row locks/writes; memory queues collection actions, graph writers and top-level creation with scoped reentry bypass and full diagram/provenance/revision rollback; await affected creation callers and update proxies/test doubles identified by T038.
- [X] T044 Add `GraphTransaction.runCollection` in `backend/src/persistence/graph-transaction.ts` with one transaction-scoped diagram/ADR pair and whole-collection ADR/index snapshot restoration in memory, reusing `backend/src/persistence/adr-repository.ts` snapshot support; preserve ordinary graph transactions and handle empty collections without a root UUID.
- [X] T045 Extract reusable validated gathering, saved-state hashing, depth ordering, and complete-union blocker checks from `backend/src/services/diagram-service.ts`; build versioned collection snapshots binding target/mode, sorted selected roots, full eligible match or Trash membership, unique contents/revisions/provenance and required ancestors; preserve existing single-root hashes/behavior and avoid per-root checks falsely blocking references within the removed union.

**Checkpoint**: T040/T041 and existing single-root schemas, graph/revision and rollback tests pass; supported writers cannot change collection membership inside preview/execution and no locks span user input.

## Phase 9: User Story 4 - Delete every exact-name match (Priority: P1)

**Goal**: Add explicit name-only --all-matches with both modes, unique recursive scope, reviewed identity sets and invocation-wide atomicity.
**Independent Test**: Delete populated disjoint and nested exact-name hierarchies in each mode; verify every eligible match is reported, each affected UUID changes once, unrelated near names remain, disjoint Trash batches restore independently, and any stale/blocking/failing member prevents the entire operation.

### Tests for User Story 4

- [X] T046 [P] [US4] Add real all-matches preview/execute contract tests in `backend/tests/contract/diagram-deletion-all-matches.test.ts` for zero/one/multiple matches, exact owner-derived names and Unicode/UUID-like names, active versus mixed-status eligibility, nested selected roots, deterministic unique summaries/counts, target/root/token tampering, added/removed/renamed/eligibility-changed matches and unrelated edits; validate actual responses against collection schemas/OpenAPI and retain default ambiguity refusal.
- [X] T047 [P] [US4] Add memory/PostgreSQL all-matches persistence tests in `backend/tests/persistence/diagram-deletion-all-matches.test.ts` for disjoint independently recoverable batches, nested deduplication, earlier provenance, internal cross-root replacement/link success, external blockers, raw owned-row removal, outside preservation and whole-invocation rollback after one subtree and after the final root is removed.
- [X] T048 [P] [US4] Add listening-HTTP CLI/client all-matches tests in `cli/tests/delete-all-matches.test.ts` for literal name forwarding, both modes, root/count/unique preview output, cancellation/EOF/interruption/non-TTY and --yes, invalid UUID/no-name/repeated flags, default single-root endpoint compatibility, one execution only, stale barriers and malformed/mismatched/lost responses without false success or token disclosure.

### Implementation for User Story 4

- [X] T049 [US4] Implement all-matches preview in `backend/src/services/diagram-service.ts` under runCollection; search every eligible exact resolved saved name without truncation, report all matching root IDs even when nested, gather/deduplicate the recursive union using T045, reject zero matches, and return collection impact without mutation.
- [X] T050 [US4] Implement all-matches execution in `backend/src/services/diagram-service.ts` under one runCollection transaction; compare reviewed target/root IDs/token and full eligible membership before mutation, reject any stale difference without retargeting, allocate one Trash batch per outermost selected subtree while preserving earlier batches, or purge owned ADRs and diagrams deepest-first once across the complete union; map restrictive-constraint failures to actionable rolled-back errors.
- [X] T051 [US4] Register additive POST `/diagrams/deletion-set-preview` and `/diagrams/deletion-set` in `backend/src/api/recovery-routes.ts` using strict collection request schemas and existing `backend/src/api/errors.ts` diagnostics; dispatch the implemented all-matches target and keep clear-trash safely unavailable until US5 is complete, without changing legacy browser/single-root routes.
- [X] T052 [US4] Extend `cli/src/api-client.ts` with validated collection preview/execute methods; verify target/mode, sorted root set, unique affected summaries/count and committed result against the reviewed impact, send target/root IDs/token exactly once, and treat execution transport/parse/identity mismatches as uncertain without automatic retry.
- [X] T053 [US4] Wire name-only --all-matches parsing in `cli/src/main.ts` and extend `cli/src/delete-command.ts` to reuse preview/consent/output for collections; print all matched roots and unique affected counts, retain single-root dispatch without the flag, and preserve literal selectors, terminal escaping, streams and exit codes in `cli/src/output.ts` where needed.

**Checkpoint**: US4 works with prompts and scripts in both modes and restores disjoint batches using existing recovery. No unrelated diagram is included or partially changed.

## Phase 10: User Story 5 - Clear Trash permanently (Priority: P1)

**Goal**: Add diagrams clear-trash [--yes], permanently removing exactly all reviewed trashed diagrams while protecting active data; empty Trash succeeds without confirmation/execution.
**Independent Test**: Clear mixed nested/disjoint Trash batches with full contents and ADRs, inspect raw absence and active-state equality, then verify empty success, cancellation, changing membership/content, active descendants, outside dependencies and injected failure.

### Tests for User Story 5

- [X] T054 [P] [US5] Add clear-Trash HTTP/schema contract tests in `backend/tests/contract/diagram-deletion-clear-trash.test.ts` for all-batch trashed-only impact, zero-item preview, rejected selector/mode/unknown fields, empty root set, count/status invariants, membership/content/provenance/ancestor changes, token/target tampering, and unchanged empty confirmation no-op per OpenAPI; verify stale rejection before any removal.
- [X] T055 [P] [US5] Add memory/PostgreSQL clear-Trash persistence tests in `backend/tests/persistence/diagram-deletion-clear-trash.test.ts` for raw removal of every trashed owned artifact/ADR/index/revision/provenance, nested and independent batches, internal references, active ancestors/owners preserved, active-descendant and external blockers, no changes on empty Trash and full rollback after partial and final-root purge.
- [X] T056 [P] [US5] Add listening-HTTP clear-Trash command tests in `cli/tests/clear-trash.test.ts` for empty exit-0/count-zero without prompt or execute, nonempty irreversible preview, interactive and --yes consent, decline/EOF/interruption/no scripted consent, rejection of selectors/modes/all-matches/output options, stale membership/content barriers and uncertain/mismatched results without retries or false success.

### Implementation for User Story 5

- [X] T057 [US5] Implement clear-Trash preview/execute branches in `backend/src/services/diagram-service.ts` using T045 and runCollection; select exactly all status=trashed IDs across batches without expanding into active descendants, return an empty impact when appropriate, compare full membership/token under execution coordination, block active/outside references, and purge the complete reviewed set once with atomic rollback and no recovery remnants.
- [X] T058 [US5] Enable clear-trash dispatch and strict target validation in `backend/src/api/recovery-routes.ts` and align existing error mapping in `backend/src/api/errors.ts` where needed; expose empty previews and unchanged empty execution as successful zero-item results, reject changed empty/nonempty membership as stale, and preserve the all-matches/legacy route contracts.
- [X] T059 [US5] Add clear-Trash handling to the collection flow in `cli/src/delete-command.ts` and client validation in `cli/src/api-client.ts`; print already-empty success and return before consent/execution when count is zero, otherwise show irreversible all-Trash scope, authorize only the reviewed set once, and verify committed identities/count before success.
- [X] T060 [US5] Wire `diagrams clear-trash [--yes]` parsing in `cli/src/main.ts`; reject name/UUID/mode/all-matches/output flags, preserve established statuses and keyboard consent, and keep default deletion/list/export dispatch unchanged.

**Checkpoint**: US5 works independently of name selection, empty Trash is prompt-free, and active artifacts remain intact in every successful or rejected clear operation.

## Phase 11: User Story 3 - Updated targeting diagnostics and help (Priority: P2)

**Goal**: Explain both new actions and default ambiguity safely while retaining completed single-root failure behavior.
**Independent Test**: Use help to choose a UUID versus --all-matches, understand permanent clearing and mode eligibility, and distinguish committed/empty success, usage errors, cancellation, stale confirmation and uncertain execution without disclosure or unintended changes.

### Tests for User Story 3 Update

- [X] T061 [P] [US3] Extend `backend/tests/contract/diagram-deletion-stale.test.ts` for default ambiguity guidance naming UUID and --all-matches, no retargeting between single-root/collection actions, shared error codes/remedies and saved-state preservation after collection rejection; retain the original both-mode stale and exact-name matrix.
- [X] T062 [P] [US3] Extend `cli/tests/cli-help.test.ts` and `cli/tests/delete-command.test.ts` for default single-match behavior, flag restrictions, both status scopes, overlap/count explanations, independent Trash recovery, irreversible clear scope/empty success, script consent, usage/failure streams and response-loss verification; include terminal-control names without changing literal matching.

### Implementation for User Story 3 Update

- [X] T063 [US3] Complete ambiguity remedies in `backend/src/services/diagram-service.ts` and help/terminal-safe actionable diagnostics in `cli/src/main.ts`, `cli/src/delete-command.ts`, and `cli/src/output.ts` against T061/T062; explain all-matches versus UUID, both modes, recursive unique scope, permanent clear, empty success and separate consent without exposing tokens or ADR contents.

## Phase 12: Update Polish & Cross-Cutting Validation

**Purpose**: Prove writer races and compatibility, document both commands and record new evidence separately from the completed baseline.

- [X] T064 Add and run real two-connection PostgreSQL barrier races in `backend/tests/persistence/diagram-deletion-collection-concurrency.test.ts` for both new actions: top-level matching creation, child creation, owner rename, save/ADR/link edit and Trash/restore before versus behind collection locks, opposite root ordering and ordinary writer table-before-row deadlock protection; prove pre-lock changes reject stale consent, queued writes preserve valid post-operation state, no partial writes/UUID resurrection, and locks are released before user confirmation. Write these tests before changing the exercised production paths and finalize after US4/US5.
- [X] T065 [P] Update `README.md` with --all-matches and clear-trash examples, exact/status eligibility, overlap/independent recovery, irreversible scope, empty no-op, consent/status/error behavior and uncertain-outcome verification; retain existing connection, migration-0008 and list/export/recovery guidance, stating no new migration/dependency.
- [X] T066 Extend `backend/tests/persistence/diagram-deletion-scale.test.ts` for overlapping matches, disjoint graphs and clear Trash using plan fixture sizes; record actual preview/execute p95 and writer delay in `specs/012-cli-delete-diagrams/quickstart.md` and document any failed budget without weakening integrity checks.
- [X] T067 Run focused new schemas/CLI/HTTP/memory tests, actual RUN_POSTGRES_TESTS=1 persistence/race tests, existing single-root deletion/graph/revision compatibility, full `npm test`, `npm run build`, and relevant list/export/recovery/stale-save Playwright checks; record commands, environment, FR-001–FR-021/SC-001–SC-008 evidence, results and unavailable/skipped checks in `specs/012-cli-delete-diagrams/quickstart.md` without claiming them as passes; retain historical evidence and SC-005 as unverified unless real first-time-author trials establish it.

**Checkpoint**: Both requested features have new automated safety evidence, legacy workflows remain compatible, and completion reporting distinguishes tests from unverified usability trials.

## Baseline Dependencies & Execution Order (T001–T037)

### Phase Dependencies

```text
Setup (T001-T002)
  -> Foundation (T003-T010)
    -> US1: safe preview/confirmed Trash (T011-T020)
      -> US2: permanent purge (T021-T027)
        -> US3: full diagnostics/race proof (T028-T033)
          -> Polish and validation (T034-T037)
```

- T003 and T004 are independent test work; implementation proceeds T005 → T006 → T007 → T008 → T009 → T010. T010 verifies the migration against all updated-runtime runners.
- US1 tests T011/T012/T013 can run together after foundation; service work T014 → T015 → T016 precedes routes T017. Client T018 precedes confirmation flow T019 and CLI wiring T020.
- US2 builds on US1's preview/consent contract. T021/T022/T023 are independent test files. T024 → T025 → T026 → T027 delivers permanent execution without widening scope.
- US3 test work T028–T031 can run together after both modes; T032/T033 then close any demonstrated gaps. Their shared source files require coordination with prior story work.
- Story acceptance tests run independently against fresh fixtures even though implementation reuses earlier infrastructure. Do not claim all three stories can be implemented concurrently.
- T034 documentation and T035 measurement work can run together after story completion; T036 then verifies the complete change and T037 records success-criterion evidence.

### Parallel Opportunities

Independent test groups: T003/T004, T011/T012/T013, T021/T022/T023, and T028/T029/T030/T031. After implementation, T034/T035 use different files. `[P]` never permits mutation of a shared file simultaneously or skipping a prerequisite.

## Parallel Example: User Story 1

After foundation, write backend contract tests (T011), CLI/client tests (T012), and persistence restoration/rollback tests (T013) concurrently. Then implement the service, routes, client, consent flow, and parser in dependency order.

## Parallel Example: User Story 2

After US1, write permanent API/dependency tests (T021), storage purge/rollback tests (T022), and CLI warning/output tests (T023) concurrently. Implement repository inspection before purge and service/CLI integration.

## Parallel Example: User Story 3

After both modes, write CLI/help/transport tests (T028), API invalidation tests (T029), PostgreSQL race tests (T030), and browser stale-save regressions (T031) concurrently. Apply demonstrated guard/diagnostic fixes sequentially in shared modules.

## Baseline Implementation Strategy (Completed)

### MVP First

Complete setup, foundation, and US1. Validate exact targeting, explicit consent, content/revision-bound confirmation, atomic Trash, and existing restore before demonstrating this increment. Permanent execution remains safely unavailable until US2 is complete; US1 alone is a recoverable MVP, not the entire requested feature.

### Incremental Delivery

Add US2 physical purge and prove raw storage removal/rollback. Add US3's full diagnostics and race/compatibility evidence. Complete documentation, measured performance, full checks, and first-time-author validation. Retain any unavailable evidence explicitly and do not substitute in-memory tests for real database guarantees.

## Notes

- Existing list substring filtering, export, and browser recovery contracts remain compatible.
- Direct administrative SQL is outside the supported graph-lock/revision protocol; any future public writer must adopt it.
- Never automatically retry a deletion or refresh stale consent. Execution response loss requires saved-state verification before another invocation.
- No implementation or destructive deletion is performed by generating this task list.

## Update Dependencies & Execution Order (T038–T067)

```text
Completed baseline: US1 recoverable Trash, US2 permanent deletion, US3 single-root safety
  -> Update setup (T038-T039)
    -> Collection foundation (T040-T045)
      -> US4: all exact-name matches (T046-T053)
        -> US5: clear Trash (T054-T060)
          -> US3 update: help/diagnostics (T061-T063)
            -> Collection races/docs/scale/full validation (T064-T067)
```

- T038 audits reach; T039 supplies fixtures. T040/T041 are independent test files after setup; implement T042 then T043/T044 and T045 sequentially because interfaces and source files overlap. Collection schemas are common to both new stories. Run existing US1/US2 tests after the extraction and writer coordination changes; their completed baseline tasks are not repeated.
- T046/T047/T048 may be drafted together after foundation. Service T049/T050 precedes routes T051; client T052 precedes flow/parser T053. Confirm US4 independently before US5. T054/T055/T056 then form an independent test group, followed by T057 through T060 in order.
- US5's data behavior is independent of exact-name deletion, but reuses the endpoints/client flow delivered by US4. Both stories edit the same modules; do not implement them concurrently. Invalid all-matches or clear-trash syntax is handled in their own P1 tasks, not deferred to US3.
- US3 tests T061/T062 use separate backend and CLI files after both commands; T063 updates shared remedies/help. US1 and US2 need no new dedicated phase: preserve their existing acceptance and regression tests. US3 is not newly complete until T061–T063 pass.
- Draft T064's race assertions after foundation and before implementing the exercised US4/US5 service paths; execute/finalize them after both stories. This test-first scheduling does not permit marking T064 complete before the actions exist. T065 documentation may run alongside T064 after story completion; both use separate files. T066 measurements precede final T067 checks/evidence. T066 and T067 update the same quickstart file and run sequentially.
- Requirements coverage: FR-001–FR-016 retain baseline tests plus compatibility T067; FR-017 is T040/T046/T048/T049/T053; FR-018 is T047/T050; FR-019–FR-020 are T054–T060; FR-021 and collection revisions/atomicity are T041/T046/T047/T054/T055/T064. SC-006 maps to US4, SC-007 to US5, and SC-008 to stale/rollback/race checks; T067 records all outcomes without fabricating SC-005 participant evidence.

## Update Parallel Examples

### US4

After foundation, draft API tests in `backend/tests/contract/diagram-deletion-all-matches.test.ts` (T046), persistence/recovery tests in `backend/tests/persistence/diagram-deletion-all-matches.test.ts` (T047), and CLI tests in `cli/tests/delete-all-matches.test.ts` (T048) concurrently. Implement service, routes, client and flow sequentially after the tests fail for the missing behavior.

### US5

After US4's reusable collection flow, draft HTTP tests in `backend/tests/contract/diagram-deletion-clear-trash.test.ts` (T054), persistence/active-data protection tests in `backend/tests/persistence/diagram-deletion-clear-trash.test.ts` (T055), and CLI empty/consent tests in `cli/tests/clear-trash.test.ts` (T056) concurrently. Implement T057–T060 sequentially; do not edit the service or client alongside US4 work.

### US3 Update

After both commands, draft backend ambiguity/stale compatibility tests (T061) and CLI help/diagnostic tests (T062) concurrently. Apply T063 only after both assertions are available. Baseline US1/US2 parallel test examples above remain historical; their tests are rerun for compatibility, not regenerated.

## Update Implementation Strategy

The smallest new deliverable is setup/foundation plus US4 in both modes, including collection confirmation/rollback and correct recovery batches. Default single-match refusal remains the safe behavior when the flag is absent. Keep clear-trash explicitly unavailable until US5 passes; US4 alone is not completion of the user's full request.

Then add US5, validate it independently with active data alongside Trash, complete US3 help/diagnostics, and finish real concurrency, scale, documentation and compatibility evidence. No new dependency, migration, graphical control, arbitrary UUID list, or retry infrastructure is included. Pending tasks are unchecked; only implementation evidence may change their marks.
