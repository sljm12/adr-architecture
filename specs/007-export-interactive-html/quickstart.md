# Quickstart Validation: Parent and Container HTML Package Export

**Updated**: 2026-10-06. Run these scenarios after implementing the updated [plan](plan.md). Planning does not establish implementation completion. Contracts: [source](contracts/export-source.md), [OpenAPI](contracts/openapi.yaml), [package](contracts/package-format.md), [UI](contracts/ui-contract.md).

## Prerequisites and commands

Use installed Node.js/npm and a dedicated PostgreSQL database. The current production dev server requires DATABASE_URL; the in-memory repositories are test doubles, not a selectable dev-server mode. Set DATABASE_URL in the API process environment (backend/.env is not automatically loaded). Apply only pending migrations in order through 0006_container_component_types.sql, as documented in README.md; this export extension adds no migration.

From the repository root in PowerShell:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd test
$env:RUN_POSTGRES_TESTS = '1'
npm.cmd test
npm.cmd run test:e2e -- --workers=1
npm.cmd run dev
```

The .cmd suffix avoids PowerShell script execution-policy restrictions. Configure DATABASE_URL before starting the server or database checks; never put production credentials in validation artifacts. Frontend is http://localhost:5173, API http://localhost:3000. Browser tests start both servers through playwright.config.ts and require a reachable migrated database and configured browser. Skipped PostgreSQL cases do not prove race/transaction behavior.

Phase 7 added the scoped playwright.offline.config.ts and reusable fixtures described in the plan. Run the offline projects separately from the app suite:

```powershell
npx.cmd playwright install firefox webkit
npm.cmd run test:e2e -- --config=playwright.offline.config.ts --project=offline-chrome --workers=1
npm.cmd run test:e2e -- --config=playwright.offline.config.ts --project=offline-edge --workers=1
npm.cmd run test:e2e -- --config=playwright.offline.config.ts --project=offline-firefox --workers=1
npm.cmd run test:e2e -- --config=playwright.offline.config.ts --project=offline-webkit --workers=1
```

These projects are available; parent/container journey coverage still requires the subsequent implementation phases. Chrome/Edge projects use existing installed stable chrome/msedge channels; the Firefox/WebKit projects use Playwright's engine builds. The scoped config removes inherited app launch options, including PLAYWRIGHT_EXECUTABLE_PATH. Engine coverage complements the four product-browser rows below. Official [browser configuration](https://playwright.dev/docs/browsers) and [CLI project selection](https://playwright.dev/docs/test-cli) document these options; see research Decision 8 for product-browser limits.

## Four-browser offline acceptance matrix

Run the same extracted representative package in actual current stable Chrome, Edge, Firefox and Safari, using a supported desktop operating system for each. Perform the local package journeys in scenarios 2–6 and the direct-child/no-child/empty-state checks in scenarios 9–10, with normal settings and network disabled. Confirm local file URLs remain in use after navigating and relocating. Application servers may generate the original export, but must not serve the package for these checks.

| Required actual browser | Acceptance route | Version / OS / date | Journey results and evidence | Status |
| --- | --- | --- | --- | --- |
| Chrome stable | Installed branded browser; matching offline-channel automation or actual session | Record at validation | Record every required journey and package identity | Pending |
| Edge stable | Installed branded browser; matching offline-channel automation or actual session | Record at validation | Record every required journey and package identity | Pending |
| Firefox stable | Actual installed stable Firefox session | Record at validation | Record every required journey and package identity | Pending |
| Safari stable | Actual Safari session on supported macOS | Record at validation | Record every required journey and package identity | Pending |

Retain engine regression reports separately with exact build and operating system. A Firefox engine or WebKit project is not an actual Firefox/Safari acceptance row. Unavailable browsers remain Pending; do not mark skipped coverage as passed. Release acceptance requires all four product-browser rows to pass. Capture trace/screenshots where available and written per-journey observations for manual sessions; never invent results.

For keyboard journeys, start from normal page focus and use the browser's native keyboard navigation/activation to reach artifact links, child actions, ADR links and parent return. Check visible focus and continuation after page/fragment navigation. Locator.focus() plus Enter alone does not prove reachability. Disable network explicitly before opening extracted file pages in automated runs; disconnect network for manual sessions after obtaining the package. Security-setting changes and file-access launch flags are not acceptable workarounds. If a browser exposes a focus/navigation difference, fix the generated markup or provide the specified keyboard-accessible text route and rerun the same journey.

## Representative fixture

Create a general/System context with two Software Systems sharing a name, a Person, a third system without a child, and an independently trashed child. Group systems where valid. Create two active children: one with Application and Datastore, responsibilities, technologies, directed relationships/protocols and source-linked external participants; another may start with an empty labeled boundary. Include an external Software System occurrence whose source owns the other active child.

Across parent and children, create component-linked, relationship-only and unlinked ADRs in draft/accepted/superseded/rejected states, with valid same-diagram replacement references. Repeat artifact/ADR names across diagrams. Preserve prepared IDs and expected link sets for comparison.

## End-to-end scenarios

1. Export the System context. Confirm one ZIP with root entry/SVG, one HTML/SVG pair per active child, one shared stylesheet/catalog and one Markdown per ADR. Trashed/unrelated children are absent. Entry opens the selected context; no creation/restoration/save takes place.
2. Extract and open index.html from disk with network disabled. Select a system; its exact ADRs remain available. Activate Open container diagram, inspect complete child boundary/subtypes/responsibilities/technology/external details/layout/relationships/protocols, then return to the parent owning-system anchor. Repeat with the duplicate-name owner to prove UUID routing.
3. Select child containers, external occurrences and relationships. Each shows only directly linked local ADRs, including no-links states. An external Software System opens its source's already bundled child; no parent/source ADR inheritance or extra inclusion occurs. No-child/trashed-child systems explain the absence without broken/create/restore links.
4. Browse adrs.html. Verify every included ADR once, with scope, status, dates, full fields and replacements. Follow component and relationship references into the exact owning page and artifact. A child with no ADRs has a local empty state; an entirely ADR-free package has a catalog empty state.
5. Use only Tab/Enter for context artifact selection, child action, child relationship ADR, catalog, ADR backlink and parent return. Verify visible focus/readable labels and scope independent of color. Observe the 2-minute representative reader journeys in SC-003/SC-007, recording actual sample size, time and success rates.
6. Open every standalone SVG in a standard editor and every ADR Markdown file in a reader. Check complete vector content and diagram-qualified links. Change the two documented stylesheet colors and reload root and child HTML; all update while selection/ADR/parent navigation still work. Move the extracted directory and repeat links. Check every generated href/style reference and fragment against actual files/IDs.
7. Make an unsaved parent owner rename, source description/type edit and layout change, and edit an ADR; export. Children use the captured owner/source fields while retaining local IDs/layout/ADR links. Pause source retrieval, edit the application again, resume and verify only the captured draft appears. Repeat a valid unsaved new ADR and invalid unfinished draft; invalid content gives field feedback and no ZIP.
8. For currently retained session state, validate the active draft overlay and saved other diagrams. Current stores have no inactive draft cache. At the aggregate input boundary test multiple provided retained overrides, ignored unrelated/stale overrides, and draft owner/source removal or reclassification that invalidates a required child. Those invalid required references fail without omission or saves. Save-in-progress and duplicate export attempts block clearly.
9. Export a directly selected populated child and a valid empty child. Each remains a single-diagram root package with complete context, local ADRs and boundary, no parent/sibling navigation. Include an unsaved external occurrence from an eligible saved parent source and verify context resolution.
10. Validate a no-child System context, legacy/general documents and existing CLI direct parent/child exports. Preserve root filenames, geometry and ADR behavior; CLI remains single-diagram, Mermaid/separate SVG scope remains unchanged.
11. Simulate a required active child failing to load, mismatched ownership, missing external source, bad endpoint/ADR/replacement link, duplicate UUID/output path, invalid geometry/subtype, unsupported control character, and archive rejection. Every case yields diagram/artifact/field/remedy feedback, no successful partial download, and unchanged editor/database state.
12. Add an unrelated corrupt diagram and verify a valid selected package still exports. Race source gathering against save/create-child/trash/restore/ADR mutations using the coordinated database test harness. Assert a complete before-or-after saved graph, no mixed membership, no missing active child filtering and no row/timestamp/trash mutation from the export read.
13. Build the aggregate scale fixture (up to 10 children, totals 100 components, 200 relationships, 100 ADRs). Verify one source request, no per-ADR requests and no omission. Record source time, total export/local-open time, machine/browser and archive size against the 10-second engineering target; do not misreport fixture limits as export caps.
14. Complete the four-browser matrix above on current stable desktop releases. Repeat diagram rendering, parent/child and external-source actions, exact ADR sets/catalog/backlinks, keyboard journeys, CSS recoloring and relocation in every row. Record actual version/OS/date and proof; single-diagram/no-child/empty-child cases must retain their scope and empty states. Browser-specific failures block that row instead of changing the acceptance conditions.

## Automated proof and requirement coverage

| Requirement / outcome | Required validation |
| --- | --- |
| FR-001–FR-003, FR-016; SC-001–SC-002 | Source API completeness, raw active membership, root/child manifests, complete C4 SVG/HTML content, valid empty children. |
| FR-004–FR-007, FR-019; SC-003 | Exact local ADR sets/all statuses, catalog deduplication and scope, same-diagram replacements and artifact backlinks. |
| FR-008–FR-011, FR-023; SC-004–SC-005, SC-008 | Per-diagram SVGs/all Markdown, path registry and resolved link targets, duplicate names, owner/source overlays and shared recoloring. |
| FR-012–FR-014; SC-006, SC-009–SC-010 | Frozen captures, later edits, errors/escaping, retained draft inputs, graph race/zero-write checks and atomic archive failure. |
| FR-015, FR-017–FR-018, FR-020–FR-021; SC-007 | Pointer/keyboard parent-child-source actions, return anchors, focus/default contrast, no-link exclusions and observed reader journeys. |
| FR-022, FR-024; SC-011 | Direct-child/no-child/trash/legacy compatibility, unchanged single builder and CLI/Mermaid/separate SVG scope. |
| FR-025; SC-012 | All four actual stable desktop browser rows pass required offline journeys; exact version/OS/date/evidence recorded; normal settings, disabled network, file URLs and real keyboard reachability. |

Shared tests exercise pure aggregate assembly, source resolution, scoped errors, path/link registry, catalog, Markdown, complete SVG and no-output-on-failure behavior. Backend contract/persistence tests exercise new source responses and graph coordination with both repository implementations. Frontend tests exercise capture and status/no-side-effect behavior. Extend existing html-package and container suites in e2e/tests for real ZIP extraction, file URLs, relocation, keyboard and styling. Retain existing CLI builder tests.

## Completion evidence

Record actual commands/results, skipped gates, all four FR-025/SC-012 browser rows and observed SC-003/SC-007 usability and timing evidence as implementation proceeds. T001-T040 remain historical; completed extension phases and their validation are recorded below.

### Phase 7 setup validation (2026-10-06)

- T041-T043 are complete. Shared fixtures reuse Spec 009 documents and expose included/excluded identities, exact local ADR sets, owner returns, sibling actions and expected file paths. Browser fixtures seed matching saved data through existing API endpoints with fresh IDs, capture one real ZIP download, inventory files/anchors, and navigate/relocate extracted directories by file URL with network explicitly disabled. No dependencies, migrations, source endpoint or aggregate renderers were added.
- `npm.cmd run build` passed; Vite retained its existing non-blocking chunk-size warning. A targeted strict `tsc --noEmit` check covering the fixture modules, offline smoke suite and config passed.
- The six new Vitest fixture/infrastructure checks passed, including real API requests against isolated in-memory repositories. This is not PostgreSQL persistence or transaction evidence.
- `npm.cmd test` under concurrent build/browser load reported 14 API-test timeouts. Rerunning `npm.cmd test -- --maxWorkers=2` passed: 403 tests passed, 28 skipped, 86 test files passed and 4 skipped. PostgreSQL checks were not enabled; their gates remain pending.
- `npx.cmd playwright test --config=playwright.offline.config.ts --project=offline-chrome --project=offline-edge --workers=1` passed all 12 tests on Windows: historical single-diagram suites plus a synthetic root/nested offline helper smoke test in each branded browser. After integrating the real-download helper into the existing export test, the targeted `--grep 'downloads a package'` rerun passed both projects.
- All four scoped projects are independently selectable; config checks confirm Firefox/WebKit inherit no Chromium executable or launch flags, and the existing app config remains unchanged. Firefox/WebKit engine execution, full parent/container journeys, observed usability and all four product-browser acceptance rows remain pending. Setup results do not complete FR-025/SC-012 acceptance. The next phase is Phase 8 (T044-T052).

### Phase 8 foundation validation (2026-10-06)

- T044-T052 are complete. `GET /diagrams/:diagramId/export/html-source` returns the selected general diagram and its UUID-ordered active direct children with complete local ADR sets, or one directly selected child with canonical scope and all eligible source summaries. Raw parent-scoped membership retains expected child IDs before hydration; no global listing, nested context transaction, per-ADR lookup, save, creation, restore or rendering occurs during gathering. General legacy inputs normalize through the existing domain schema. Shared capture/source/snapshot types remain transient; the existing single-diagram builder and browser export integration are unchanged in this foundation phase.
- The initial `npm.cmd test -- --maxWorkers=2 shared/tests/html-export-source.test.ts backend/tests/contract/html-export-source.test.ts backend/tests/persistence/html-export-source.test.ts` run confirmed missing schema/endpoint/service behavior before implementation. An additional failing duplicate-child-ID regression confirmed a 500/422 classification gap, which is now fixed by resolving canonical metadata before applying the export validator.
- `node test-results/spec007-phase8-database-check.cjs` created a dedicated temporary PostgreSQL database, supplied its URL only through the child process environment with `RUN_POSTGRES_TESTS=1`, and executed `npm.cmd test -- --maxWorkers=2 shared/tests/html-export-source.test.ts backend/tests/contract/html-export-source.test.ts backend/tests/contract/openapi.test.ts backend/tests/persistence/html-export-source.test.ts`. The final run passed all 54 checks in four files, including all nine PostgreSQL cases, on Windows with PostgreSQL 17.4. The temporary database `spec007_source_ac55e3fe88ae4752a710493399b21493` was migrated through existing migrations 0001-0006 in a unique test schema and removed after the run. The local wrapper is an ignored validation artifact under `test-results/`.
- PostgreSQL evidence covers parent-first sorted row locks, expected IDs versus unavailable loads, bounded full-ADR reads (one ADR query per included diagram plus two link queries for each nonempty set), detached responses, and exact equality of rows before/after gathering across diagrams, components, relationships, groups/members, ADRs and both link tables. This equality includes creation/update/trash timestamps and trash provenance. Six gated competing mutations (save, child creation, trash, restore, ADR content and ADR links) return the complete before graph; a coordinated owner/ADR commit before the read lock returns the complete after graph. Invalid required members fail without partial responses.
- `npm.cmd run build` passed for shared, backend, frontend and CLI, with the existing non-blocking Vite chunk-size warning. A targeted strict `tsc --noEmit` check of all new fixture/schema/contract/persistence test modules and `git diff --check` passed.
- `npm.cmd test -- --maxWorkers=2` passed: 446 tests passed, 37 skipped; 89 files passed and four skipped. The ordinary run skips the nine new PostgreSQL cases because the opt-in flag is absent; all nine passed separately in the dedicated database run above. Other existing gated checks remain skipped. The PostgreSQL run emitted the existing `pg` concurrent-query deprecation warning; it did not fail any checks.
- No extension hooks are configured. Phase 9 (T053-T067) is next. Browser aggregate capture/rendering/navigation, engine journeys and the four actual stable-browser release gates remain pending; this source-boundary validation does not establish their acceptance.

### Phase 9 extension MVP validation (2026-10-06)

- T053-T067 are complete. The browser synchronously clones its active document and eligible matching ADR draft with one timestamp, gathers one `html-source` response, overlays only included retained IDs, derives owner/source metadata, validates saved ADRs against saved documents and merged ADRs against captured documents, and renders the entire map before archiving. Required child, canonical association, source, endpoint, local ADR/replacement, identity or destination failures prevent download. No inactive draft cache, migration or dependency was added.
- Root and nested pages retain exact directly linked ADRs, full child decision details, complete C4 content, explicit none/trashed/empty states, UUID child/source actions and owner returns. One path registry resolves root/nested styles, catalog and diagram-aware ADR references. All generated HTML, SVG and Markdown file/fragment destinations are checked before ZIP creation. Standalone SVG selection anchors now resolve to their local vector groups. The single-diagram builder, CLI and separate Mermaid/SVG scope remain compatible. Full catalog presentation and Markdown scope enhancements remain in Phases 10-11.
- T053-T056 initially failed for missing aggregate assembly, registry, builders and capture behavior. A separate regression exposed ADR saves remaining in flight after editing changes the visible status to unsaved; an observational pending-save marker now blocks export through that interval without changing draft, history, navigation or save results. Both diagram and ADR saves and duplicate exports are blocked. Gathering, validation, rendering and archiving status updates precede their stages, and archive failures include a retry instruction.
- `npm.cmd run build` passed; the existing Vite chunk-size warning remains non-blocking. The final eight T053-T058 Vitest suites passed all 67 tests. `npm.cmd test -- --maxWorkers=2` passed 488 tests, with 37 existing opt-in database tests skipped; 92 files passed and four were skipped. A targeted strict `tsc --noEmit` check of the changed frontend, shared test modules and browser suite passed. The final added direct-child unsaved external occurrence case passed in the 23-test snapshot suite. PostgreSQL race suites were not rerun in this phase; their dedicated Phase 8 evidence above remains separate from these ordinary skips.
- Browser validation used a new dedicated PostgreSQL database for each run, migrated through existing migrations 0001-0006 and removed afterwards. The three HTML package suites passed all 20 tests under `offline-chrome` and `offline-edge` with one worker, including the persisted parent/two-child download, no-child and direct populated/empty child packages, exact relationship/occurrence ADR sets, native Tab/Enter owner navigation, a delayed source read capturing an unsaved owner rename, corrupt-child failure without download/write requests, and historical catalog/portability checks. After extending external-source sibling navigation to native Tab/Enter, both persisted journeys passed again. Parent source diagrams/ADRs/availability were equal before and after export, and the browser issued one export-source request, no per-owner/context/full-ADR export requests and no write requests.
- Environment: Node.js 22.17.1; Windows NT 10.0.26200.0; installed Chrome 154.0.8037.98 and Edge 154.0.4258.53, using their branded Playwright channels on 2026-10-06. Package pages were opened at `file://` URLs after explicit network disable, with no package HTTP server or custom security flags. Native text-link focus/activation covered parent system -> child -> relationship ADR -> artifact backlink -> parent owner, plus external occurrence -> included sibling. Fixtures were fresh UUID-remapped `htmlPackageFixture` graphs; browser runner `spec007-phase9-browser-check.tmp` is an ignored local validation artifact. Successful tests used normal channel configuration and no forced locator focus for the new journeys.
- Early browser runs exposed test issues: checking CSS outline on SVG links whose focus cue uses stroke, an API route glob intercepting Vite source modules, randomly ordered persisted relationships selecting an unlinked item, and Tab before a cross-page navigation completed. Those were corrected by traversing native text links, routing only root API URLs, selecting the relationship by its expected direct ADR set and waiting for each destination. All final journeys passed.
- No extension hooks are configured. Phase 10 (T068-T072) is next. Aggregate scale, aggregate recoloring/relocation, Firefox/WebKit engine runs, actual four-browser release acceptance and observed reader usability remain pending in later phases. The Chrome/Edge results here cover the Phase 9 checkpoint and do not complete the product-browser acceptance matrix or SC-003/SC-007 usability gates.

## Historical single-diagram implementation validation

Run on 2026-09-24 for Phases 4–6:

- `npm run build` passed. Vite reported its existing non-blocking warning for a minified chunk over 500 kB.
- `npm test` ran 242 tests: 235 passed, 6 skipped, and 1 failed. The remaining failure is the untouched `frontend/tests/save-controls.test.tsx` source-text assertion for `role="status"`; the current component assigns the status role conditionally.
- `npm run test:e2e -- --workers=1` passed all 43 browser tests, including ZIP download, offline navigation, keyboard focus, CSS recoloring, and the 100/200/100 scale case. The default six-worker run had one transient timeout in the existing performance scenario; that file passed alone and the serial suite passed.
- PostgreSQL-backed persistence checks were skipped by the test suite, so migration 0004 was not exercised against a live PostgreSQL database in this run.

The record above predates the parent-and-container extension and is not evidence that its source API, navigation or transaction gates pass.
