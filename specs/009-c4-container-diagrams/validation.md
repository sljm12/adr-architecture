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

## Phase 5 implementation results

Captured on 2026-10-03 for T048–T060 only. All 13 US3 tasks are complete; T061–T090 remain outstanding. No dependency, lockfile or migration changes were made, and no implementation extension hooks are configured.

Child saves use the existing PUT endpoint and validate returned identity, own name, kind and canonical scope before committing. Failed or mismatched responses retain the draft for retry; edits made during a save remain unsaved. Superseded loads and older library responses cannot overwrite the current document or a newly saved summary. Repeated saves retain one summary per child UUID, creation time, subtypes and parent data.

The API resolves current parent/owner/source details from a batched repository snapshot; PostgreSQL reads use a repeatable-read, read-only transaction. Active and trash listings report broken references explicitly. Source descriptions cleared to null remain cleared. The library nests children under parent UUIDs, separates own name from owner/level, keeps absent parents as refreshable context, and counts only matching diagrams during filtering. CLI tables show level, parent and owner; flat JSON and validated documents retain scope and subtype fields.

Parent, library, new-diagram and external-source navigation guard both diagram and ADR drafts with Save/Discard/Cancel, retain failed intent and re-guard edits during loading. Parent return uses persisted scope, highlights the owner and focuses the heading. Source refresh updates display context outside undo history while preserving local identity, name, geometry and edits. ADR list progress is separate from draft progress, and stale list requests cannot overwrite a switched context. The named-child and nested-library browser screenshots were visually inspected.

| Check | Result | Evidence |
| --- | --- | --- |
| Test-first phase 5 batch | Expected failures observed | Save-response mismatches, missing nested projection/current scope, stale navigation and broken-reference handling failed before implementation. CLI scope columns and concurrent/stale ADR list tests also failed before their fixes. |
| `RUN_POSTGRES_TESTS=1; npx.cmd vitest run --maxWorkers=4` | Passed, no skips | 77 files and 374 tests, including actual PostgreSQL persistence, migration, concurrency and ADR acceptance checks, plus API, frontend state, library and CLI regressions. |
| `npm.cmd run build` | Passed | Shared, backend, frontend and CLI builds; existing Vite main-chunk size warning remains. |
| Navigation/library Playwright batch, one worker | Passed | All 28 scenarios across container diagrams, diagram-list management, new diagrams and saved diagrams. A temporary headless override used the existing configured browser and was removed after validation. |
| Enhanced source and keyboard browser checks | Passed | The parent rename/regroup and dirty-ADR source-navigation scenario passed after its additions. The nested child keyboard open/delete-cancel/focus scenario also passed after its additions. |
| Additional general browser regressions | Passed | Seven general grouping, two performance and one responsive scenario passed in the broader browser batch. |
| `git diff --check` | Passed | No whitespace errors. |

The broader browser batch initially exposed repeated ADR list loading and ancestor list selectors made ambiguous by nesting. Both were fixed; all affected scenarios passed in the clean 28-test navigation/library rerun. Drizzle transaction isolation/access-mode options were verified through Context7 (`/drizzle-team/drizzle-orm-docs`). These results establish Phase 5 behavior without completing the later recovery/export or full release-validation tasks.

## Phase 6 implementation results

Captured on 2026-10-03 for T061–T084. All 24 US4 tasks are complete. T085–T090 remain outstanding. No dependency, lockfile, database schema or migration changes were made. `.specify/feature.json` still points to this feature; `.specify/extensions.yml` is absent, so no implementation hooks are registered.

Source protection identifies each active or recoverable occurrence by child UUID/name/status, source UUID and local occurrence UUID, with instructions to restore when necessary and explicitly repair relationship/ADR links before removal. Dependency previews and rejected document saves retain those details and preserve saved artifacts, editor drafts and history. Supported Person/Software System changes remain available unless the source owns a child. Child ADR pickers display Application/Datastore, use local occurrence and relationship IDs, exclude the synthetic boundary and retain lifecycle/replacement rules and parent isolation.

Trash and restoration use the parent-first graph transaction, re-enumerate current children after acquiring the parent lock and compare exact confirmation sets. A fresh common server-only batch/root marker is written only to currently active affected diagrams. Restoration from a child previews its canonical parent and the exact matching batch, rejects missing multi-diagram confirmation or changed IDs/batch, and excludes an independently trashed earlier child. Legacy null provenance remains a single-row operation. Restored documents are staged and validated in the same transaction; broken owners/sources roll back all statuses and provenance without changing artifact identities, creation times, content, geometry or ADR links. Memory snapshots include provenance and capture ADR state after acquiring the graph lock.

One recovery coordinator handles library, inspector, owner and double-click entry points. Named native confirmations support cancel, stale-preview reconfirmation, affected diagram/ADR Save/Discard/Cancel guards and a separate earlier-child confirmation. Both active and trash lists refresh together by UUID; earlier responses cannot overwrite recovered lists. Failed list refresh and failed requested-child loading have distinct retries that never replay a successful restore. Owner confirmation returns keyboard focus on cancel; modal callbacks retain their current action without recapturing focus on each render. Removal responses are normalized before editor updates, preserving legacy general-diagram context and success feedback.

Mermaid exports validated populated children with complete subtype/name/responsibility/technology labels, owner subgraph, scope/source comments and external nodes/interactions after the subgraph. Protocols and multiline/Unicode/hostile text are escaped; empty children return actionable `422 EMPTY_CONTAINER_MERMAID`, and missing subtype errors identify the artifact, field and Application/Datastore remedy. SVG/HTML support empty boundaries, full labels, canonical scope and source metadata, local anchors and printable details. Render-only label growth separates overlapping cards, reserves multiline owner headings, relocates external participants and includes labels in the viewBox without changing saved geometry. Parent packages explicitly state that child contents are not bundled.

Browser HTML export clones the current child and ADR draft before source lookup, overlays only current same-scope owner/source display metadata, accepts eligible unsaved occurrences and downloads nothing on validation/context failure. CLI export reuses the phase 5 normalized saved GET and the existing package builder; new tests prove saved subtype retention versus an unsaved browser subtype, empty-child support, unchanged ZIP paths and no output-file opening for invalid artifacts. Backend Mermaid export uses the same source resolver and rejects inactive/broken graphs. No recursive packages or live-application links were added.

| Check | Result | Evidence |
| --- | --- | --- |
| Test-first phase 6 batch | Expected failures observed | Dedicated recovery, blocker, export and draft-context tests failed on missing APIs/provenance/metadata and general-only export validation before implementation. Later checks exposed stale list responses, recovery focus loss, legacy removal context resets and overlapping long-label exports; each was repaired and covered. |
| `RUN_POSTGRES_TESTS=1; npx.cmd vitest run --no-file-parallelism` | Passed, no skips | 86 files and 416 tests, including PostgreSQL persistence/migrations/ADR acceptance and existing general/group/CLI/export regressions. |
| Final phase 6 and export-validation batch | Passed, no skips | 59 tests across 12 files after the final artifact/field/subtype-remedy refinements. The nine dedicated phase 6 files contribute 42 tests; existing validation/Mermaid/group-export files contribute 17. |
| Memory and actual PostgreSQL recovery cases | Passed | 14 dedicated persistence cases: exact batch/exclusion and stale provenance; memory snapshot/whole-batch rollback; PostgreSQL identity/creation-time preservation and broken-source rollback with ADR links; changed impact versus canonical creation; ADR writes versus trash; source deletion/retyping versus occurrence creation/removal; recoverable occurrence protection; restore/source-write/parent-trash and competing-restore serialization. Competing transactions use explicit barriers rather than sleeps. |
| `npx.cmd tsc -b frontend` and `npm.cmd run build` | Passed | Frontend type check plus shared/backend/frontend/CLI builds. Vite retains its main-chunk size warning. PostgreSQL runs emit a non-failing concurrent-client deprecation warning. |
| Combined Playwright checkpoint, one worker | Passed | 49 scenarios across container diagrams (20), diagram-list management (9), recovery (2), HTML package export/portability/ADRs (5), general system groups (7) and ADR tagging/lifecycle (6). A temporary headless configuration used the existing installed browser and was removed after validation. |
| Container recovery browser scenarios | Passed | Named parent preview/cancel, dirty child and ADR save-before-trash, owner keyboard restore/focus, active/recoverable occurrence feedback, stale same-ID batch reconfirmation, earlier-independent-child separate restore, full list reconciliation and refresh/load retries without repeated POST. Child ADR creation/linking/supersession, rename and protected artifact removal use the actual in-memory API contracts. |
| Offline container export inspection | Passed | A browser-downloaded ZIP with Application and Datastore, Unicode/multiline metadata and protocol opens through `file://`; keyboard local-occurrence links reach ADRs and return to the exact relationship. SVG text bounds stay inside the viewBox and cards do not overlap. HTML/SVG screenshots were visually inspected after correcting label-growth overlap. |
| `git diff --check` | Passed | No whitespace errors. Ignore files already cover the generated screenshots/packages and build outputs. |

Mermaid quoted labels, entities, subgraphs and directed labeled edges were verified with Context7 (`/mermaid-js/mermaid`). Phase 6 completes the US4 checkpoint and updates the task summary to 84 completed/6 outstanding. The phase 7 scale envelope, documentation, full release journey, observed participant timing/readability and final requirement reconciliation are still unchecked; these story-level results do not substitute for those gates.

## Phase 7 release validation

Captured on 2026-10-05. T085–T088 are complete; the final combined browser run passed all 66 scenarios.
T089 and the final T090 sign-off remain outstanding. The user explicitly requested an observation
worksheet and leaving the usability gate open because participant results are not available.
Earlier phase records above are historical; this section records the current release evidence.

No runtime dependency, lockfile, migration or artifact schema changed in this phase. Migration 0005
is preserved; deployment guidance requires forward 0006 before the subtype-aware runtime. The
feature pointer still selects `specs/009-c4-container-diagrams`. The 16-item requirements checklist
passed and its markers were not edited. Existing Git/Docker ignore patterns cover generated output;
the packages are private and no publishing ignore file is required. `.specify/extensions.yml` is
absent, so there are no pre/post implementation hooks.

### Changes and checks

- T085 adds a deterministic fixture with 100 internal containers (both subtypes), 100 distinct
  external sources (both source types), and 300 directed relationships. A general diagram with
  independent UUIDs provides the same-size comparison. Shared tests validate complete Mermaid,
  SVG and HTML output, all component/relationship identities, immutable input, SVG bounds,
  deterministic displacement and clearance. Browser checks load all 200 cards and 300 edges,
  edit/save the same diagram, preserve the parent and export Mermaid/HTML. This is an exercised
  envelope, not a product limit.
- T086 updates README and quickstart for migration/deployment order, exactly-two-choice editing,
  form reset, both entry points, source editing, child save/retry, nested filters/counts, guarded
  navigation, occurrence-specific source blockers and explicit removal, exact root/batch recovery,
  stale confirmation and earlier-independent-child restoration. Browser draft versus saved CLI
  export and empty Mermaid alternatives are explicit. Quickstart includes the participant protocol
  and blank recording worksheet.
- The keyboard-only journey exposed a general-canvas selection gap: Enter on a focused node did
  not update the inspector. General Enter/Space/Escape now use the existing controlled selection
  path, retaining Shift semantics and ignoring nested interactive controls. Child selection and
  arrow movement retain their established React Flow path. The journey reaches controls via Tab
  and uses keyboard input for selection, child creation, adding/editing containers, interaction
  creation, saving and parent return. It uses no pointer actions or programmatic focus.
- The old general performance test timed the entire authoring sequence as save latency. Its
  three-second save assertion now starts immediately before Save; authoring time is reported
  separately. The grouping drag regression now fits the viewport before pointer coordinates,
  waits for enclosure rather than sleeping, and compares sizes in diagram units. Its previous
  screen-space/off-screen drag assumptions failed during the broader run; the corrected scenario
  passed three consecutive repetitions.
- Contract reconciliation corrected `SourceElement` to the implemented `id/name/description/type`
  summary. Parent identity is supplied once by `scope.parentDiagramId`; the shared strict context
  schema and resolver already use this shape. No API payload/runtime change was introduced.
  The OpenAPI 1.2.0 introduction now describes completed behavior. All 77 reference targets and
  11 local README/quickstart links resolve. This was a reference-target check, not a new YAML parse.

| Check | Result | Evidence / limits |
| --- | --- | --- |
| `npm.cmd run build` | Passed | Shared/backend/frontend/CLI; existing Vite large-chunk warning remains. |
| `RUN_POSTGRES_TESTS=1; npm.cmd test -- --no-file-parallelism` | Passed, no skips | 87 files, 418 tests; JSON result reports 418 passed, zero failed/pending. |
| Dedicated PostgreSQL installation | Passed | Fresh `spec009_phase7_*` database created by this run and installed through 0006; no configured application database migration or fixture cleanup was performed. |
| Existing populated 0005 → 0006 upgrade | Passed | All three migration cases execute in isolated schemas: legacy preservation/constraints and populated active/trashed subtype backfill with explicit null/unsupported subtype rejection. |
| PostgreSQL feature persistence/races | Passed | Four canonical-creation cases, six editing round trips, 14 recovery cases (memory plus actual PostgreSQL), graph/write-guard/ADR suites; all enabled and executed. Includes source creation/removal/retyping races, exact restore sets/batches, competing restores, broken-source rollback and identity/link preservation. |
| Final shared scale fixture | Passed | Both scale tests rerun after assigning independent baseline artifact UUIDs; no input mutation or export omission. |
| Combined browser release gate | Passed, no skips | All 66 scenarios across 16 files passed together in 2.9 minutes, including all 21 container cases and the corrected general grouping check. The JSON report records zero skipped, unexpected or flaky cases. Earlier runs encountered server-shutdown hangs and the grouping test assumption; the final runner reused verified validation servers, exited successfully and produced its JSON report. Interrupted runs are not counted as aggregate passes. |
| Offline HTML/SVG/ADR inspection | Passed | New browser-downloaded container ZIP extracted under `test-results/container-offline-package`, opened through `file://`; local occurrence → ADR → relationship navigation succeeds. SVG browser checks find no clipped text or overlapping cards. Updated HTML/SVG screenshots were visually inspected: both subtype labels, technologies, full Japanese/quoted metadata, external Ledger and HTTPS remain readable. Existing relocation/Markdown/CSS/keyboard package checks also execute. |

Local machine: Windows, Node.js 22.17.1, installed Chrome, Vite development server and one browser
worker. Unit timings use an in-memory repository; browser envelope requests execute actual Fastify
routes/services against an in-process memory repository. Database behavior is established by the
separate actual PostgreSQL suites, not by browser transport timings. JSON reports and screenshots
remain ignored under `test-results/`; temporary validation runners are removed after use.

Actual PostgreSQL runs retain the existing non-failing concurrent-client deprecation warning.
Dedicated validation databases created by this work are removed by exact name after validation.
The configured application database is unchanged. Current Playwright evidence handling and React
Flow keyboard selection were verified through Context7; the selection behavior matches the
[official accessibility guidance](https://reactflow.dev/learn/advanced-use/accessibility).

### Scale measurements (single local samples, milliseconds)

| Shared operation | General: 200 elements / 300 relationships | Child: 100 containers / 100 externals / 300 relationships |
| --- | ---: | ---: |
| Structural/invariant validation | 3.63 | 8.91 |
| SVG layout | 5.27 | 32.48 |
| Mermaid generation | 3.52 | 9.43 |
| SVG generation | 17.53 | 48.13 |
| HTML package rendering | 205.55 | 429.33 |
| Child domain boundary/displacement | — | 12.62 |

Source hydration plus active summaries took 5.50 ms for this fixture: **one parent repository read,
zero per-source repository lookups, one list snapshot**. HTML browser export makes exactly one
container-context request for all 100 external sources; general export makes none. In-memory
matching does not constitute per-source database/network queries. No new limit or lookup mechanism
was introduced.

| Browser operation | General scale envelope | Container scale envelope |
| --- | ---: | ---: |
| Load all cards/edges | 835.00 | 940.30 |
| Name edit/unsaved feedback | 307.60 | 230.00 |
| Save/saved feedback | 338.00 | 328.80 |
| Mermaid download | 79.70 | 121.40 |
| HTML ZIP download | 218.70 | 515.70 |

The original five-component/five-relationship general baseline recorded 1,202.60 ms for automated
authoring, 52.30 ms for save feedback and 34.90 ms for Mermaid download using mocked transport.
Scale save and Mermaid feedback meet the existing three-second checks. Container rendering does
more metadata/layout work than the general comparison; these single samples describe the local
harness and are not production latency guarantees, statistical benchmarks or usability rates.

### FR-001–FR-024 evidence reconciliation

All listed suites passed in the current automated validation and clean final browser aggregate.
Paths are repository-relative.

| Requirement | Current evidence |
| --- | --- |
| FR-001 | `e2e/tests/container-diagrams.spec.ts`: grouped-system double-click and repeated entry; `backend/tests/contract/container-diagrams.test.ts`. |
| FR-002 | Same browser suite: native inspector Create/Open/Restore, external-source entry and complete keyboard journey. |
| FR-003 | `backend/tests/persistence/container-diagrams.test.ts`: real concurrent/repeated creation, all-status uniqueness, rollback/winner resolution; duplicate-name browser cases. |
| FR-004 | Entry contracts/UI/browser cases reject Person/group/invalid owner paths; grouped systems remain eligible. |
| FR-005 | Entry-store/browser Save/Discard/Cancel, persisted-owner prerequisite, availability failure and create-succeeded/load-failed retry without duplicates. |
| FR-006 | `shared/tests/container-layout.test.ts`, scale tests and browser pointer/keyboard/resize scenarios: empty/fitted boundary, clearance, deterministic displacement and rejected overlap. |
| FR-007 | Shared schema/compatibility, PostgreSQL migration/editing and frontend/browser authoring: exactly Application/Datastore, required complete text, subtype retention and wrapped labels. |
| FR-008 | Shared invariants, editing contracts/store and authoring/browser keyboard connection: directed description/protocol, local endpoints, external-to-external/boundary rejection. |
| FR-009 | Context/editing contracts and browser external picker/source refresh: owner/duplicate/other-parent rejection, read-only projections and independent positions/IDs. |
| FR-010 | Navigation store/browser cases: level/owner heading, guarded parent/library/source return, dirty diagram plus ADR, canceled/failed/stale operations preserve work. |
| FR-011 | `frontend/tests/diagram-list.test.ts`, saved-list tests and browser named/duplicate child cases: canonical parent nesting, own-field matches, contextual headings and exact counts. |
| FR-012 | PostgreSQL editing/recovery/migration and browser reopen/rename/regroup: scope, own name, identities, geometry, subtype, creation times and ADR references preserved. |
| FR-013 | Container-store/history and browser authoring/geometry: atomic details/subtype/layout undo/redo with stable endpoints and occurrence identities. |
| FR-014 | Container ADR contracts and browser create/link/supersede/protected removal; child local component/relationship targets and no inherited parent decisions. |
| FR-015 | `backend/tests/contract/container-dependencies.test.ts`, write guards and actual PostgreSQL recovery races: active/recoverable occurrence/source UUID blockers and unchanged source/occurrence/relationship/ADR data on rejection. Browser actionable active/trash feedback also passes. |
| FR-016 | Contract/repository/browser exact named parent batch, cancel, active-only cascade, dirty affected child/ADR guard, preserved older independent trash and rollback. |
| FR-017 | Restore-impact contracts, PostgreSQL provenance/competing restore cases and browser child-initiated root confirmation: inactive direct-child conflict, stale ID set/batch, earlier-child exclusion/separate restore and complete active/trash list reconciliation. |
| FR-018 | Existing general/container ADR/local relationship blockers plus browser canceled removal and stable artifact/link assertions. |
| FR-019 | Shared container/scale export, backend export, CLI command and browser offline cases: complete validated labels/subtypes/scope/protocol/anchors; browser captured drafts vs saved CLI; explicit empty Mermaid alternative and unbundled-parent scope. |
| FR-020 | Actual clean install and populated upgrade; shared/general legacy compatibility, grouping, ADR, CLI and export suites; grouping browser fix repeated three times. No migration/identity rewrite. |
| FR-021 | Accessibility/contrast contracts, native entry/recovery/list controls, live errors/progress, keyboard-only journey, Escape/focus return and source/type text cues; exported screenshots inspected. Participant recognition remains SC-004's separate gate. |
| FR-022 | Strict shared schemas/invariants, editing/write-guard contracts and export negatives: invalid subtype/type/text/endpoints/geometry/source/scope rejected before partial persistence/download. |
| FR-023 | Navigation contracts/store/browser named-child sequence: same child PUT/name/kind/scope after repeated save, Save-before-navigation, refresh/list, rename, duplicate parents and failed/mismatched response retry; unchanged parent and one child summary. |
| FR-024 | Subtype/store/UI/browser authoring and stale parent form reset: unsupported internal general types fail without artifacts/history; separate parent-source inclusion remains available. |

### SC-001–SC-010 and remaining release gates

| Criterion | Status | Evidence / outstanding observation |
| --- | --- | --- |
| SC-001 | Not observed | 0 first-time author participants; no observed times, success rate or errors. Need ≥90% within 30 seconds across the requested entry points. Automated creation is not participant evidence. |
| SC-002 | Automated pass | Repeated/concurrent/grouped/duplicate-label tests resolve the intended owner with one canonical child; all enumerated cases pass. |
| SC-003 | Not observed | 0 author participants; no complete prepared three-container/two-internal/one-external modeling time. Need complete modeling under five minutes. |
| SC-004 | Not observed | 0 reviewer participants; no observed scope/container/technology/external recognition time or rate. Need ≥90% within one minute, without color dependence. Screenshot inspection establishes layout only. |
| SC-005 | Automated pass | Current save/reopen/rename/geometry/history/migration/trash/restore cases preserve expected identities/scope/content/creation times and local ADR links. |
| SC-006 | Automated pass | Current negative contracts/store/CLI/browser cases retain work, report actionable failures and produce no partial success/download. |
| SC-007 | Automated pass | Entire Tab-only selection/create/add/edit/connect/save/return journey passes; Enter/Space/Escape selection and parent heading focus are checked. |
| SC-008 | Automated pass | Existing general/group/ADR/CLI/export workflows pass, including corrected viewport-aware grouping regression. |
| SC-009 | Automated pass | Both subtype choices, editing/history/save/reopen, parent-to-child draft reset and rejected unsupported internal commands/writes; external picker types unchanged. |
| SC-010 | Automated pass | Repeated child save/navigation/list/filter/refresh/duplicate-name/retry and malformed response cases preserve own child ID/name/kind/scope and unchanged parent content. |

The [quickstart observation worksheet](./quickstart.md#participant-observation-protocol-t089)
records participant counts, entry points/answers, actual seconds, success and errors/assistance.
No participant observations were conducted or supplied; percentages with zero participants are
undefined, not 0% or a pass. Offline export inspection is complete as part of T089, but its three
observed usability checks are not. T090's requirement reconciliation is recorded here provisionally;
final sign-off depends on T089. Both tasks must stay unchecked until that evidence is recorded and
assessed. There is no waiver inferred from passing automated tests.
