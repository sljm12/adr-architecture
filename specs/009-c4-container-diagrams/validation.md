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
