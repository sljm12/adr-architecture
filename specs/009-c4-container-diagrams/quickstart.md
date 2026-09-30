# Quickstart Validation: C4 Container Diagrams

This guide validates the feature after implementation. Planning does not add the migration, endpoints, tests or UI yet. Use [plan.md](./plan.md) for the requirement matrix, [data-model.md](./data-model.md) for artifact rules, and [contracts/openapi.yaml](./contracts/openapi.yaml) for endpoint shapes.

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
npm.cmd run build
npm.cmd run dev
```

For an existing validation database, apply only pending migrations in order through its migration runner. The 0005 migration is a planned implementation artifact. Seed an older database before 0005 and verify its IDs, timestamps, groups, relationships and ADR links remain unchanged.

Open http://localhost:5173; API health is http://localhost:3000/health. Keep DATABASE_URL available to backend/test processes.

## Automated checks after implementation

In another terminal with the same validation database configured:

```powershell
$env:RUN_POSTGRES_TESTS = '1'
npm.cmd test
npm.cmd run test:e2e -- e2e/tests/container-diagrams.spec.ts
```

Vitest must include shared schema/layout/export, frontend state/adapter/UI, backend contract and real PostgreSQL feature tests. A skipped PostgreSQL suite is not a pass. Feature file names in plan.md are planned; task generation can align them with repository conventions.

Database coverage must exercise concurrent creation, creation versus parent mutation/trash, rollback, source references, whole-document dependency bypass, exact restore batches and ADR writes versus trash. Include existing general/group/ADR/CLI regressions in npm test. Browser checks cover both entry points, external source navigation, dirty diagram/ADR decisions, keyboard movement and recovery. Broaden browser checks when affected flows require it.

## End-to-end validation

### 1. Prepare a parent

Create and save Payments Overview with Software Systems Payments and Ledger and Person Customer. Optionally group the systems. Add another Software System named Payments to verify identity handling. Record stable IDs from saved data.

Expected: general diagrams/groups remain usable; only Software Systems have container-diagram actions. A group member remains eligible individually.

### 2. Use both requested entry points

Double-click Payments to create its child. Verify Container diagram, current system name and empty labeled boundary. Return to the parent, select Ledger and use Create container diagram. Repeat both entry points.

Expected: one canonical child per source ID, reopened thereafter. A Person/group cannot own a child. A failed child load leaves current work; retry opens any child already created. GET availability creates nothing; POST returns 201 new/200 existing or 409 RESTORE_REQUIRED.

### 3. Model containers and external participants

Add Web application (customer interface, React), Payments service (orchestration, TypeScript) and Payments data store (transaction records, PostgreSQL). Add directed interactions with descriptions and one protocol. Include Customer and Ledger from the parent and connect each to an internal container.

Expected: internal containers enclosed, people/systems outside, responsibilities/technology/protocol readable. Missing text, unsupported roles, owner-as-external, duplicate sources and external-to-external/boundary links fail clearly without partial artifacts. Parent positions and relationships are not copied or changed.

### 4. Check geometry and history

Place an external occurrence near the boundary, then move/resize an internal container past a previous edge. Undo and redo. Move a container using keyboard arrows and save/reopen. Try moving an external occurrence inside the boundary.

Expected: internal bounds fit; overlapping externals move outside with clearance. One undo restores all effects and IDs. Keyboard movement persists. Direct invalid external movement is rejected and restores its previous valid geometry.

### 5. Exercise navigation and source refresh

Link ADRs to a container and relationship using existing lifecycle workflows. Leave diagram/ADR edits unsaved. Navigate through parent link, library and an external Software System's Create/Open action; exercise Save, Discard, Cancel and a failed save. Rename sources in the parent and reopen the child.

Expected: canceled/failed navigation preserves work; saves finish before switching; discarded unsaved owners cannot create orphan children. Current source names appear with unchanged occurrence IDs/layout and ADR links. External Software System actions open the source's canonical child. Child library entries show their level, owner and parent.

### 6. Verify dependency safeguards

Attempt owner deletion/reclassification, source deletion while occurrences exist and removal of ADR-linked containers/relationships. Through the REST contract, also submit complete PUT documents omitting protected artifacts or changing kind/scope.

Expected: typed conflicts identify dependencies and supported next actions; PUT cannot bypass DELETE or silently detach ADR links. Removing unrelated eligible content preserves all other data. Unsaved/failing mutations leave current drafts available.

### 7. Validate exact trash restoration

Independently trash Ledger's child. Trash the parent, review the affected named set, cancel once and then confirm. Restore the parent, then restore Ledger's child independently. Repeat parent trash while an affected child/ADR is currently edited with unsaved changes.

Expected: cascade affects only currently active children; parent restore returns exactly that batch. Previously trashed Ledger remains trashed until explicitly restored. Owners offer Restore rather than replacements. Changed confirmed impact requires a new confirmation. Child/ADR writes cannot proceed while its parent is in trash.

### 8. Inspect exports

Export a populated child to Mermaid and HTML ZIP; inspect diagram.svg. Extract and browse index.html with the application unavailable. Include Unicode, quotes, angle brackets, ampersands and multiline descriptions.

```powershell
npm.cmd run cli -- diagrams list --format json
npm.cmd run cli -- diagrams export <saved-child-uuid> --output .\payments-containers.zip
```

Choose a nonexistent output file. Expected: scope/boundary, roles, metadata, protocols and local ADR links are retained. Browser HTML reflects its captured draft; CLI uses saved content. Empty child SVG/HTML retains its boundary; Mermaid reports EMPTY_CONTAINER_MERMAID with alternatives and produces no file. Invalid references/unsupported content fail clearly. Parent exports identify single-diagram scope and unbundled children. See [export-contract.md](./contracts/export-contract.md).

## Usability and compatibility evidence

Measure SC-001 creation and SC-003 modeling using prepared information; record completion/time/errors. For SC-004, ask reviewers to identify scope, containers/technologies and externals without color dependence. Complete create/edit/save/return with keyboard alone as described in [ui-contract.md](./contracts/ui-contract.md).

Before reporting implementation complete, record migration/old-payload results, executed/skipped PostgreSQL counts, relevant browser checks, export inspections and usability outcomes against the plan matrix. Planning review alone does not establish these implementation results.
