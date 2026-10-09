# Implementation validation: C4 Component diagrams

Scope: phases 1–3 (T001–T024). Component entry MVP is implemented; modeling, full hierarchy/list behavior, recovery and exports remain later-phase work.

## Environment and baseline (2026-10-09)

- Windows 11 Home, Intel Core i7-13700H, 16 GiB RAM; Node.js v22.17.1, npm 11.17.0; existing lockfile retained without dependency upgrades.
- `npm.cmd run build`: PASS; existing Vite bundle-size warning.
- Baseline `npm.cmd test`: 496 passed, 37 skipped, 4 startup timeouts under concurrent build/test load. The same four tests pass with bounded workers; final validation below has no timeouts.
- PostgreSQL 17.4 (Debian, x86-64). DATABASE_URL is configured. New persistence suites create isolated `spec010_<UUID>` schemas, apply migrations and remove only their own schema. The existing broader suites also use the configured disposable database. Do not use a valuable database. Set RUN_POSTGRES_TESTS=1 to execute database evidence; backend/.env is not loaded automatically.
- Playwright 1.62.1; installed Chromium revision 1234, launched browser version 151.0.7922.34. Browser version was verified through a headless launch/close; no Component UI or offline browser acceptance journey is claimed.
- Installed TypeScript 5.9.3, Vitest 3.2.7, Vite 7.3.6, Zod 3.25.76, Drizzle ORM 0.44.7, pg 8.23.0, Fastify 5.12.1. Package-lock.json is unchanged.
- `.gitignore` already covers generated Node/build/test/editor files and environment files. `.dockerignore` now also excludes itself. Packages are private; no publishing ignore is needed. No ESLint/Prettier/Terraform/Helm configuration was detected.

## Requirement-to-evidence

| Requirement | Foundation evidence | Status |
| --- | --- | --- |
| FR-006–009, FR-015, FR-021, FR-024 | `shared/tests/component-diagrams.test.ts`: 14 tests for empty Application/Datastore children, scope/role/type/metadata limits, geometry/clearance, UUIDs, local directed endpoints, boundary exclusion and legacy/general/Container compatibility | Foundation PASS |
| FR-009/010, FR-013–015, FR-018, FR-021 | `backend/tests/contract/component-write-guards.test.ts`: 11 tests for immutable identities/status, owner/immediate/canonical dependencies, active/recoverable children, subtype switches, authoritative metadata without timestamp writes, malformed/duplicate source chains, explicit source removal and two ancestor reads with zero per-element lookups | Foundation PASS |
| FR-015, FR-024 | `backend/tests/persistence/component-migration.test.ts`: 4 PostgreSQL tests seed 0001–0006 documents, compare every artifact/link/trash row before/after 0007, and verify required-value/finite checks, subtype/role checks, owner uniqueness across trash and composite/source/trash FKs | Foundation PASS |
| FR-015, FR-017–021 | `backend/tests/persistence/component-graph-transactions.test.ts`: 2 memory and 6 PostgreSQL tests for Context-first coordination, depth/UUID descendant locks, unrelated-root independence, diagram/ADR/provenance rollback, stable parent rows, inclusion versus source omission, and activity recheck after a concurrent root mutation | Foundation PASS |

These are phase-2 foundation results, not complete story or release acceptance for the listed requirements. In particular, entry, editor, list/navigation, full three-level recovery and Component export implementation remain later tasks.

## Phase checkpoints

- Phase 1 (T001–T002): PASS. `shared/tests/component-fixtures.ts` retains Context/Container fixture identities and adds Application/Datastore children, duplicate owner labels, immediate/canonical source identities, local linked/unlinked ADRs and distinct trash batches. Existing Container fixtures are unchanged.
- Phase 2 test-first evidence (T003–T005): authored before production implementation. The first run failed on rejected Component kind/scope/role, absent ComponentContextService and missing migration 0007. Subsequent implementation made the foundation checks pass, including real database execution.
- Phase 2 (T006–T012): PASS. Extended existing domain and repositories, constrained existing columns, and used one root-coordinated transaction for diagram/ADR mutations. No new runtime dependency, service deployment, table, column or backfill; migrations 0005/0006 are unchanged. Migration 0007 was applied to disposable test schemas, not a deployment database.

## Final verification

```powershell
$env:RUN_POSTGRES_TESTS = '1'
npm.cmd test -- --maxWorkers=2
npm.cmd run build
npx.cmd tsc -b frontend
git diff --check
```

- Full Vitest: **100 files, 574 tests passed, zero failures, zero skips** (41.09 s). Includes all enabled existing PostgreSQL regression/acceptance suites plus 10 new spec-010 PostgreSQL tests. Existing Context/Container entry/retry, groups, ADRs, recovery, exports and CLI regressions pass.
- Targeted foundation: **37 tests passed**, including the new migration and graph suites with PostgreSQL enabled.
- Final legacy-label compatibility correction: **48 targeted domain/Container/export/type-label tests passed**; shared build and whitespace checks passed afterward.
- All-package build: PASS. Explicit frontend TypeScript check: PASS (Vite build alone does not type-check the frontend). Whitespace check: PASS.
- Compatibility fixes: preserved legacy Container summaries with null scope; Component summaries require ComponentScope. Existing Container-only frontend and export accesses explicitly narrow their scope. Legacy general free-form `type: container` retains its label without acquiring a required subtype; scoped supporting containers use Application/Datastore labels.
- Non-failing diagnostics: existing Vite bundle-size warning; pg 8 warns about concurrent queries queued on one transaction client. This retains the existing pg 8 behavior and is not a transaction/test failure.
- Context7: current Drizzle documentation resolved through `/drizzle-team/drizzle-orm-docs` for transactions, self/composite FKs and constraints; installed declarations were checked for the lazy FK builder used to avoid circular schema inference.
- Extension hooks: `.specify/extensions.yml` is absent; pre/post implementation hooks skipped according to the skill. Active feature remains `specs/010-c4-component-diagrams`. Requirements checklist markers remain untouched.

## Separate release gates

- Usability SC-001/SC-003: pending observed first-time-author sessions; automated results do not satisfy this gate.
- Safari acceptance: pending current stable Safari/OS version and direct-from-disk journey; WebKit does not satisfy this gate.
- Other browser, runtime UI, export, exact recovery and scale observations: pending corresponding story phases.

## Phase 3 — US1 entry MVP (2026-10-09)

T013–T024: PASS. Authors can select an Application/Datastore, double-click or activate its native Create/Open/Restore action, and enter one canonical Component child. Supporting containers resolve the source owner's original parent association. The child opens with an empty 480×320 boundary at (0,0), an owner-derived read-only title, container/Software System/parent context, and guarded immediate-parent return selecting its owner and focusing the destination heading. Plain click remains selection; Shift/Control/Alt/Meta and multiple selection suppress entry. Internal Components and synthetic boundaries have no deeper entry or persisted endpoint identity.

Implementation adds the three contracted Component availability/create/context routes, shared-response-validated client requests, root-coordinated idempotent creation and source-aware store/UI entry. Trashed children return RESTORE_REQUIRED, never a replacement. Expected owner-unique conflicts are reread in a new transaction after rollback. Parent/ADR Save/Discard/Cancel uses the existing dialog; failed/canceled saves retain the current document and draft. Retry after a committed create/load failure loads the same UUID without another POST. Stale diagram/ADR responses cannot replace current work. Component modeling controls await US2.

### Entry requirement evidence

| Requirements | Evidence | Result |
| --- | --- | --- |
| FR-001–005, FR-024 | `backend/tests/contract/component-diagrams.test.ts`: 5 cases (including both owner subtypes) cover read-only GET, bodyless POST 201/200, full Component response scope/context, canonical supporting entry, existing Software System entry through two source levels, invalid/mismatched owners, inactive ancestry, broken sources and RESTORE_REQUIRED | PASS |
| FR-003/005/015/024 | `backend/tests/persistence/component-diagrams.test.ts`: 4 real PostgreSQL tests cover overlapping creation (exactly one created result/UUID), lost-response retry, recoverable-owner uniqueness, creation versus owner removal, root trash winning over entry, and unchanged Context/Container artifacts | PASS, no skips |
| FR-003/005 | `frontend/tests/component-diagram-entry-store.test.ts`: 6 cases cover repeated activation, save prerequisite/failure, post-create load retry without repeated POST, superseded session errors, ADR draft commit guard and canonical supporting parent/owner routing | PASS |
| FR-001/002/004/006/011/025 | `frontend/tests/component-diagram-entry-ui.test.tsx`: 4 rendered UI/adapter cases cover eligible native actions, Create/Open/Restore/progress/error labels, inert owner-labeled empty boundary/round-trip absolute coordinates, scope labels and read-only parent return | PASS |
| FR-001–005/011/025 | `e2e/tests/component-diagram-entry.spec.ts`: 6 browser journeys cover pointer/keyboard creation, focus/owner return, repeat open, failed save/cancel, committed-load retry, recoverable-child identification/cancel, canonical supporting-container entry, internal/ineligible suppression, modifier/multiselection suppression, retained ADR draft and Software System regression | PASS |
| FR-024 | 6 existing `container-diagrams.spec.ts` browser journeys: keyboard authoring/parent return, grouped duplicate owners, failed child load retry, unsaved owner Save/Discard/Cancel, canonical external System entry and dirty ADR cancellation | PASS |

Canonical identities are asserted against persisted owners: parent `90000000-0000-4000-8000-000000000009`, Application `90000000-0000-4000-8000-000000000010`, Datastore `a0000000-0000-4000-8000-000000000001`. Generated child UUIDs are deliberately random; tests compare exact equality across every retry/reopen and verify distinct children for distinct owners despite matching names. Source entry targets the same Datastore child/parent rather than the initiating Component diagram. PostgreSQL suites use only their UUID-named isolated `spec010_*` schemas and clean them up afterward.

### Commands and final checks

```powershell
$env:RUN_POSTGRES_TESTS = '1'
npm.cmd test -- --maxWorkers=2
npm.cmd run build
npx.cmd tsc -b frontend
npx.cmd playwright test component-diagram-entry.spec.ts --config playwright.phase3.config.ts
npx.cmd playwright test container-diagrams.spec.ts --config playwright.phase3.config.ts --grep "creates distinct empty children|keeps the parent visible when child loading fails|guards an unsaved owner|opens an external Software System occurrence|keeps a dirty ADR|completes selection, child creation"
npm.cmd test -- frontend/tests/component-diagram-entry-ui.test.tsx --maxWorkers=2
git diff --check
```

- Full Vitest: **104 files, 592 tests passed, zero failures/skips** (38.79 s). After that run, one additional rendered feedback case was added; the final UI batch passed **4/4**. All production changes were included in the full run.
- Browser: **6/6 Component entry journeys** (22.7 s) and **6/6 existing Container journeys** (32.0 s). These use Playwright request routing into the actual Fastify app with memory repositories (the existing browser harness), separately from real PostgreSQL concurrency evidence. Full real HTTP/PostgreSQL modeling/recovery journey remains T068.
- Browser runtime: **Google Chrome 154.0.8037.99**, `C:/Program Files/Google/Chrome/Application/chrome.exe`, headless on Windows 11; Node.js **v22.17.1**, existing Playwright **1.62.1**. This is runtime UI evidence for the entry milestone, not offline multi-browser/Safari acceptance.
- Temporary `playwright.phase3.config.ts` inherited the existing config and changed only workers to 1 and headless settings to true; it was removed after validation. To reproduce the headless run, create that equivalent temporary override or use the normal `playwright.config.ts` browser workflow.
- Build and explicit frontend TypeScript check: PASS. Whitespace: PASS. Existing Vite chunk warning and pg transaction-query deprecation remain non-failing diagnostics.
- Visual QA: inspected `test-results/component-entry.png` at 1280×720. The owner-labeled dashed empty boundary, Component heading, read-only title/help, Saved state and parent return are readable within the established workspace styling. Screenshot is an ignored test artifact, regenerated by the browser journey.
- Test-first evidence: new entry tests were authored before the production changes; the first store run failed because `createOrOpenComponentDiagram` was absent. Corrected invalid test fixture construction and an ambiguous browser Cancel selector during validation. Narrowed the pre-existing group selection source-text assertion to its selection handler so double-click modifier suppression can coexist with Shift-only multiselection.
- Current React Flow documentation was resolved/fetched through Context7 `/websites/reactflow_dev` for selection/events and synthetic visual nodes; installed packages and lockfile were retained.
- Sandbox process initialization failed before execution. Approved outside-sandbox commands were used for reads/checks; all local edits used apply_patch. No deployment migration was applied.
- Post-implementation hooks: `.specify/extensions.yml` is absent; hooks skipped under the implementation skill. Requirements checklist is unchanged; active feature still points to Spec 010.

US1 is independently demonstrable. Full three-level confirmed recovery (US4), Component authoring (US2), list/name synchronization (US3), exports (US5), actual Safari and observed usability acceptance remain pending and are not claimed by this milestone.
