# Implementation Validation Record: C4 Container Diagrams

## Phase 1 baseline

Captured before adding feature implementation on 2026-10-01. No package or lockfile changes were made.

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run build` | Passed | Shared, backend, frontend, and CLI TypeScript builds completed. Vite reported the existing main-chunk size warning. |
| `npm.cmd test` | Failed baseline | 57 test files passed. Three tests failed: the save-status source assertion expects a literal `role="status"`; the PostgreSQL diagram API test received 400 instead of 201; and PostgreSQL quickstart cleanup could not connect to localhost. Four tests were skipped. The repository test run also reported localhost PostgreSQL connection refusal. |
| PostgreSQL prerequisite | Unavailable | `DATABASE_URL` is configured in the process, but localhost:5432 is unreachable. `RUN_POSTGRES_TESTS` is not enabled and `psql` is unavailable. No database migration or mutation was attempted. A dedicated validation database must be supplied for migration/concurrency checks. |
| Browser prerequisite | Present, not executed | Chrome is installed and Playwright is configured to use a system browser. The performance E2E spec was inspected but not run for the baseline. |
| Runtime versions | Available | Node.js 22.17.1 and npm 11.17.1. |

## Existing general-diagram interaction baseline

`e2e/tests/performance.spec.ts` exercises creation and save of a diagram with five components and five relationships, then Mermaid export. Its feedback targets are under three seconds for save and export. A separate scenario verifies that a failed save keeps the draft visible and a later edit/save recovers. These browser scenarios were not executed during baseline capture.

## Feature validation status

## Phases 1–3 implementation results

Captured on 2026-10-01 after implementing Setup, Foundation, and US1. `.specify/feature.json` still points to this feature directory. No dependency or lockfile changes were made.

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run build` | Passed | Shared, backend, frontend, and CLI builds completed. Vite retains the existing main-chunk size warning. |
| `npm.cmd test` | Passed with skips | 66 test files passed and 4 were skipped; 288 tests passed and 10 were skipped. Skips are PostgreSQL-only tests gated by `RUN_POSTGRES_TESTS=1`. |
| Focused feature/compatibility batch | Passed | 55 tests passed across 11 files, including schemas, geometry, entry-state, API contracts, and write guards. |
| Container browser suite | Inconclusive as a combined run | The first five scenarios passed together. The dirty-ADR guard passed when run alone. A combined rerun stalled while executing the final test and was interrupted, so the complete six-case browser suite has no clean aggregate result. |
| PostgreSQL migration test | Passed | With `RUN_POSTGRES_TESTS=1`, both migration/legacy round-trip tests passed in an isolated schema. |
| PostgreSQL concurrency test (T018) | Passed | With `RUN_POSTGRES_TESTS=1`, all four tests passed in an isolated schema: repeated/concurrent grouped-owner creation and duplicate names; a real unique-index conflict with rollback and winner resolution; owner reclassification and parent-trash races; and rollback after child insertion failure. |
| Configured database migration | Applied and verified | Applied `0005_c4_container_diagrams.sql` transactionally to the configured database's `public` schema after checking for invalid legacy geometry and duplicate component keys; both preflight counts were zero. Verified all 13 new columns, six constraints, six indexes, and existing diagrams/components remained general/element. |

The browser scenarios exercised grouped duplicate-name owners, ordinary click/Shift selection, keyboard activation, repeated owner identity, double-click activation, failure/retry, availability failure, unsaved-owner Save/Discard/Cancel, rejection of a discarded owner, external-source canonicalization, and protection of a dirty ADR draft. The final dirty-ADR scenario passed in isolation. Run the full browser suite again in a stable browser session before treating the combined E2E gate as complete.

The T018 unique-index race exposed that Drizzle nests PostgreSQL error codes and constraint names under `cause`. `ContainerContextService` now walks the error-cause chain before resolving the committed winner. T006, T016, and T018 are complete; all their required database tests passed. The other Phase 1–3 implementation and contract/browser authoring tasks are checked in `tasks.md`.

## Phase 4 implementation results

Captured on 2026-10-02 for T029–T047 only. All 19 US2 tasks are complete; phases 5–7 remain outstanding. Dependencies and migration 0005 are unchanged. Ignore files already cover the detected private Node/Docker project; no additional ignore file is needed. No implementation extension hooks are configured.

Implemented explicit Application/Datastore subtypes, strict role-aware validation and field errors, forward migration 0006 and both repository write/read paths. Existing generic internal database rows receive Application only during migration; new child writes missing a subtype fail. General and external components use null. Stable UUIDs, original creation times, scopes, endpoints and ADR links survive subtype changes.

Child add/edit forms offer exactly two choices, reset on document/role switches and commit complete metadata in one edit. External inclusion fetches current parent context, excludes the owner, disables duplicates and creates independent occurrence IDs/layout without parent relationships. External details remain read-only. Interactions require directed local endpoints, at least one internal container and a description; protocol is optional. Canvas connections open the interaction form before creating an edge.

Pointer movement, completed resizing and keyboard movement use validated domain geometry. Boundary fitting and deterministic external displacement share the same bounded history entry. Direct external overlap is rejected with live feedback and restored geometry. Selection retention for keyboard edits is limited to child diagrams to preserve general grouping/Shift behavior. Role-aware node labels wrap complete responsibilities/technology, with domain dimensions grown before fitting; interaction labels include protocol. The long-metadata browser screenshot was visually inspected.

| Check | Result | Evidence |
| --- | --- | --- |
| Test-first phase 4 batch | Expected failures observed | Missing subtype schema support, absent child commands, general-type forms and missing adapter metadata failed before implementation. |
| `RUN_POSTGRES_TESTS=1; npx.cmd vitest run --maxWorkers=4` | Passed, no skips | 75 files and 341 tests, including actual PostgreSQL migration/round-trip/rollback/concurrency, ADR quickstart and existing general/CLI/export regressions. |
| `npm.cmd run build` | Passed | Shared, backend, frontend and CLI builds; existing Vite main-chunk warning remains. |
| Container Playwright suite, one worker | Passed | All nine entry/authoring scenarios together: subtype choices/history/save/reopen, stale parent form, three containers, both external source types/read-only/duplicates, protocol, repeated keyboard moves, pointer displacement/rejection, resize undo and long-label bounds. |
| General grouping browser regression | Passed | All seven `c4-system-groups.spec.ts` scenarios after restricting native selection retention to child diagrams. |
| Additional general browser regressions | Passed | Both `add-component-to-group.spec.ts` and both `performance.spec.ts` scenarios. Save/export feedback target and failed-save draft recovery remain intact. |
| Isolated clean install and populated 0005→0006 upgrade | Passed | Active/trashed generic containers, general/free-form/external rows; explicit null/unsupported subtype rejection; all component data and diagram/relationship/group/ADR/link rows preserved. Both subtypes round-trip; invalid child writes preserve parent and child data. |
| Configured database migration 0006 | Applied | Preflight found the existing role CHECK and 17 ordinary elements, with no subtype column. Applied the additive migration transactionally; subsequent public-schema PostgreSQL regression/acceptance checks passed. |

An initial unrestricted-worker Vitest run timed out during concurrent API startup; the bounded-worker full run passed. A broader browser run exposed general-selection regressions, which were corrected and its affected grouping suite rerun successfully. These failures are resolved; the remaining full feature/release gates, export support, recovery work and observed usability timing belong to later tasks. The current nine-scenario browser result supersedes the earlier six-scenario combined-run uncertainty without completing T088.

Current library mechanisms were verified through Context7: React Flow controlled changes, resize and keyboard selection/movement (`/websites/reactflow_dev`), and Drizzle named PostgreSQL CHECK constraints (`/drizzle-team/drizzle-orm-docs`). No runtime dependencies were added.
