# Spec 013 validation — 2026-10-19

## Scope and environment

Phases 5–6 extend completed phases 1–4. No dependencies or migrations added.
Database checks use UUID-named isolated schemas, never production artifacts. Connection strings
and imported text are excluded. Node v22.17.1; PostgreSQL 17.4 (Debian 17.4-1.pgdg120+2);
Windows 10.0.26200; Intel i7-13700H, 20 logical CPUs, 15.727 GiB RAM.
Browser checks use the repository's local Chromium configuration.

## Corrections exposed by tests

- Schema errors echoed rejected enum values and unknown keys. Diagnostics now retain paths
  and corrective guidance without those values.
- Archive invalidation rejected obsolete diagram responses but could leave navigation loading.
  It now resets navigation alongside invalidating the request.
- Uncertain commits offer saved-list refresh for inspection without resubmitting import.
  Confirmed commits with failed refresh retain their separate refresh-only retry.
- A delayed Trash-list request could replace the post-import list with obsolete contents.
  The library now rejects responses from an earlier request/store snapshot; browser coverage
  releases an old response after confirmed import and verifies imported Trash remains visible.
  Archive entry point accessible names now include UUIDs and active/Trash status.

## Field and state evidence

| Criterion | Evidence |
| --- | --- |
| SC-001 | Actual PostgreSQL round-trip compares all 69 fields across eight collections, binary signed zero, microsecond/link/membership times, bigint revisions and immediate re-export. Browser uses two separately migrated installations, navigates three levels, opens ADRs, saves and restores Trash. |
| SC-002 | HTTP/browser previews list UUID conflicts and removals; cancellation preserves raw tables/epochs; unchanged reimports still require override. |
| SC-003 | PostgreSQL replacement compares complete raw snapshots, changes in all seven owned collections, unrelated diagrams, source swaps, cyclic ADR replacements and no-op rows/epochs. |
| SC-004 | Parser/graph matrix covers malformed/escaped duplicate keys, eight case-insensitive identity namespaces, depth/Unicode/calendar/scalar/revision limits. HTTP covers strict envelopes, file/request/generated recovery limits, stale bytes/time/token/digest/choices and sanitized errors. PostgreSQL compares all tables/epochs at five late fault points and after stale reviews. Observed lock waits prove queued writer order; historical revert and purge/reintroduction invalidate consent across service recreation. Browser covers invalid files, stale bytes/destination, canceled delayed preview, failed save, response loss and known-commit refresh failure. |
| SC-005 | PostgreSQL/browser recovery compare prior raw contents, retain additions and refuse retained dependencies without mutation. |
| SC-006 keyboard | Automated keyboard flow selects a file, checks default Cancel and Tab/Shift+Tab trap, cancels with Escape/restores focus, imports, overrides, downloads/acknowledges recovery, recovers and exports. Human completion gate remains pending. |

Focused final archive matrix: 123 tests passed across 13 files, including actual PostgreSQL
migration, round-trip, replacement and concurrency. Subsequent expanded concurrency run: 21
passed, including raw changes without epoch changes, exact whitespace binding and unrelated
destination additions. Six memory tests and six frontend failure/cache tests also pass.
Final archive browser matrix: all 11 passed together in 33.7 seconds with PostgreSQL enabled,
including the added late-Trash-response case. An earlier ambiguous two-alert test locator was
narrowed before that run.
Lint and production build passed; the build retains its >500 KB frontend chunk warning.

### Broad regression and focused reruns

- `RUN_POSTGRES_TESTS=1 npm test`: 157 files passed, seven failed, one skipped; 1,179 tests
  passed, seven timed out, one skipped. The skipped archive-scale suite requires the explicit
  `RUN_ARCHIVE_SCALE=1` flag and was executed separately. All seven timeout cases subsequently
  passed with reduced worker counts: HTML fixtures, container editing, container scale, CLI
  deletion, historical confirmation compatibility, PostgreSQL ADR acceptance and the existing
  deletion scale benchmark (248.355 seconds on rerun). The broad run is recorded as failed,
  not relabeled as a single clean pass.
- `RUN_POSTGRES_TESTS=1 npm run test:e2e -- --workers=2`: 108 passed, three failed, no skips.
  Saved-list, archive, three-level navigation, recovery, Mermaid and HTML/package workflows
  execute in that run. Modified/multiple selection passed on a one-worker rerun. Two failures
  remain reproducible in non-archive scenarios: `adr-component-tagging.spec.ts:48` opens the
  Decisions inspector without selecting the requested ADR; `component-diagram-persistence.spec.ts:33`
  times out because sticky ADR heading/actions intercept the relationship-checkbox click.
  Neither scenario invokes archive transfer; their implementation was not changed here.
  These are remaining regression issues, not clean release acceptance.
- Final lint, production build and `git diff --check` pass. No extension hooks are configured
  (`.specify/extensions.yml` absent). Existing CLI tests, including listening-HTTP deletion,
  execute in the broad run and focused timeout rerun.

## Scale budget

Run with `RUN_POSTGRES_TESTS=1` and `RUN_ARCHIVE_SCALE=1`:
`npm test -- backend/tests/persistence/diagram-archive-scale.test.ts`.

Valid 100-diagram collection; selected child includes a complete three-level hierarchy with
1,000 components, 1,000 relationships, 100 ADRs, groups, both link kinds and independent Trash
provenance. Two warmups then 20 samples per operation. Baseline fixture reset is outside timing;
every exported row changes its creation timestamp and is replaced during each committed apply.
User/network time excluded. This final measurement was serialized after other database and
browser benchmark runs. These are local acceptance figures, not production capacity measurements.

| Operation | Nearest-rank p95 ms | Budget |
| --- | ---: | ---: |
| Export | 132.594 | <5,000 |
| Preview | 274.290 | <5,000 |
| Committed apply | 750.793 | <5,000 |
| Preview setup + lock acquisition | 4.083 | Report separately |
| Apply setup + lock acquisition | 3.172 | Report separately |

Lock figures include connection/transaction setup through callback entry after the collection
table lock: an upper bound on lock wait, not isolated server wait. No intentional competing
writer ran during measurement. Maximum archive 801,100 bytes; recovery 801,280 bytes;
both below 8,388,608 bytes. No optimization or budget revision needed.

Raw elapsed samples, milliseconds rounded to three decimals:

```json
{
  "export": [97.171,100.571,109.853,100.029,104.086,97.017,102.182,112.801,97.446,90.913,104.420,96.879,95.133,115.758,129.778,113.521,101.731,426.007,121.641,132.594],
  "preview": [213.447,240.228,225.263,232.182,217.137,231.174,238.830,218.272,225.483,218.734,213.855,211.133,232.035,237.564,263.938,274.290,228.941,255.730,258.354,278.605],
  "apply": [637.794,687.564,638.235,642.126,653.602,690.854,646.206,669.539,631.069,628.801,638.822,621.113,650.068,663.261,724.023,699.088,635.251,750.793,703.772,874.435],
  "previewSetupAndLock": [2.663,1.822,1.416,1.892,1.503,1.561,1.780,1.144,2.784,1.247,1.247,2.406,1.255,1.347,2.085,1.438,4.083,1.343,4.539,1.219],
  "applySetupAndLock": [2.137,1.489,1.255,2.072,1.157,2.079,1.415,1.345,2.404,3.356,1.110,2.157,3.172,1.215,1.594,1.295,1.396,1.321,1.876,1.470]
}
```

## First-time-author trials — pending (T053)

Participants: 0. Completion times: none. Proportion completing unaided within three minutes:
not measured. Human keyboard completion: not measured. The 90% threshold cannot be assessed
from automation. Recruit first-time authors, time export and empty-installation import without
external instructions, and record each completion/time and keyboard result before closing this
gate. This session cannot supply real participants.

## Remaining limitations

The existing node-postgres concurrent-query deprecation warning appears in repository tests;
no driver upgrade was introduced. No human usability, Safari or other engine certification claimed.
