# Tasks: CLI Diagram Deletion

**Input**: Design documents from `specs/012-cli-delete-diagrams/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cli.md`, `contracts/openapi.json`, `quickstart.md`, and `.specify/memory/constitution.md`.
**Tests**: Required by FR-016 and the constitution. Write the tests before their implementation and verify that they fail for the intended reason. PostgreSQL tests must actually execute; skipped database tests do not prove atomicity or concurrency safety.
**Organization**: Shared safety prerequisites followed by independently testable story increments. All paths are relative to the repository root. Extend existing modules and fixtures; no new dependencies, public document fields, token registry, authentication, or UI controls.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies work that can run alongside the explicitly named independent work after its prerequisites are complete.
- `[US1]`, `[US2]`, and `[US3]` map to the specification's stories.
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

## Dependencies & Execution Order

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

## Implementation Strategy

### MVP First

Complete setup, foundation, and US1. Validate exact targeting, explicit consent, content/revision-bound confirmation, atomic Trash, and existing restore before demonstrating this increment. Permanent execution remains safely unavailable until US2 is complete; US1 alone is a recoverable MVP, not the entire requested feature.

### Incremental Delivery

Add US2 physical purge and prove raw storage removal/rollback. Add US3's full diagnostics and race/compatibility evidence. Complete documentation, measured performance, full checks, and first-time-author validation. Retain any unavailable evidence explicitly and do not substitute in-memory tests for real database guarantees.

## Notes

- Existing list substring filtering, export, and browser recovery contracts remain compatible.
- Direct administrative SQL is outside the supported graph-lock/revision protocol; any future public writer must adopt it.
- Never automatically retry a deletion or refresh stale consent. Execution response loss requires saved-state verification before another invocation.
- No implementation or destructive deletion is performed by generating this task list.
