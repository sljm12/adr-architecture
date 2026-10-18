# Research: Lossless Diagram Export and Import

Date: 2026-10-18. Research is based on the clarified specification and inspected repository. No application code, database, or tests changed during planning. The planning skill's research-agent step was used for persistence and API/UI research.

## 1. File format, scope, and resource limits

**Decision:** Use one UTF-8 `.adr.json` file with format discriminator `adr-diagram-archive`, version `1`, explicit scope, and eight normalized record collections. Include the selected diagram's complete top-level hierarchy and recursively required complete hierarchies, regardless of Trash status. Recovery files use the same version and records with an explicit recovery purpose and multiple existing-diagram seeds when necessary. Support files up to 8 MiB; reject larger files and recovery snapshots without mutation. Apply a 24 MiB JSON request-body limit only to archive preview/import routes to accommodate the file carried as a JSON string.

**Rationale:** JSON and existing runtime validation require no new dependency. A self-contained graph avoids external installation dependencies. A byte cap bounds file parsing and response preparation without silently truncating diagrams or inventing a record-count restriction. JSON-envelope escaping can approximately double valid JSON text, so the request cap must exceed the file cap.

**Alternatives considered:** ZIP/multipart adds unnecessary parsing and compression concerns. Existing HTML/Mermaid files omit stored data. Entire-collection export and selecting individual records conflict with the confirmed scope. Streaming and asynchronous jobs are unnecessary at the initial size boundary.

## 2. Fidelity requires a raw persistence boundary

**Decision:** Add transaction-scoped raw archive read/apply methods beside the existing diagram/ADR repositories. Reuse collection coordination and domain invariants through a temporary validation projection; never serialize hydrated editor documents or pass archive values through ordinary create/replace/link methods. Keep the eight original tables and identities.

**Rationale:** `mapDocument()` in `backend/src/persistence/diagram-repository.ts` hydrates stored diagram names and external-participant metadata. ADR list methods and group projections omit link/membership creation times. Ordinary writers trim strings, reset timestamps, and increment revisions. These behaviors are appropriate to editing but cannot preserve the declared inventory.

**Alternatives considered:** Extending `DiagramDocument` into a database dump mixes domain/editor and transport concerns. Reusing presentation snapshots silently drops values. Duplicating normal editor state into a second durable artifact store would create competing sources of truth.

## 3. Timestamp, integer, and binary64 precision

**Decision:** Read timestamps through explicit SQL text expressions, in UTC with six fractional digits; parameterize exact timestamp text on write. Never use `Date` for artifact timestamp conversion. Encode portable `deletionRevision` as a nonnegative decimal string through PostgreSQL bigint maximum. Encode float8 layout values as canonical round-trip decimal **strings**, including `-0`, rather than ordinary JSON numbers. Read float8 text with transaction-local `extra_float_digits=3`, parse to binary64, and render the shortest ECMAScript round-trip representation with a special case for negative zero. Validate input by this same canonical rendering before binding text as double precision.

**Rationale:** node-postgres's ordinary timestamp parsing loses precision beyond milliseconds. JSON numbers cannot carry all bigint values, and ordinary JSON serialization turns negative zero into zero. Decimal strings preserve binary64 values and their sign without a new arbitrary-precision dependency. Numeric strings represent binary64 values, not arbitrary-precision decimal quantities. Reject nonfinite, out-of-range, noncanonical, and unsupported stored values explicitly.

**Alternatives considered:** Global driver-parser changes could affect existing routes. Date-based adapters, numeric bigint, and ordinary JSON numeric layout do not satisfy complete fidelity. Binary archives and hexadecimal numeric encodings are unnecessary for the existing finite layout fields.

## 4. Coherent snapshots and atomic replacement

**Decision:** Export in one read-only repeatable-read transaction. Import preview and commit each use `GraphTransaction.runCollection()` and the existing `LOCK TABLE diagrams IN SHARE ROW EXCLUSIVE MODE`, with all raw reads and writes using the same transaction. No transaction spans a dialog or file download. Parse and validate file-local rules before locking; under coordination validate the union of incoming snapshots and retained destination diagrams, calculate the exact delta, and compare the reviewed fingerprint before writing.

**Rationale:** All supported writers already acquire a diagrams table writer lock before graph row locks; this barrier prevents phantom roots, owners, sources, and recovery changes during snapshot/commit. Preview and commit remain separate short operations. The same final graph must pass invariants before and after writes.

**Alternatives considered:** Per-diagram transactions permit partial multi-hierarchy imports. Validating outside the commit transaction races with saves. Calling ordinary purge/recreate destroys retained references and writes new metadata. New distributed coordination is unnecessary for the existing database protocol.

## 5. Write order and a targeted constraint migration

**Decision:** Keep common identity rows in place, skip unchanged records, and insert new hierarchy levels parent-first, with owner components before child diagrams. Upsert referencing rows before removing stale endpoints; delete stale links/memberships before relationships/groups/ADRs and obsolete components, with source occurrences before canonical sources. Retain every destination-only diagram. Temporarily null ADR replacement references only inside the transaction, then restore exact incoming values after all required ADRs exist; check final invariants before commit.

Replace `components_diagram_source_unique` with a same-key `UNIQUE (diagram_id, source_component_id) DEFERRABLE INITIALLY IMMEDIATE` constraint and defer it only during archive apply. Keep the primary key immediate for `ON CONFLICT (id)`. The migration preserves null-distinct semantics and all data.

**Rationale:** Valid historical snapshots can swap source identities between two existing external occurrences; immediate unique-index checks can reject intermediate writes although the final graph is valid. Wholesale deletion is unsafe when retained diagrams reference common identities. Actual SQL migration `0002_adrs.sql` defines an ADR replacement FK even though `schema.ts` omits the reference; the plan accounts for the real constraint and aligns schema metadata with it. Domain rules forbid self-replacement but currently permit longer replacement cycles; import must preserve those supported cycles.

**Alternatives considered:** Blocking valid source swaps would fail snapshot replacement. Deferring every FK or removing constraints weakens unrelated writes. Sorting replacement ADRs cannot handle supported cycles. No artifact identity is relocated under a different owner.

## 6. Local confirmation epochs and older confirmation paths

**Decision:** Add `diagram_confirmation_epochs(diagram_id uuid primary key, epoch bigint not null)` as installation-local operation metadata, without a diagram FK. Missing rows mean epoch zero. Advance epochs atomically for each diagram whose persisted artifact data changes during import, including newly inserted/reintroduced UUIDs. Keep ledger rows after permanent deletion. Never copy or restore epochs from files.

Include these epochs in import and existing single/collection deletion fingerprints, plus new browser Trash/restore impact tokens. Legacy Trash/restore requests lacking a token remain eligible only while every relevant epoch is zero; after an import affects their scope they must obtain and submit a fresh impact token. Update all internal callers, strict schemas, fixtures, and contracts together. Existing token-based deletion payload shapes remain unchanged.

**Rationale:** Portable revision counters must be restored exactly, so they cannot also establish that an old confirmation predates an import. A durable per-diagram local epoch prevents edit/import/revert and permanent-delete/reintroduced-UUID cases from reviving old consent. Current browser Trash/restore compares only IDs/batch membership and otherwise bypasses this protection. The ledger is operational coordination state, outside the specification's architecture-artifact inventory, like deployment/migration metadata; existing portable `deletionRevision` remains exact.

**Alternatives considered:** Increasing the transported revision destroys fidelity. Process-local counters fail on restart or another API instance. A global epoch rejects unrelated reviewed operations. PostgreSQL `xmin` wraps and is not a durable identity. An epoch FK/cascade would lose tombstones and reopen UUID-reuse failures.

## 7. Three endpoints and exact-file review

**Decision:** Export preparation returns exact `archiveText`, digest, byte length, and derived scope summaries. Scope approval downloads that already captured text. Import preview accepts `{archiveText}` and returns complete impact, an opaque snapshot fingerprint, and the required recovery file text/digest. Commit accepts the original text, preview time/token, override choice, and recovery acknowledgement/digest. Rebuild the same recovery file using the reviewed time during commit. Tokens bind action, exact UTF-8 input digest, relevant destination rows/presence/revisions/epochs, collision and retained dependency sets, complete delta, and recovery digest.

**Rationale:** No multipart parser, raw-body plugin, server file cache, token table, or locks during user interaction are needed. Even whitespace changes to the selected file require fresh review. Recovery is captured from the same reviewed pre-import state and cannot be swapped independently of consent. Tokens are consistency guards in the existing single-user application, not authorization credentials.

**Alternatives considered:** Re-exporting after scope approval can download a different snapshot. A live recovery download after review can describe different data. Hashing only parsed file content misses exact-byte changes. Automatic commit retries make interrupted outcomes ambiguous.

## 8. UI, drafts, errors, and recovery

**Decision:** Add one archive transfer coordinator and a dedicated review dialog using existing dialog focus, cancel, button, and CSS conventions from `DESIGN.md`. Put Import in the saved-diagram list, available when empty, and Export archive on active and Trash rows. Reuse save/discard decisions for diagram and ADR drafts, including retained drafts in affected diagrams. Saving first invalidates the preview and requires another. After commit, clear affected histories/caches and reload affected views and both lists; preserve unrelated work.

**Rationale:** `RecoveryCoordinator.tsx` already coordinates operations, request sequencing, draft decisions, and list refresh failures. `ConfirmDialog` supports only a string message; the impact table and recovery acknowledgement need a focused specialized dialog. Recovery restores overwritten contents, retains added diagrams, and blocks atomically if their dependencies would break, as clarified.

**Alternatives considered:** Automatic draft discard loses knowledge. Treating refresh failure as import failure encourages unsafe retries. A full rollback feature would conflict with the accepted recovery choice. A new design system, workspaces, or accounts is outside scope.

## 9. Initial verification and performance targets

**Decision:** Use existing Vitest, real PostgreSQL isolated-schema, and Playwright harnesses. Initial local acceptance target: export preparation, import preview, and commit each p95 under 5 seconds over 20 measured samples after two warmups, excluding user time/network, for a valid selected three-level graph with 1,000 components, 1,000 relationships, 100 ADRs and representative links within a collection of 100 diagrams. File/recovery remain at or below 8 MiB. Measure and record environment, lock wait, and operation time; a missed target requires a measured optimization or explicit plan-budget revision.

**Rationale:** This builds on the existing deletion scale fixture with a larger allowance for exact-value transfer and recovery generation. Byte boundaries, not arbitrary diagram counts, are the supported format limit. Normal reads need not be blocked by the collection writer barrier; other writes may wait during a short operation.

**Alternatives considered:** Existing deletion timings do not prove archive performance. Streaming, jobs, per-record pagination, and tighter unmeasured latency promises are premature. Functional tests alone do not prove precision or race safety; database skips are not passes.

## Documentation consulted

Current documentation was retrieved with Context7 library resolution followed by docs queries outside the sandbox; no quota or network failures occurred. IDs: `/websites/node-postgres`, `/websites/postgresql_17`; Fastify and Zod 3 official references were also retrieved by the API/UI research agent.

- [node-postgres types](https://node-postgres.com/features/types): use text projections to bypass lossy type parsing.
- [node-postgres transactions](https://node-postgres.com/features/transactions): all transaction statements use the same connection.
- [PostgreSQL timestamp precision](https://www.postgresql.org/docs/17/datatype-datetime.html): microsecond storage and up to six fractional digits.
- [PostgreSQL numeric output](https://www.postgresql.org/docs/17/datatype-numeric.html): precise shortest float output and `extra_float_digits`.
- [PostgreSQL locks](https://www.postgresql.org/docs/17/sql-lock.html): transaction-held table lock modes.
- [PostgreSQL constraints](https://www.postgresql.org/docs/17/sql-createtable.html): deferred unique constraints and conflict-arbiter limits.
- [PostgreSQL system columns](https://www.postgresql.org/docs/17/ddl-system-columns.html): transaction identifiers are not durable unique artifact versions.
- [Fastify routes](https://github.com/fastify/fastify/blob/main/docs/Reference/Routes.md), [server options](https://github.com/fastify/fastify/blob/main/docs/Reference/Server.md), and [validation](https://github.com/fastify/fastify/blob/main/docs/Reference/Validation-and-Serialization.md): local body limits, pre-handler parser failures, and validation behavior.
- [Zod 3](https://v3.zod.dev/) and [error handling](https://v3.zod.dev/ERROR_HANDLING): strict nested objects and field-path diagnostics.

The transaction, epoch, numeric-encoding, and UI designs above are project-specific conclusions from those references and inspected code. All planning unknowns are resolved; performance, migration safety, and implementation correctness remain to be demonstrated during implementation.
