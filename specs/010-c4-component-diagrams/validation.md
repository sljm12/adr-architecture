# Implementation validation: C4 Component diagrams

Scope: phases 1 and 2 (T001–T012). Story entry, UI, recovery and exports remain later-phase work.

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
