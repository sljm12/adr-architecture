# Quickstart Validation: C4 Container Diagrams

This guide validates the complete revised feature. Phases 1–6 implement entry points, authoring, canonical saves/nested lists, occurrence-specific source protection, confirmed child-initiated parent recovery and container exports, including migrations 0005/0006. Phase 7 records release evidence and observed usability separately; see [validation.md](./validation.md) for actual outcomes and outstanding gates. Use [plan.md](./plan.md) for the requirement matrix, [data-model.md](./data-model.md) for artifact rules, and [OpenAPI 1.2.0](./contracts/openapi.yaml) for endpoint shapes.

## Prerequisites

- Node.js 22/npm compatible with the checkout and its existing package-lock.json.
- A dedicated PostgreSQL validation database, configured through DATABASE_URL. Persistence suites create/remove fixtures; use a database without user work.
- psql and a Playwright-supported browser configured through playwright.config.ts.
- Completed implementation tasks before expecting the new scenarios to pass.

Use PowerShell from the repository root. npm.cmd avoids this workspace's script-policy restriction. The server reads process.env.DATABASE_URL; backend/.env is not automatically loaded by the current server.

## Setup and run

```powershell
npm.cmd install
$env:DATABASE_URL = 'postgresql://<user>:<password>@localhost:5432/<validation_database>'
$env:RUN_POSTGRES_TESTS = '1'
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0001_initial.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0002_adrs.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0003_system_groups.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0004_component_dimensions.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0005_c4_container_diagrams.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0006_container_component_types.sql
npm.cmd run build
npm.cmd run dev
```

Deployment order: preserve applied migration 0005, apply pending 0006 transactionally, then deploy
the runtime requiring `containerType`. Only existing internal rows receive the Application
compatibility default; new child writes must explicitly provide Application/Datastore. Do not run
these migration commands against an already-migrated schema without tracking which are pending.

For an existing validation database, apply only pending migrations in order through its migration runner. Preserve applied 0005; 0006 is now available. Seed an older database before 0005 and verify its IDs, timestamps, groups, relationships and ADR links remain unchanged. Separately seed a 0005 database with active and trashed children containing generic internal containers, then apply 0006. Verify only their new containerType is backfilled to application, all existing IDs/timestamps/type/details/layout/links persist, and general/external subtypes remain null. Application is the compatibility default; authors can change an existing data store to Datastore afterward.

Open http://localhost:5173; API health is http://localhost:3000/health. Keep DATABASE_URL available to backend/test processes.

## Automated checks after implementation

In another terminal with the same validation database configured:

```powershell
$env:RUN_POSTGRES_TESTS = '1'
npm.cmd test
npm.cmd run test:e2e -- e2e/tests/container-diagrams.spec.ts
```

For a stable complete release run, use `npm.cmd test -- --no-file-parallelism` and
`npm.cmd run test:e2e -- --workers=1`. A headless test configuration can override the existing
Windows browser launch setting without changing product behavior. Scale coverage lives in
`shared/tests/container-scale.test.ts` and `e2e/tests/performance.spec.ts`: 100 internal containers,
100 distinct externals and 300 relationships, compared with a general diagram of the same size
and the existing five-component baseline. Timings describe the validation machine and API harness;
they are not observed author/reviewer success rates or a product limit.

Vitest must include shared schema/layout/export, frontend state/adapter/UI, backend contract and real PostgreSQL feature tests. A skipped PostgreSQL suite is not a pass. Feature file names in plan.md are planned; task generation can align them with repository conventions.

Database coverage must exercise concurrent creation, creation versus parent mutation/trash, rollback, source references, whole-document dependency bypass, exact restore batches and ADR writes versus trash. Include existing general/group/ADR/CLI regressions in npm test. Browser checks cover both entry points, external source navigation, dirty diagram/ADR decisions, keyboard movement and recovery. Broaden browser checks when affected flows require it.

For this revision, include subtype schema/role rejection, memory/PostgreSQL round trips, 0005-to-0006 compatibility, stale parent form selections, child identity/scope save response checks, repeated-save retry and grouped list filters/counts. Recorded earlier checks do not establish SC-009/SC-010; capture new implementation results separately.

## End-to-end validation

### 1. Prepare a parent

Create and save Payments Overview with Software Systems Payments and Ledger and Person Customer. Optionally group the systems. Add another Software System named Payments to verify identity handling. Record stable IDs from saved data.

Expected: general diagrams/groups remain usable; only Software Systems have container-diagram actions. A group member remains eligible individually.

### 2. Use both requested entry points

Double-click Payments to create its child. Verify Container diagram, current system name and empty labeled boundary. Return to the parent, select Ledger and use Create container diagram. Repeat both entry points.

Expected: one canonical child per source ID, reopened thereafter. A Person/group cannot own a child. A failed child load leaves current work; retry opens any child already created. GET availability creates nothing; POST returns 201 new/200 existing or 409 RESTORE_REQUIRED.

### 3. Model containers and external participants

Use Add component and verify exactly Application and Datastore are offered. Create Web application (Application; customer interface, React), Payments service (Application; orchestration, TypeScript) and Payments data store (Datastore; transaction records, PostgreSQL). Add directed interactions with descriptions and one protocol. Use Include external participant to include Customer and Ledger from the parent and connect each to an internal container.

Expected: internal containers enclosed, people/systems outside, responsibilities/technology/protocol readable. Missing text, unsupported roles, owner-as-external, duplicate sources and external-to-external/boundary links fail clearly without partial artifacts. Parent positions and relationships are not copied or changed.

Expected for SC-009: Software System, Person and Unclassified are unavailable as internal types. Edit a subtype, undo/redo, save/reopen and confirm the chosen value and ID persist. Return to the parent, select Person/Software System in the creation form, then reenter the child: only Application/Datastore remain and stale parent form values cannot create an artifact. Invalid store commands and REST payloads missing subtype or using person/software-system fail without a partial artifact or history change. Existing external inclusion remains available.

### 4. Check geometry and history

Place an external occurrence near the boundary, then move/resize an internal container past a previous edge. Undo and redo. Move a container using keyboard arrows and save/reopen. Try moving an external occurrence inside the boundary.

Expected: internal bounds fit; overlapping externals move outside with clearance. One undo restores all effects and IDs. Keyboard movement persists. Direct invalid external movement is rejected and restores its previous valid geometry.

### 5. Exercise navigation and source refresh

Link ADRs to a container and relationship using existing lifecycle workflows. Leave diagram/ADR edits unsaved. Navigate through parent link, library and an external Software System's Create/Open action; exercise Save, Discard, Cancel and a failed save. Rename sources in the parent and reopen the child.

Expected: canceled/failed navigation preserves work; saves finish before switching; discarded unsaved owners cannot create orphan children. Current source names appear with unchanged occurrence IDs/layout and ADR links. External Software System actions open the source's canonical child. Child library entries show their level, owner and parent.

### 5a. Verify child save placement and list filtering

Edit container content and save twice; the child title equals the owner name. Confirm each write uses PUT with the same child UUID and retains kind container and the original scope IDs. Compare saved parent content before/after. Return through the guarded parent action; rename the parent and owner, refresh/reopen the child from the library and save again. Repeat with identical owner/child names under two distinct parents. Simulate a failed save then retry, and inject a wrong-ID/noncanonical-name/kind/scope save response in the frontend regression fixture.

Expected for SC-010: the same named child remains beneath its originating parent, with Container diagram, owner and parent labels; no duplicate/top-level parent entry appears, no automatic "Parent Diagram" name is assigned, and parent architecture content remains unchanged. Wrong responses leave the draft intact and are not registered as a saved summary. Save-before-navigation uses the same child path.

Filter by a child-only name/date match and then by a parent-only match. Check result counts, clear filters and use only the keyboard to open/delete a child. Expected: matching children retain contextual parent headings even when the parent does not match; headings do not inflate counts, nonmatching children do not appear as matches, and clearing filters restores the nested hierarchy. Sorting remains deterministic and duplicate names do not merge parents. A temporarily unavailable parent summary retains parent context without promoting the child.

### 6. Verify dependency safeguards

Attempt owner deletion/reclassification, source deletion while occurrences exist and removal of ADR-linked containers/relationships. Through the REST contract, also submit complete PUT documents omitting protected artifacts or changing kind/scope.

Expected: typed conflicts identify dependencies and supported next actions; PUT cannot bypass DELETE or silently detach ADR links. Removing unrelated eligible content preserves all other data. Unsaved/failing mutations leave current drafts available.

Attempt to reclassify Customer to an unsupported legacy/unclassified type through a parent PUT while its external occurrence exists, then repeat with that child in trash. Capture saved source, occurrence, relationship and ADR/link data before/after. Expected: DIAGRAM_DEPENDENCY identifies each child name/status and occurrence/source ID with explicit removal guidance; every saved artifact remains unchanged. Restore the child if necessary, resolve relationship/ADR blockers and remove the occurrence explicitly before retrying. Verify a supported Person/Software System change succeeds for a nonowner source, while an owner still cannot change away from Software System. Include deterministic PUT-versus-occurrence-creation/removal race coverage.

### 7. Validate exact trash restoration

Independently trash Ledger's child. Trash the parent, review the affected named set, cancel once and then confirm. Restore the parent, then restore Ledger's child independently. Repeat parent trash while an affected child/ADR is currently edited with unsaved changes.

Expected: cascade affects only currently active children; parent restore returns exactly that batch. Previously trashed Ledger remains trashed until explicitly restored. Owners offer Restore rather than replacements. Changed confirmed impact requires a new confirmation. Child/ADR writes cannot proceed while its parent is in trash.

Repeat with the parent trashed and initiate restoration from Payments' child in the trash list. Expected: GET restore-impact names the parent root and exactly its affected batch, supplies the batch identity and reports requestedDiagramIncluded true. Cancel once: all trash states remain unchanged and no POST occurs. Confirm the exact set/batch to POST the root restore route; the response is the restored parent document. Refresh both lists, then load Payments' child through guarded navigation. Verify all restored UUIDs, creation timestamps, layout, ADRs and links are preserved.

Repeat by initiating restoration from Ledger's earlier independently trashed child. Expected: requestedDiagramIncluded false; confirmation explains that parent-batch recovery leaves Ledger trashed. After that recovery, a separate confirmed Ledger restore becomes available. Never report Ledger as restored or load it before this second operation succeeds. Direct child POST with an inactive parent returns PARENT_INACTIVE with the root ID and changes nothing.

In contract/persistence fixtures, restore and retrash the same ID set after capturing a preview, then submit its old batch identity. Expected: RESTORE_IMPACT_CHANGED with no writes; refresh/reconfirm. A missing multi-diagram confirmation returns RESTORE_CONFIRMATION_REQUIRED. Invalid owner/source references roll back the entire restoration. Exercise recovery versus source edits, parent trash and competing restores in real PostgreSQL, plus canceled/failed dirty-work guards and a successful recovery followed by failed child loading.

### 8. Inspect exports

Export a populated child to Mermaid and HTML ZIP; inspect diagram.svg. Extract and browse index.html with the application unavailable. Include Unicode, quotes, angle brackets, ampersands and multiline descriptions.

```powershell
npm.cmd run cli -- diagrams list --format json
npm.cmd run cli -- diagrams export <saved-child-uuid> --output .\payments-containers.zip
```

Choose a nonexistent output file. Expected: the child's owner-derived name and canonical scope/boundary, roles, Application/Datastore labels and containerType, metadata, protocols and local ADR links are retained. Browser HTML reflects its captured draft, including a changed subtype; CLI uses saved content. Empty child SVG/HTML retains its boundary; Mermaid reports EMPTY_CONTAINER_MERMAID with alternatives and produces no file. Invalid references/unsupported or missing subtype fail clearly. Parent exports identify single-diagram scope and unbundled children. See [export-contract.md](./contracts/export-contract.md).

## Usability and compatibility evidence

Measure SC-001 creation and SC-003 modeling using prepared information; record completion/time/errors. For SC-004, ask reviewers to identify scope, containers/technologies and externals without color dependence. Complete create/edit/save/return with keyboard alone as described in [ui-contract.md](./contracts/ui-contract.md).

Before reporting implementation complete, record migration/old-payload results, executed/skipped PostgreSQL counts, relevant browser checks, export inspections and usability outcomes against the plan matrix. Planning review alone does not establish these implementation results.

### Participant observation protocol (T089)

Use first-time authors for SC-001 and reviewers unfamiliar with the prepared model for SC-004.
Record anonymized participant IDs; count failed attempts and timeouts in the denominator. Do not
coach participants during a timed attempt or substitute browser automation for participant results.
Record the sample size and entry-point distribution so a success percentage can be assessed.

1. **Creation (SC-001):** Start with the saved Payments Software System visible. Ask the author to
   open its internal architecture, without separate control instructions. Start the clock when the
   task is shown and stop when its labeled child is open. Record double-click or selected action,
   elapsed seconds, success within 30 seconds, errors and any assistance. Target: at least 90%.
2. **Modeling (SC-003):** Supply the Web application (React/customer interface), Payments service
   (TypeScript/orchestration), Payments data store (PostgreSQL/transaction records), Customer and
   Ledger information above. Require Web → service (`Submits payment`, HTTPS), service → data store
   (`Stores payment`, SQL), and Customer → Web (`Makes payment`, HTTPS), with Customer included from
   the parent. Stop when three containers with complete metadata and those interactions are visible.
   Record elapsed seconds, errors/assistance and success under 300 seconds.
3. **Readability (SC-004):** Show the prepared diagram without explaining the legend. Ask the reviewer
   to name its owning system, all three internal containers and their technologies, and the external
   participants. Stop when the answers are complete or at 60 seconds. Record each answer, elapsed
   time, errors and success within one minute. Verify labels/shapes rather than color-only answers.

| Participant | Check | Entry point / answers | Seconds | Success within target | Errors / assistance |
| --- | --- | --- | ---: | --- | --- |
| Fill after observation | SC-001 / SC-003 / SC-004 | Record actual behavior | — | — | — |

For SC-001 and SC-004 report `successful participants / attempted participants × 100`, sample sizes,
times and errors separately. For SC-003 report each author's time and completeness. An empty
worksheet means **not observed**, not a pass. Append actual outcomes to `validation.md` and keep
T089 and the final T090 gate unchecked until the required evidence exists.

Offline inspection uses the extracted package with the application unavailable: follow a container,
external occurrence and relationship to its ADR, then return to the same local anchor. Check empty
and populated boundaries, both subtype labels, full Unicode/multiline metadata, SVG bounds and
the absence of network-dependent links. The automated offline browser scenario supplies artifact
evidence separately from participant timing/readability.

### Owner rename regression (FR-025 / SC-011)

Create child a, return to its parent and rename the owner aa. Verify immediate sidebar title/owner preview, undo/redo and discard; repeat and save, reload and reopen the child. Verify its read-only title, recovery/export labels and filenames. Repeat with duplicate owners/another parent, failed save/retry, delayed lists and edits during save; only the matching UUID changes. Legacy/custom titles resolve automatically without changes to IDs, creation times, local content or read-time update timestamps.
