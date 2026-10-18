# Quickstart Validation: Lossless Diagram Export and Import

This guide specifies checks to run after implementation. The routes, migration and new test files named here are planned work; this planning run does not claim they exist or pass. See [data-model.md](data-model.md), [file schema](contracts/archive.schema.json), and [HTTP/UI contract](contracts/http-and-ui.md) for exact rules.

## Prerequisites and setup

Use the repository's existing Node.js 22/npm setup and a dedicated disposable PostgreSQL database. Do not run import, override or recovery experiments against valuable data. Tests should use the existing isolated-schema helper and delete only their verified UUID-named schema.

```powershell
npm.cmd ci
$env:DATABASE_URL = '<dedicated disposable PostgreSQL connection string>'
$env:RUN_POSTGRES_TESTS = '1'
```

For a new disposable manual database, apply migrations in order:

```powershell
Get-ChildItem -LiteralPath backend/drizzle -Filter '*.sql' |
  Sort-Object Name |
  ForEach-Object {
    & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
  }
npm.cmd run dev
```

On an existing migrated installation, apply only pending `0009_diagram_archive.sql` before the new API; do not replay earlier migrations. The migration must retain original artifact data, add local epochs, and preserve source uniqueness while allowing deferred checking only in import. Keep production connections and credentials out of evidence artifacts.

## Focused automated checks

Implement named suites below, then run them; the commands are intended implementation acceptance entry points.

```powershell
npm.cmd test -- shared/tests/archive-validation.test.ts shared/tests/archive-graph.test.ts
npm.cmd test -- backend/tests/contract/diagram-archive.test.ts
npm.cmd test -- backend/tests/persistence/diagram-archive-roundtrip.test.ts backend/tests/persistence/diagram-archive-migration.test.ts
npm.cmd test -- backend/tests/persistence/diagram-archive-replacement.test.ts backend/tests/persistence/diagram-archive-concurrency.test.ts
npm.cmd test -- backend/tests/persistence/diagram-archive-scale.test.ts
```

Update `component-test-database.ts` to apply migration 0009 in its current-version path while preserving older-migration test switches. PostgreSQL suites must report actual executions without skips. Memory/API tests supplement but do not replace driver, FK, deferred uniqueness, or lock-barrier evidence.

## 1. Complete round trip and re-export

Seed a valid three-level hierarchy with active and independently trashed descendants, all eight record types, every ADR state, both ADR link kinds and their own distinct timestamps, multiple group memberships, source occurrences, legacy free-form classifications, null/empty/Unicode/padded text where valid, fractional layouts including negative zero coordinates, microsecond timestamps and a revision above `2^53`.

1. Select a child in the browser and prepare Export archive. Verify the preview includes its top-level hierarchy, ancestors, every descendant regardless of status and required dependency hierarchies, with reasons. Cancel once and verify no file is downloaded; approve and retain the downloaded exact text.
2. Compare every field in all eight exported arrays against direct raw SQL projections, not editor/API documents. Include stored child names and cached participant metadata that ordinary reads hydrate.
3. Import into an empty independently migrated installation. Import must be available with an empty saved list. Review counts, confirm, reload, navigate every level, open linked decisions, edit/save a representative imported artifact, and restore a representative Trash batch.
4. For the no-edit round-trip case, re-export immediately before making edits. Compare persisted fields and references exactly; ignore only envelope export metadata and collection ordering/UUID casing. Check timestamp fractional digits, link/membership times and float8 signed zero explicitly.

Expected: zero missing fields/references or duplicates; original statuses, provenance, identity, layout and metadata survive. This is SC-001 evidence. Normal subsequent editing may legitimately update its usual metadata.

## 2. Scope and file rejection

Exercise an empty diagram, selecting a child, required source/recovery hierarchies, and multiple recovery seeds. Verify expansion is finite and deduplicated. Reject hierarchy cycles, bad manifests, missing owners/endpoints, invalid source/group/ADR links, duplicate record keys or endpoint pairs, casing duplicates, duplicate JSON object keys including escaped names, unsupported version/field, invalid calendar dates, noncanonical/nonfinite layout strings and bigint overflow.

Use an 8 MiB boundary file and a file one byte over; also test oversized HTTP envelopes and generated recovery closure. Invalid UTF-8, BOM, invalid Unicode, malformed JSON, deep nesting and unsupported request media types must yield the documented structured errors. Snapshot the destination before each rejection and compare afterward. Unknown fields must not be stripped silently. Valid repeated string values and escaped text must not be mistaken for duplicate object keys.

## 3. Override, exact reimport and retained dependencies

1. Export, then edit destination text/layout/ADRs/links and add/remove owned records. Preview the earlier file. Verify every collision, replacement, removal and unchanged row is represented with table identity and owning diagram. Duplicate names with different UUIDs are distinct.
2. Cancel or dismiss; compare all saved data and epochs before/after. Also exercise mixed new/existing diagrams and collisions below diagram level.
3. Download recovery, leave acknowledgement unchecked, and verify override is unavailable. A direct commit without required flags/digest must fail without mutation.
4. Acknowledge and confirm. Compare included diagram snapshots exactly against the file and verify destination-only diagrams remain unchanged. Verify valid external-source swaps pass even when per-row immediate uniqueness would otherwise fail. Include supported multi-ADR replacement cycles and existing replacement FKs.
5. Reimport unchanged content: still display UUID matches and require override, but require no recovery download; compare rows, timestamps and epochs to prove a no-op.
6. Create a retained child/external occurrence/ADR dependency that replacement would invalidate. Preview and commit must block the whole operation with actionable identities; destination-only children must never be purged implicitly. Same-type IDs under different owners must block. Equal UUID bytes in different artifact tables remain separate identities.

Expected: SC-002/SC-003 and the relevant FR-006–FR-015 cases pass with exact durable state comparisons.

## 4. Recovery follows confirmed choice B

After override, import its saved recovery file through the ordinary preview/confirmation workflow. Verify overwritten diagram contents return to their prior state, including removed records and exact metadata; diagrams newly added during the original import remain unchanged.

Repeat with a newly added diagram depending on a component that recovery would remove. Recovery must block atomically, identify the reference and corrective action, and retain the added diagram even if no subsequent edits occurred. Resolve or separately remove that diagram through existing explicit workflows before retrying. Recovery is restoration of overwritten contents, not automatic deletion of everything created by an import.

## 5. Stale consent, actual races and atomic rollback

Use real PostgreSQL connections with observable lock barriers, following existing deletion concurrency tests; do not infer race order from sleep duration.

- Change file bytes (including whitespace), destination records, collision membership, owners, sources, links, group membership, Trash provenance or required retained dependencies after preview. Commit must return a fresh-review error and preserve current saved state.
- Preview deletion, collection deletion, browser Trash and browser restore; then import historical rows with their earlier timestamps, batch identities and revision counters. Every prior affected confirmation must fail. Repeat an edit/import/revert sequence and permanent-delete/reimport UUID reuse. Unrelated reviewed graphs should remain valid.
- Submit legacy Trash/restore bodies without tokens: keep epoch-zero compatibility, reject scopes affected by an import, and verify new UI callers send current tokens. Test restart/recreated API instances against the same durable ledger.
- Queue normal save, ADR/link edits, child/root creation, Trash and restore before and behind import coordination. Confirm consistent table-before-row order, no deadlocks, no partial commits and no unintended UUID resurrection. Include changed destination-only dependencies introduced before commit.
- Inject failures after new parents, reference upserts, stale-row deletion, local epoch updates and deferred constraint checks. Compare all eight tables and ledger before/after. Repeat memory rollback including newly inserted and removed records, sidecar timestamps, registration indexes and queued writers.
- Simulate response loss after a real commit. The UI must report an uncertain outcome, send no automatic second commit, and direct inspection of saved state.

Expected: SC-004 and all-or-nothing persistence hold; database skips do not count as evidence.

## 6. Browser drafts, focus and refresh

```powershell
npm.cmd exec playwright test e2e/tests/diagram-archive-transfer.spec.ts
```

Cover mouse and keyboard file selection, expanded scope, full impact review, recovery download/acknowledgement, explicit override, safe default cancellation, focus trapping/restoration, readable labels, busy state and result announcements. Exercise current and retained diagram/ADR drafts in multiple affected diagrams. Save must invalidate the old preview; discard must be explicit. Unrelated drafts remain intact.

After a known commit, verify affected undo/history and caches cannot reapply old state, in-flight stale responses are ignored, and active/Trash lists reload. Force refresh failure: show committed success with a refresh retry, without another import. Run the existing saved-list, three-level navigation, recovery, ADR, Mermaid and HTML export regressions through the repository's established harnesses.

## 7. Scale, regression and evidence

Measure a valid selected hierarchy with 1,000 components, 1,000 relationships and 100 ADRs inside a 100-diagram collection, including relevant group/link/provenance data. Use two warmups then 20 independent valid samples per operation. Recreate or recover fixtures outside timed intervals. Measure export, preview and committed apply separately; p95 nearest-rank must be <5,000 ms each, with file/recovery <=8 MiB. Include lock wait, hardware, Node/PostgreSQL versions and raw timings; these are plan targets until measured.

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
git diff --check
```

Run focused checks first, then broad regression once; repeat only for new changes/failures. Record SC-001–SC-005 evidence by field/state comparison. For SC-006, conduct first-time-author trials and report the completion proportion within three minutes; keyboard automation alone does not prove the 90% threshold. Record unexecuted browser/database/usability checks as pending, never as passed.
