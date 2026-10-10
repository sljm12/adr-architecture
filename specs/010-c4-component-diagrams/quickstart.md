# Quickstart Validation: C4 Component Diagrams

Validation guide for the implemented Component workflows. Expected behavior is in [data-model.md](data-model.md), [REST](contracts/openapi.json), [UI](contracts/ui-contract.md) and [export](contracts/export-contract.md). Actual checks and pending release gates are recorded in [validation.md](validation.md).

## Setup

Use Node.js 22-compatible environment, npm and a dedicated disposable PostgreSQL database. Configure DATABASE_URL in the API/test shell; backend/.env is not loaded automatically. Never use a valuable database for persistence fixtures. Install browsers through the existing Playwright workflow. Run from repository root; PowerShell uses .cmd launchers to avoid local script execution restrictions.

```powershell
npm.cmd ci
npm.cmd run build
```

For fresh runtime databases apply 0001–0006 in order before 0007; existing deployments apply only pending migrations. Migration 0007 changes existing kind/scope/role constraints without new tables, columns or backfill. Preserve applied migrations.

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f backend/drizzle/0007_c4_component_diagrams.sql
npm.cmd run dev
```

Expected API health: http://localhost:3000/health; editor: http://localhost:5173. Existing IDs/types/timestamps remain and Component kind becomes accepted.

## Automated validation

```powershell
npm.cmd test
npm.cmd run test:e2e
$env:RUN_POSTGRES_TESTS = '1'
npm.cmd test -- --maxWorkers=2
npm.cmd run build
npx.cmd tsc -b frontend
npx.cmd playwright test --workers=1
npx.cmd playwright test --config=playwright.component.config.ts e2e/tests/component-diagram-persistence.spec.ts --workers=1
npx.cmd playwright test --config=playwright.offline.config.ts --workers=1
```

Set DATABASE_URL and RUN_POSTGRES_TESTS=1 in the test shell before full release checks. Persistence fixtures create migrated disposable UUID-named schemas and clean up only those schemas; older suites use the configured disposable database. Normal E2E requires a disposable database migrated through 0007 for app-backed tests. Keep the API process pointed at that database too. Backend/.env is not automatically loaded.

Expected domain/schema/adapter/API/store/export/CLI regressions pass; PostgreSQL suites run without skips and prove races, migration preservation and rollback. The Component persistence journey starts a real HTTP server against an isolated migrated PostgreSQL schema. In-process/mock browser tests supply additional UI coverage. Install the configured Chrome/Edge channels and Playwright Firefox/WebKit binaries before the offline matrix; actual current stable stock Firefox/Safari and stable-version confirmation remain separate acceptance evidence. WebKit automation does not establish Safari acceptance.

## Journey 1: Three-level editing and identity

1. Save a Context with Software System and Person; enter its Container through the existing double-click flow.
2. Add/save Application and Datastore metadata. Double-click Application for an empty Component child; select Datastore and use its visible **Create component diagram** keyboard action. Repeat **Open component diagram** entry to prove no duplicate. Plain click selects; modifiers/multiselection suppress entry.
3. Add three Components, two internal interactions, an included sibling Datastore and existing Person occurrence with local interactions. Move/resize/undo/redo and save twice.
4. Return through both ancestor levels, refresh and reopen from list/owner. Verify UUIDs, metadata, layout, nested placement and unchanged ancestor content.
5. Exercise matching owner names under different parents and owner rename before/after creation, undo/redo/discard, failed save and delayed response. Check read-only title/live list preview/newer draft preservation and level-specific form choices.

Expected FR-001–016. Observe SC-001/SC-003 usability timings with first-time authors separately from automation.

## Journey 2: Failures, ADRs and clarification A

1. Test Save/Discard/Cancel for diagram/ADR work at all levels; inject failed parent save and failed post-create load. Retain draft/view and retry canonical child.
2. Submit invalid metadata/types/endpoints/source/placement. Errors identify remedies and no partial artifacts.
3. Link and supersede local ADRs targeting internal, supporting and relationship UUIDs; save/reload and verify exact links/counts without inherited decisions.
4. Attempt to remove parent Container Person/System occurrence used by an active child, then by a trashed child. Both are blocked with child/occurrence identities even while Context retains the original source.
5. Test whole-document omission/undo, owner deletion/reclassification and root source changes. Preserve data/history/links; Application↔Datastore keeps child.
6. Restore recoverable affected children as needed, resolve each child's relationships/ADR links through safeguards and explicitly remove its local occurrence. Only then remove the immediate Container occurrence if no other child depends on it. Keeping the original Context source is insufficient; references are never flattened or automatically retargeted.

Expected FR-017/018/021. Real PostgreSQL suites race child creation vs owner removal, source occurrence removal vs child inclusion and root trash vs Component/ADR save.

## Journey 3: Exact recovery

1. Prepare active descendants plus independently trashed Component. Trash Container with full named preview; restore its exact batch and verify earlier child stays trashed.
2. Recover through deep child, then separately restore excluded independently trashed child after ancestors activate.
3. Repeat root trash with an earlier independent Container batch: restore Context batch, then Container batch, then any independent Component batch.
4. Cancel previews, change membership/batch between preview and confirm, inject final validation failure and post-commit load failure. Confirm no stale/partial mutation and reload retry without repeated committed restore.

Expected FR-019/020: no active child below inactive ancestor, no revival of unrelated prior batches, stable artifacts/ADRs.

## Journey 4: Formats and portable packages

1. Export populated/empty Component as supported Mermaid/SVG/selected HTML. Metadata is complete; Mermaid semantic rather than exact layout; empty Mermaid errors usefully, empty HTML/SVG renders boundary.
2. Browser-export Context including all active descendants and exact local ADRs/backlinks; exclude trash and verify supporting-source child actions.
3. Export Container with its active Component children; Component alone without out-of-package links; CLI selected saved Component only with existing no-overwrite rule.
4. Overlay retained diagram/ADR drafts and verify captured source names without saving/history mutation. Break required child/source/ADR/path and expect entire export failure.
5. Open extracted index.html directly in current stable Chrome, Edge, Firefox and Safari, network disabled. Test keyboard/pointer navigation/return, catalog/backlinks, recoloring, reload and directory relocation; record versions/OS.

Expected FR-022–025 and every local file/fragment resolves uniquely. WebKit alone is insufficient Safari evidence.

## Scale and evidence

Cover 100 internal/100 supporting/300 relationships per scoped diagram and 1 Context/3 Containers/6 Component hierarchy with ADRs. Retain selected-package 100-artifact/200-relationship/100-ADR 10-second bound. Record query counts/source batching/root-lock waits, five warmups/twenty measured samples and median comparison to Container baseline; investigate regressions above 20%, without declaring product caps.

```powershell
npm.cmd test -- shared/tests/component-scale.test.ts shared/tests/html-package-scale.test.ts backend/tests/persistence/component-scale.test.ts --maxWorkers=1
npx.cmd playwright test --config=playwright.component.config.ts e2e/tests/performance.spec.ts e2e/tests/component-diagram-accessibility.spec.ts --workers=1
```

The accessibility journey uses native Tab/Shift+Tab, Enter/Space and text entry for create/open,
editing, save, parent return, local ADR linking, cancellation focus return and trash/restore.
Record screenshots, computed focus/contrast and 44px targets alongside the test results.
The normal runner uses the configured installed browser headlessly by default, including on Windows.
Add `--headed` to a Playwright command when debugging interactively. Performance tests disable
trace recording so repeated full-canvas snapshots do not dominate their measurements.
Observe first-time authors separately: record participant counts and entry successes within 30 seconds
(at least 90%), plus three Components/two internal interactions/one supporting interaction saved and
reopened within five minutes. Keep these gates pending when participant observations are unavailable.

Record commands/results, migration and race evidence, exact browsers, hardware/runtime/fixtures, rendering evidence, usability observations and outstanding failures in the implementation validation record. In-memory success does not replace PostgreSQL or product-browser acceptance.
