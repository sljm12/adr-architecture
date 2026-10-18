# Tasks: Lossless Diagram Export and Import

**Input**: Design documents from `/specs/013-diagram-archive-transfer/`.

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/archive.schema.json`, `contracts/openapi.json`, `contracts/http-and-ui.md`, and `quickstart.md`; governance in `.specify/memory/constitution.md`; UI guidance in `DESIGN.md`.

**Tests**: Required by FR-018 and constitution principle IV. Write the listed tests before their implementation, observe the expected failures, and run them again at the story checkpoint. Real PostgreSQL, browser, performance, and usability evidence must be recorded separately; skipped checks are not passes.

**Organization**: Shared prerequisites first, then one independently verifiable increment per user story. Existing packages and harnesses are reused; no new dependencies, CLI archive command, authentication, or collaboration features.

## Format: `[ID] [P?] [Story] Description`

- Every task has a sequential ID and exact repository-relative target paths.
- `[P]` means the task can run alongside other marked tasks in its phase after the stated prerequisites, using separate files. It does not authorize overlapping edits to a shared file.
- `[US1]`, `[US2]`, and `[US3]` correspond to the numbered stories in `spec.md`.
- Paths name existing files to extend or new files to create; follow nearby repository conventions. Do not rebuild the project scaffold or replace the existing domain/editor model with archive rows.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish reusable preservation fixtures and the current-version database harness.

- [X] T001 [P] Create the version-1 eight-collection fixture and explicit 69-field preservation inventory in `shared/tests/archive-fixtures.ts`, mapped to `specs/013-diagram-archive-transfer/contracts/archive.schema.json`; include a valid three-level graph, independent Trash batches, all ADR states, both link kinds, distinct membership/link timestamps, raw cached names, legacy classifications, null/empty/padded/Unicode text, signed-zero layout, microseconds, and revisions above 2^53 through bigint maximum; expose small empty-diagram and dependency variants without generating fixture expectations through the production encoder.
- [X] T002 [P] Extend `backend/tests/persistence/component-test-database.ts` to apply pending `0009_diagram_archive.sql` in its current-version path while preserving explicit pre-0007/pre-0008 migration modes and adding a pre-0009 mode; create `backend/tests/persistence/diagram-archive-fixtures.ts` with parameterized raw SQL seeding/comparison of every artifact column, signed-zero checks, and epoch snapshots using only the existing verified isolated-schema cleanup.

**Checkpoint**: Fixture contracts and database setup are ready. The helper's default path becomes runnable when T010 supplies migration 0009.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide the lossless boundary, raw persistence, rollback, and safe existing confirmation paths shared by every story. No browser import is enabled until this phase passes.

### Required tests first

- [X] T003 [P] Add strict primitive/structure and graph tests in `shared/tests/archive-validation.test.ts` and `shared/tests/archive-graph.test.ts` using T001: assert required nullable fields, all 69 fields, calendar-valid six-digit UTC timestamps, canonical finite binary64 strings including -0 and positive dimensions, exact revision range, collection-scoped/case-insensitive UUID and endpoint-pair uniqueness, manifests/seeds, scope closure, hierarchy/ownership/source/group/relationship/ADR/Trash invariants, and preservation of supported multi-ADR replacement cycles without writing the validation projection back.
- [X] T004 [P] Add actual PostgreSQL migration and codec tests in `backend/tests/persistence/diagram-archive-migration.test.ts`: upgrade populated 0008 data without artifact changes, assert ledger has no cascading FK, verify source uniqueness is immediate for ordinary writes and deferrable for a valid import swap, honor the existing ADR replacement FK, and prove microsecond/bigint/signed-zero fidelity and migration failure atomicity using T002.
- [X] T005 [P] Add memory repository parity tests in `backend/tests/diagram-archive-memory.test.ts` for raw eight-table snapshots, ordinary-writer maintenance of membership/link timestamps, epoch tombstones, and collection rollback of inserted/removed records, sidecars, ADR registration indexes, and queued writers; compare original values rather than hydrated editor projections.
- [X] T006 [P] Add legacy/new confirmation compatibility cases in `backend/tests/contract/diagram-archive-confirmations.test.ts` and `frontend/tests/archive-recovery-confirmations.test.tsx`: strict optional impact tokens, epoch-zero body-less/legacy acceptance, nonzero-epoch refusal without tokens, stale supplied-token refusal, and token forwarding by both recovery UI paths; seed epochs directly so these tests do not depend on the archive endpoints.

### Implementation

- [X] T007 Define the eight raw row types, archive envelope, prepared archive, per-record changes/counts, preview/import/result/error types and strict HTTP envelope schemas in `shared/src/archive/types.ts` and `shared/src/archive/validation.ts`, matching both contracts exactly; export them from `shared/src/index.ts` without changing the editor artifact representation or adding coercion/defaults.
- [X] T008 Implement the bounded lexical check and native JSON parse plus strict primitive validation in `shared/src/archive/validation.ts`: enforce 8 MiB UTF-8, depth 64, no BOM/NUL/invalid Unicode, reject duplicate object keys including escaped equivalent keys, reject unknown/missing fields and unsupported versions, retain valid escaped/repeated values, and validate exact timestamp/revision/layout strings without Date conversion, trimming, rounding, or stripping.
- [X] T009 Implement standalone archive identity, manifest, hierarchy/reference fixed-point closure and graph validation in `shared/src/archive/validation.ts`, reusing rules from `shared/src/domain/invariants.ts` through a temporary domain projection; validate source-derived scope separately while retaining every raw field, and report paths/identities and remedies for unsupported or inconsistent data without adding lifecycle restrictions.
- [X] T010 Add `backend/drizzle/0009_diagram_archive.sql` and align `backend/src/persistence/schema.ts`: create nonnegative bigint `diagram_confirmation_epochs` without diagram FK/cascade, replace only `components_diagram_source_unique` with equivalent deferrable initially-immediate same-key uniqueness, and reflect the existing ADR replacement FK; preserve migrations 0001-0008, primary-key conflict behavior, nullable uniqueness semantics, and all saved values.
- [X] T011 Implement fixed-column, parameterized raw row codecs and bounded SQL batches in `backend/src/persistence/archive-repository.ts`: UTC microsecond timestamp text, exact bigint text, transaction-local precise float8 reads and canonical binary64 strings including -0, nullable/text preservation, explicit unsupported-value errors, deterministic row ordering, and no global driver parser changes or SQL identifiers sourced from file keys.
- [X] T012 Extend interfaces and PostgreSQL/memory implementations in `backend/src/persistence/diagram-repository.ts` with raw diagram/component/relationship/group/membership snapshot and scoped upsert/remove operations plus epoch read/advance; retain membership creation metadata through ordinary writes and rollback, skip identical rows, never purge a diagram or its epoch as an archive side effect, and expose coordinated read-only repeatable-read export snapshots using T011.
- [X] T013 Extend interfaces and PostgreSQL/memory implementations in `backend/src/persistence/adr-repository.ts` with raw ADR/component-link/relationship-link reads and upsert/remove operations, exact link timestamps maintained by existing writers, and complete registration/sidecar rollback snapshots; preserve the normal ADR lifecycle rules and use the supplied transaction rather than normal timestamp-resetting editor writers.
- [X] T014 Complete paired raw snapshot/apply coordination in `backend/src/persistence/graph-transaction.ts`, `backend/src/persistence/diagram-repository.ts`, and `backend/src/persistence/adr-repository.ts`: all eight collections and local epochs share one transaction/connection or cloned memory snapshot, retain the existing table-before-row collection writer barrier, advance only effectively changed/inserted diagrams, abort epoch overflow, and retain ledger tombstones across purge/reintroduction.
- [X] T015 Extend `TrashImpact`, `RestoreImpact`, and confirmation types in `shared/src/domain/types.ts` and strict shapes in `shared/src/validation/schemas.ts` with impact tokens as specified by `specs/013-diagram-archive-transfer/contracts/http-and-ui.md`; retain optional request tokens for legacy compatibility and unchanged single/collection deletion request/response shapes.
- [X] T016 Update `backend/src/services/diagram-service.ts` so Trash/restore tokens bind relevant raw data/revisions/local epochs under current coordination, supplied tokens always match, legacy or body-less calls require all relevant epochs zero, and single/collection deletion fingerprints include epochs; preserve tombstones and unrelated-review validity and return `TRASH_IMPACT_CHANGED`/`RESTORE_IMPACT_CHANGED` with fresh-review guidance when required.
- [X] T017 Forward complete confirmations through `backend/src/api/recovery-routes.ts`, `frontend/src/api/diagram-client.ts`, `frontend/src/components/RecoveryCoordinator.tsx`, and `frontend/src/components/RecoveryControls.tsx`; update affected fixtures/callers in `backend/tests/contract/recovery.test.ts`, `backend/tests/contract/container-recovery.test.ts`, `backend/tests/contract/component-recovery.test.ts`, `frontend/tests/container-diagram-recovery.test.tsx`, and `frontend/tests/component-diagram-recovery.test.tsx`, plus the compatibility descriptions in `specs/013-diagram-archive-transfer/contracts/openapi.json`; verify T006 and existing recovery/deletion contracts remain valid.

**Checkpoint**: T003-T006 pass, including actual database executions for T004. Lossless raw operations, coordinated rollback, and all historical-confirmation callers are ready. Shared safeguards are prerequisites, not optional later hardening.

---

## Phase 3: User Story 1 - Export and restore complete architecture data (Priority: P1) - MVP

**Goal**: Download one approved coherent saved hierarchy and import it into an empty installation with exact persisted values and normal navigation/edit/recovery behavior.

**Independent Test**: Use two independently migrated isolated destinations, export the T001 populated graph from a selected child, review expanded scope, import into the empty destination, and compare every raw field/reference before immediate re-export. Then reload, navigate all levels, open ADRs, edit/save, and restore an imported Trash batch. Include an empty diagram and active/Trash export entry points.

### Required tests first

- [X] T018 [P] [US1] Add export/new-only preview/import HTTP contract cases in `backend/tests/contract/diagram-archive.test.ts` against `specs/013-diagram-archive-transfer/contracts/openapi.json`: saved active/Trash selection, invalid/missing selectors, deterministic text/digest/bytes/scope/counts, no-store, no mutation on preview/cancel, explicit new-only Import, durable result counts, and refusal of existing identities until US2 is implemented.
- [X] T019 [P] [US1] Add real PostgreSQL round-trip and coherent-export tests in `backend/tests/persistence/diagram-archive-roundtrip.test.ts` with T002: compare all 69 raw fields across an empty installation and immediate re-export, including raw caches, six-digit timestamps, distinct link/membership times, signed zero, maximum revisions and independent Trash batches; use an observable concurrent writer barrier to prove a single coherent snapshot and reject unsupported stored primitives without partial output.
- [X] T020 [P] [US1] Add client/coordinator/new-only review tests in `frontend/tests/diagram-archive-transfer.test.tsx`: size-before-read, fatal UTF-8/BOM rejection, child scope approval, cancellation, download of exactly the prepared text without another export, saved-only diagram/ADR draft choices, empty-list import, busy feedback and durable success/reload behavior.

### Implementation

- [X] T021 [US1] Implement scope discovery and prepared export in `backend/src/services/archive-service.ts` using the paired raw repeatable-read snapshot: selected diagram to complete top-level hierarchy, recursive source/ownership/recovery dependency hierarchies including Trash, fixed-point deduplication, inclusion reasons, full raw validation, deterministic version-1 text, exact-byte SHA-256/length/counts and 8 MiB refusal; support union closure from multiple seeds for later recovery reuse.
- [X] T022 [US1] Implement new-only preview in `backend/src/services/archive-service.ts`: parse standalone before locking, read relevant destination rows/presence/epochs under `GraphTransaction.runCollection()`, validate the proposed retained-destination union, derive scope/counts and a deterministic fingerprint bound to exact bytes, preview time and relevant state; do not bind unrelated content and return no actionable commit token for collisions until US2 supports review/override.
- [X] T023 [US1] Implement new-only atomic apply in `backend/src/services/archive-service.ts` with raw helpers in `backend/src/persistence/archive-repository.ts`: recompute reviewed state inside collection coordination, require the explicit reviewed request, insert hierarchy/owners parent-first, stage recovery-root and ADR replacement references until targets exist, persist exact membership/link metadata, validate final primitives/graph/constraints, advance local epochs once and commit; refuse stale tokens/collisions and roll back every table and ledger on failure, with no automatic retry.
- [X] T024 [US1] Add the three endpoints in `backend/src/api/archive-routes.ts` and wire the existing paired repositories/service in `backend/src/api/app.ts`; enforce strict envelopes/UUIDs, no-store downloads, 24 MiB request limits on preview/import only, 8 MiB archive/output limits, and an encapsulated archive-only parser/error boundary matching documented statuses/codes/remedies while leaving other routes' limits and error contracts intact.
- [X] T025 [US1] Implement `frontend/src/api/archive-client.ts` for prepare/preview/import and Blob downloads: validate request/result contracts, retain exact selected text and digest, check bytes before read, use fatal UTF-8 decoding with BOM rejection, safe UUID-based `.adr.json` names and object-URL cleanup, expose structured field/remedy errors, and never retry an import automatically or render archive text as HTML.
- [X] T026 [US1] Create `frontend/src/components/ArchiveReviewDialog.tsx` for export scope and new-only import review using `DESIGN.md` and existing dialog/CSS conventions: all included names/UUIDs/statuses/reasons and counts, explicit download/import controls, safe default cancellation/Escape, focus trap/restore, readable labels and busy/result announcements without adding a generic dialog framework.
- [X] T027 [US1] Create `frontend/src/components/DiagramArchiveTransfer.tsx` as the single owner of file/prepared text, request sequence, review and outcome; serialize with save/recovery, offer save/retry, continue-saved or cancel for export drafts, reuse explicit save/discard/cancel for relevant import drafts, invalidate review after a save, preserve unrelated drafts, distinguish uncertain submission from known commit/failed refresh, and refresh lists/views without resubmitting import.
- [X] T028 [US1] Mount the coordinator and workspace export action in `frontend/src/components/DiagramWorkspace.tsx`; expose archive export on active and Trash rows and import when the library is empty in `frontend/src/components/SavedDiagramList.tsx`; retain current Mermaid/HTML exports and existing library/recovery actions, and verify T018-T020 after integration.
- [X] T029 [US1] Add the empty-installation browser round trip to `e2e/tests/diagram-archive-transfer.spec.ts` using existing isolated fixtures: child expansion and approved exact download, active/Trash export, empty-list upload, reload, all-level navigation, linked ADRs, normal edit/save and imported Trash restoration; run alongside T019 and record field-by-field SC-001 evidence in `specs/013-diagram-archive-transfer/quickstart.md`.

**Checkpoint**: US1 is independently usable with an empty installation. Existing-identity imports remain blocked until US2; no destructive operation is shipped without review/recovery safeguards.

---

## Phase 4: User Story 2 - Review and approve replacement of matching identities (Priority: P1)

**Goal**: Review the full authoritative replacement, download/acknowledge recovery, explicitly approve override, and preserve valid unrelated destination data.

**Independent Test**: Seed destination fixtures directly with changed matching records, extra owned records, unrelated diagrams, and mixed incoming new/existing diagrams. Check complete preview and zero mutation on cancellation, restore the file snapshot on approval, prove exact reimport is a row/epoch no-op, then import recovery to restore prior values while retaining added diagrams. A newly added dependent diagram must block recovery even without intervening edits.

### Required tests first

- [X] T030 [P] [US2] Extend `backend/tests/contract/diagram-archive.test.ts` with collisions in every collection/pair including exact reimport and non-diagram collisions; assert complete names/identities/statuses/delta counts, missing/incorrect override and recovery flags/digest refusal, no mutation on cancellation, new-only flags remaining false/null, and no actionable token for ownership/dependency blockers.
- [X] T031 [P] [US2] Add real PostgreSQL authoritative replacement/recovery tests in `backend/tests/persistence/diagram-archive-replacement.test.ts`: replace/add/remove across all eight collections, preserve common IDs and every destination-only diagram, valid source swaps and multi-ADR cycles under actual FKs, incompatible ownership and retained child/source/ADR/Trash blockers, exact reimport with zero row/timestamp/epoch changes, and recovery restoring removed records while retaining original-import additions or blocking their invalid dependencies.
- [X] T032 [P] [US2] Add override/recovery dialog and affected-draft/state tests in `frontend/tests/diagram-archive-replacement.test.tsx`: full scrollable change/removal review, safe default/dismiss cancellation, actual recovery download plus separate unchecked acknowledgement, save-triggered fresh review, explicit discard, affected cache/history reset and unrelated draft preservation.

### Implementation

- [X] T033 [US2] Extend preview delta and proposed-union validation in `backend/src/services/archive-service.ts`: authoritative owned snapshots for each included diagram, collection-scoped lowercased UUID/pair comparisons, every collision including unchanged rows, incompatible same-type owners or diagram parent/owner/kind refusal, complete added/replaced/removed/unchanged changes and counts, and actionable retained-child/source/group/ADR/Trash dependency blockers without expanding mutation scope.
- [X] T034 [US2] Generate recovery and finalize preview fingerprints in `backend/src/services/archive-service.ts`: seed every pre-existing changed diagram including additions-only changes, include complete prior dependency closure, exclude nonexistent incoming diagrams, use reviewed time deterministically, bind exact file digest/raw relevant rows and absence/revisions/epochs/collisions/delta/recovery digest, require override for any collision, require recovery only for changed pre-existing snapshots, and block recovery files above 8 MiB.
- [X] T035 [US2] Implement authoritative replacement operations in `backend/src/persistence/archive-repository.ts`, `backend/src/persistence/diagram-repository.ts`, and `backend/src/persistence/adr-repository.ts`: preserve common rows, skip identical values, defer only source uniqueness, upsert owners/hierarchy/references before removing obsolete endpoints, stage/restore ADR replacements and recovery references, remove stale links/memberships first and external occurrences before canonical sources, bind fixed-column batches in one transaction, and never delete diagram rows or replace metadata with import time.
- [X] T036 [US2] Extend commit in `backend/src/services/archive-service.ts` to rebuild the exact reviewed delta/recovery inside collection coordination, verify token and exact override/recovery acknowledgement/digest before writes, apply T035, verify final graph/primitives and deferred constraints, increment only changed/added epochs with overflow rollback, and return committed affected IDs and total/per-collection counts; recovery uses this identical path and exact reimport performs no writes or epoch advance.
- [X] T037 [US2] Extend `frontend/src/components/ArchiveReviewDialog.tsx` with all record-level identities/names/status context and explicit removal totals, whole-file override approval, recovery download and separate unchecked saved-file acknowledgement; explain that recovery restores overwritten contents, keeps newly added diagrams, and can be blocked by dependencies without claiming a browser download proves durable saving.
- [X] T038 [US2] Extend `frontend/src/components/DiagramArchiveTransfer.tsx` to retain the exact reviewed file/recovery bytes and digest, gather decisions for every affected current/retained diagram and ADR draft, request fresh preview after saving, submit one whole-file confirmation with correct flags, and cancel safely before commit while serializing with existing save/recovery actions.
- [X] T039 [US2] Add affected-ID invalidation to `frontend/src/state/diagram-store.ts` and `frontend/src/state/adr-store.ts` and call it from `frontend/src/components/DiagramArchiveTransfer.tsx` after known commit: remove affected retained documents/drafts/undo histories/source and ADR caches, invalidate stale in-flight results, reload affected open views and both lists, retain unrelated draft/history state, and keep refresh-only retry separate from import.
- [X] T040 [US2] Extend `e2e/tests/diagram-archive-transfer.spec.ts` with mixed new/existing override, collision review/cancel, recovery download/acknowledgement, owned removals, exact no-op reimport, retained children and same-name/different-ID handling, successful recovery that retains additions, and dependency-blocked recovery without subsequent edits; record raw before/after SC-002/SC-003/SC-005 evidence in `specs/013-diagram-archive-transfer/quickstart.md` after T030-T032 pass.

**Checkpoint**: US2 is independently verifiable from seeded conflicting destination data; US1 remains valid. Recovery restores overwritten snapshots and never implicitly deletes diagrams added by import.

---

## Phase 5: User Story 3 - Reject unsafe files and stale decisions (Priority: P2)

**Goal**: Prove and complete actionable refusal, stale-consent invalidation, atomic failure, uncertain-outcome handling, and keyboard-only operation across the transfer workflow.

**Independent Test**: Submit invalid external fixtures, preview then change exact file bytes or relevant destination data, reuse old confirmations after historical import, inject late persistence failures and response loss, and exercise all steps by keyboard. Compare all eight tables and ledger before/after every rejected or rolled-back operation; distinguish uncertain outcomes from confirmed commits whose refresh failed.

### Required tests first

- [X] T041 [P] [US3] Extend `shared/tests/archive-validation.test.ts` and `shared/tests/archive-graph.test.ts` with malformed/escaped duplicate keys, legitimate repeated values and escaped strings, invalid UTF-8-derived text/BOM/NUL/surrogates, depth-64 boundary, unsupported versions/unknown fields, identical/case-variant record and pair duplicates, invalid calendar dates/overflow/noncanonical or nonfinite scalars, corrupt source/group/ADR/Trash ownership and manifest/extra-root cases; assert specific paths and zero silent normalization.
- [X] T042 [P] [US3] Add archive error-boundary tests in `backend/tests/contract/diagram-archive-errors.test.ts`: malformed strict HTTP envelopes, parser failures before handlers, media types, file exactly 8 MiB and one UTF-8 byte over, generated export/recovery size failures, 24 MiB request boundary, wrong file/time/token/recovery digest and missing choices; assert documented statuses/codes/remedies without leaking source text/SQL and unchanged non-archive limits/errors.
- [X] T043 [P] [US3] Add observable real PostgreSQL races and late-failure rollback tests in `backend/tests/persistence/diagram-archive-concurrency.test.ts`: file-whitespace and every relevant destination/presence/dependency change after preview, queued save/ADR/link/create/Trash/restore writers, old single/collection deletion and both Trash/restore confirmations after historical edit/import/revert, purge/reintroduced UUIDs, durable epochs across recreated APIs, legacy epoch-zero/nonzero behavior, unrelated-review validity, and failures after parents/references/stale deletes/epochs/deferred checks; compare every table and ledger and use barriers rather than sleeps to establish race order.
- [X] T044 [P] [US3] Extend `backend/tests/diagram-archive-memory.test.ts` with service-level stale preview, recovery and rollback fault cases after newly inserted/removed rows, sidecar/link timestamp changes and epoch updates; assert all registrations and queued writer state are restored and unsupported memory values fail explicitly rather than substituting regenerated metadata.
- [X] T045 [P] [US3] Add stale-request, draft, accessibility and outcome tests in `frontend/tests/diagram-archive-failures.test.tsx`: file reselection/out-of-order responses, save-invalidated review, retained affected diagram/ADR drafts, ignored old cache responses, submission response loss with no automatic retry, known commit plus failed refresh with refresh-only retry, structured errors, keyboard focus/default cancellation and live busy/result announcements.

### Implementation and integrated validation

- [X] T046 [US3] Complete the refusal/rollback paths exposed by T041-T044 in `shared/src/archive/validation.ts`, `backend/src/services/archive-service.ts`, and `backend/src/api/archive-routes.ts`: preserve pre-mutation review revalidation and transaction boundaries, classify every documented parser/service/persistence error with relevant path/identity and corrective action, never echo archive values/SQL, never emit a commit token on blockers or success after rollback, and retain existing non-archive error behavior.
- [X] T047 [US3] Complete request-sequence, draft/cache invalidation and result-state handling exposed by T045 in `frontend/src/components/DiagramArchiveTransfer.tsx`, `frontend/src/api/archive-client.ts`, `frontend/src/state/diagram-store.ts`, and `frontend/src/state/adr-store.ts`; preserve exact review bytes, never revive discarded previews/caches, never retry uncertain imports automatically, and present confirmed import success separately from refresh failure with an inspection or refresh action as appropriate.
- [X] T048 [US3] Complete keyboard/accessibility behavior exposed by T045 in `frontend/src/components/ArchiveReviewDialog.tsx`, `frontend/src/components/DiagramArchiveTransfer.tsx`, and `frontend/src/components/SavedDiagramList.tsx`, checking `DESIGN.md` and existing dialog patterns for focus trap/restoration, readable names/UUIDs/statuses, scrollable impact, labels, contrast, busy/result/error announcements, acknowledgement and safe Escape/dismissal before submission.
- [X] T049 [US3] Extend and run `e2e/tests/diagram-archive-transfer.spec.ts` for invalid/unsupported uploads, stale destination/file review, unsaved affected/unrelated drafts, injected save failure, lost commit response and known-commit refresh failure, plus complete keyboard-only export/import/conflict/recovery/cancel flows; record zero-mutation SC-004 and keyboard evidence in `specs/013-diagram-archive-transfer/quickstart.md` without treating memory or database-gated skips as real persistence evidence.

**Checkpoint**: All stories pass the failure matrix. SC-006's first-time-author completion proportion still requires actual trials in T053; keyboard automation alone does not establish it.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Measure the specified budget, document operation, and record truthful release evidence.

- [X] T050 [P] Add and run `backend/tests/persistence/diagram-archive-scale.test.ts` using a valid 100-diagram collection and selected three-level graph with 1,000 components, 1,000 relationships, 100 ADRs and representative groups/links/provenance; measure export preparation, preview and committed apply separately after two warmups with 20 valid samples each, reset fixtures outside timing, require nearest-rank p95 <5,000 ms and archive/recovery <=8 MiB, and record hardware/runtime/database versions, raw samples and lock wait in `specs/013-diagram-archive-transfer/validation.md`; optimize only measured misses or document a plan-budget revision explicitly.
- [X] T051 [P] Update `README.md` with `.adr.json` scope/precision/version/size boundaries, active/Trash entry points, UUID conflict/whole-file override and recovery acknowledgement, recovery retaining additions and dependency refusal, unsaved edits and uncertain-outcome guidance, and applying only pending migration 0009 before the API; retain existing presentation exports and CLI scope.
- [X] T052 Execute the focused shared/service/HTTP/frontend and actual PostgreSQL migration/precision/replacement/race/rollback suites, then the relevant browser regressions and one broad lint/build/unit/e2e pass using `package.json` and `specs/013-diagram-archive-transfer/quickstart.md`; include saved lists, three-level navigation, recovery/deletion and existing CLI deletion, ADRs, Mermaid and HTML export, run `git diff --check`, resolve introduced failures and record SC-001-SC-005 field/state evidence plus explicit skips/remaining issues in `specs/013-diagram-archive-transfer/validation.md` without secrets or imported text.
- [ ] T053 Conduct first-time-author export and empty-installation import trials defined by SC-006, recording participant count, completion times, proportion completing within three minutes without instructions and keyboard completion in `specs/013-diagram-archive-transfer/validation.md`; compare against 90%, and leave the usability gate explicitly pending if trials cannot be conducted rather than claiming automated tests prove it.

---

## Dependencies & Execution Order

### Phase dependencies

```text
Setup T001-T002
  -> Foundation T003-T017
    -> US1 T018-T029 (empty-installation MVP)
      -> US2 T030-T040 (override and recovery)
        -> US3 T041-T049 (failure/race/accessibility completion)
          -> Polish T050-T053
```

The stories are independently testable with seeded fixtures, but their implementation extends common service/coordinator files. They are intentionally integrated in priority order rather than claiming all three implementations can safely run concurrently. Basic validation, atomicity, review binding and failure feedback are built into US1; US3 expands their adversarial proof and closes defects rather than permitting unsafe earlier increments.

### Foundational dependencies

- T001 and T002 touch different files and may start together. T002's migration-dependent tests run after T010 exists.
- T003-T006 can be authored in parallel after setup using the intended interfaces; observe expected failures before implementing T007-T017.
- T007 -> T008 -> T009 establish the boundary. T010 supplies schema/migration. T011 requires T007 and T010.
- T012 and T013 both use T011; each can be implemented independently before their integration in T014, but no overlapping repository edits are permitted.
- T015 -> T016 -> T017 completes existing confirmation compatibility; T016 requires T014 epoch/raw reads. Rerun T003-T006 before opening story implementation.

### Story dependencies

- **US1**: T018-T020 can be authored together after foundation. T021 -> T022 -> T023 -> T024 provides the backend. T025 follows the shared contracts; T026 can use fixtures, then T027 -> T028 integrates it. T029 runs against the finished stack.
- **US2**: T030-T032 can be authored together after US1. T033 -> T034 establishes the reviewed result; T035 uses that delta and precedes T036. T037 -> T038 -> T039 connects recovery/draft/cache handling; integrate T036 before T040 end-to-end validation.
- **US3**: T041-T045 cover separate test files and can be authored together after US2. T046 follows the relevant failing shared/backend cases; T047 follows frontend cases; T048 follows coordinator behavior. T049 validates the integrated system.
- **Polish**: T050 and T051 have independent files; serialize database measurements against other database/benchmark runs. T052 appends validation evidence after T050; T053 appends actual usability evidence afterward to avoid concurrent edits to `validation.md`.

### Within each story

1. Author required tests and establish the expected failure.
2. Implement shared/domain/raw persistence logic before services/endpoints that depend on it.
3. Integrate clients, UI and state against the defined contracts.
4. Run focused tests, actual database checks and the story's browser checkpoint.
5. Preserve unrelated work; no transaction or database lock spans user review/download.

## Parallel Examples by User Story

These examples describe optional task scheduling; they do not require starting agents.

### User Story 1

After foundation, author these independently:

```text
T018: backend/tests/contract/diagram-archive.test.ts
T019: backend/tests/persistence/diagram-archive-roundtrip.test.ts
T020: frontend/tests/diagram-archive-transfer.test.tsx
```

After shared contracts are stable, T025's client and T026's dialog can be prepared alongside T021-T024 backend work using contract fixtures; integration waits for the endpoints. Keep T021-T023 sequential because they edit the same service.

### User Story 2

After US1, author these independently:

```text
T030: backend/tests/contract/diagram-archive.test.ts
T031: backend/tests/persistence/diagram-archive-replacement.test.ts
T032: frontend/tests/diagram-archive-replacement.test.tsx
```

Once T034 fixes reviewed recovery/delta behavior, T035 repository apply and T037 dialog work can proceed on different files. T036 and T038-T039 integrate their results sequentially; do not run US1 and US2 edits to common files concurrently.

### User Story 3

After US2, author these independently:

```text
T041: shared/tests/archive-validation.test.ts + shared/tests/archive-graph.test.ts
T042: backend/tests/contract/diagram-archive-errors.test.ts
T043: backend/tests/persistence/diagram-archive-concurrency.test.ts
T044: backend/tests/diagram-archive-memory.test.ts
T045: frontend/tests/diagram-archive-failures.test.tsx
```

T046's shared/backend fixes and T047's frontend fixes can proceed on separate files after their respective failing cases exist. T048 follows T047 because both touch the coordinator; T049 follows integration.

## Requirement Coverage

| Requirement / outcome | Main tasks and required evidence |
| --- | --- |
| FR-001-FR-002 | T018-T021, T025-T029: active/Trash browser transfer, empty list, approved complete hierarchy/dependency closure and coherent download. |
| FR-003-FR-005, FR-015; SC-001 | T001-T005, T007-T014, T019, T021-T025, T029: all 69 raw values, strict versioned transport, precision, no hydration/normalization, complete re-export. |
| FR-006-FR-008 | T003, T008-T009, T030-T033, T041: case-insensitive collection/pair identity, owner refusal, file/retained graph invariants and both ADR-link kinds. |
| FR-009-FR-010; SC-002-SC-003 | T030-T040: complete conflicts/delta, explicit whole-file override, safe cancel, owned snapshot replacement and no-op reimport. |
| FR-011 | T031, T033-T036, T040, T043: destination-only diagrams remain unchanged; retained hierarchy/source/ADR/Trash dependencies block invalid replacement or recovery. |
| FR-012 | T006, T014-T017, T022-T023, T034-T036, T042-T045, T047: exact file/relevant-state review binding, local durable epochs, all legacy confirmation paths, UUID reuse and races. |
| FR-013; SC-004 | T005, T014, T023, T031, T035-T036, T041-T049: one atomic commit, no duplicates/partial mutation, late failure rollback, actionable refusal. |
| FR-014; SC-005 | T030-T040: deterministic pre-existing recovery closure, required download/acknowledgement, same workflow, keep additions and block invalid retained dependencies. |
| FR-016 | T020, T025-T029, T032, T038-T039, T045, T047, T049: save/discard decisions, affected histories/cache clearing, durable success, uncertain outcome and refresh-only retry. |
| FR-017; SC-006 | T026-T029, T037-T040, T045, T048-T049, T053: keyboard/focus/labels/announcements plus separately recorded first-time-author completion trials. |
| FR-018 | T003-T006, T018-T020, T029-T032, T040-T045, T049-T053: field, contract, real database, browser, regression and measured evidence gates. |
| Plan performance/resource budget | T008, T024-T025, T034, T042, T050: depth/byte boundaries and measured export/preview/apply p95 without inferred results. |

## Implementation Strategy

### MVP First (User Story 1 Only)

Complete setup and foundation, including the existing confirmation compatibility paths, then implement T018-T029. Demonstrate approved saved-hierarchy export and exact restoration into an empty installation. Keep existing-identity imports blocked until US2 supplies explicit override and recovery. Validate raw database equality and ordinary post-import navigation/edit/Trash behavior before calling this increment complete.

### Incremental Delivery

1. Foundation: prove strict fidelity, migration, raw persistence and confirmation safety.
2. US1: deliver the empty-installation portable transfer and verify SC-001.
3. US2: deliver authoritative override and recovery; verify SC-002, SC-003 and SC-005 independently with seeded conflicts.
4. US3: finish the adversarial failure/race/accessibility matrix and verify SC-004.
5. Polish: measure resource/performance goals, run broad regression once, update documentation, and record actual usability results or the pending gate.

### Scope and Completion Notes

- 53 tasks total: 2 setup, 15 foundational, 12 US1, 11 US2, 9 US3, and 4 polish tasks.
- 19 tasks carry `[P]`; additional implementation scheduling opportunities are explicitly qualified above.
- No archive values are reconstructed from editor projections; no portable revisions are rewritten to serve as local consent counters.
- No diagram absent from the file is implicitly removed, including diagrams added by the original import during recovery.
- Implementation completion requires actual evidence from database and browser suites; document generation does not establish implementation correctness, measured performance, or first-time-author usability.
