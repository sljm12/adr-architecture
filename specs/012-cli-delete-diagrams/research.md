# Research: CLI Diagram Deletion

## Update research (2026-10-13)

This update retains the technology choices and completed single-root implementation. Earlier decisions below describe that baseline, not work to repeat.

### Collection atomicity and membership coordination

**Decision**: Add a collection transaction using PostgreSQL `LOCK TABLE diagrams IN SHARE ROW EXCLUSIVE MODE` before target discovery. Existing graph transactions acquire `ROW EXCLUSIVE` on diagrams before root/descendant row locks; top-level creation acquires the writer lock before INSERT. Memory serializes supported writes through one repository-wide queue, with transaction-scoped reentry bypass and full collection snapshots for rollback.

**Rationale**: Existing one-Context locks cannot prevent new matching Context roots, renames in unselected graphs, or new Trash entries. The table lock freezes membership and all compliant diagram/ADR writes while building and executing a reviewed collection. PostgreSQL's conflict matrix shows SHARE ROW EXCLUSIVE conflicts with ROW EXCLUSIVE, but not the ROW SHARE taken by SELECT FOR UPDATE. Explicit table-before-row order is therefore required to avoid a writer holding a root row while waiting for the collection's table lock. Hold locks only during preview/execution, never user input. Ordinary writer table locks remain mutually compatible.

**Alternatives considered**: Independent per-root transactions allow partial commits; locking only existing roots misses membership phantoms; nesting graph transactions does not share one rollback boundary. Serializable isolation would require broader conflict/retry handling. Shared/exclusive advisory locks require a new coordination protocol without reducing writer reach. A persistent global revision adds a migration without eliminating execution coordination. The chosen coarse lock is sufficient for the existing single-user product; measure write delay before considering finer coordination.

**Inspected reach**: DiagramRepositoryLike and both implementations; GraphTransaction; top-level DiagramService.create; all save, child-create, Trash/restore, component/relationship and AdrService.graphWrite paths; repository proxies/fixtures; graph/revision/concurrency tests. Direct administrative artifact SQL remains outside the supported writer/revision protocol.

### Complete affected set and recovery

**Decision**: Gather validated subtrees before running dependency checks once over their unique union. Preserve all matched root identities in the preview even when nested. Order affected identities by saved hierarchy depth and UUID; purge deepest-first. Trash allocates one existing batch per outermost selected subtree. Clear Trash uses exactly all status=trashed IDs and never expands into active descendants.

**Rationale**: Current deletionSnapshot combines subtree gathering and per-root blockers; calling it in a loop falsely treats another selected root as outside scope. Current purgeOwned/purge accept a complete ID set and can be reused. Outside parent/source/owner references block clearing without detaching active artifacts. Recovery provenance remains compatible with existing restoration.

**Alternatives considered**: One batch across disjoint roots violates existing one-root recovery provenance; independently processing overlapping roots duplicates work; recursive permanent deletion from each Trash entry can include active data.

### Additive command and API boundaries

**Decision**: Keep legacy single-root routes/shapes unchanged. Add `POST /diagrams/deletion-set-preview` and `POST /diagrams/deletion-set` for strict tagged targets: all-matches with exact name/mode, or clear-trash. CLI routes `--all-matches` and `diagrams clear-trash [--yes]` to these endpoints and reuses its prompt/output flow. Execution carries reviewed target, root IDs and token; membership is recomputed solely for comparison. Empty Trash is a successful preview-only no-op.

**Rationale**: Avoid breaking callers expecting rootDiagramId/nonempty affectedDiagrams. New collection schemas allow empty Trash and bind the selected root set and action without storing tokens. Existing revision counters detect content edits and edit/revert.

**Alternatives considered**: Replacing the old response with root arrays would break strict clients; accepting UUID lists would expand user scope; making --all-matches bypass confirmation would remove a required safeguard.

### Documentation verification

The planning research agent used Context7 library resolution and docs on 2026-10-13, selecting `/websites/postgresql_16` for PostgreSQL lock behavior. [Explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html) and [LOCK](https://www.postgresql.org/docs/16/sql-lock.html) establish transaction-held locks, the conflict matrix and consistent lock order. Applying a diagrams-table lock as the collection writer barrier is an inference from the inspected supported writer paths. No library upgrades or new API syntax are required; retain installed Drizzle transaction patterns. All update research unknowns are resolved; actual race, rollback and latency guarantees still require implementation tests.

## Existing evidence

- CLI main.ts uses strict Node argument parsing and exit statuses 0/1/2; api-client.ts validates shared schemas.
- At initial planning, DiagramService trashSnapshot/trash confirmed only active UUIDs and permanent purge was absent. Single-root preview/execute, revisions, purge and rollback fixes are now implemented; retain them.
- PostgresDiagramRepository.withGraphTransaction locks the canonical Context root, rediscovers descendants and locks them deterministically. AdrService.graphWrite shares that transaction protocol.
- ADR writes do not bump diagram timestamps. Content hashes cannot detect edit/revert with equal timestamps.
- Restrictive parent/owner/source/trash-root constraints require explicit purge order. ADR replacement IDs require application checks because they have no FK.
- Both memory rollback paths traverse descendants before restoration, which fails after deleting the Context root.
- Existing list names are hydrated from persisted owners for Container/Component diagrams; raw diagrams.name may be stale.

## Decisions

### Server-side selection and additive endpoints

**Decision**: Preview accepts selector/mode; execution takes only resolved UUID/mode/token. Extend recovery route registration.
**Rationale**: Exact targeting and no name retargeting; preserve existing browser DELETE/restore.
**Alternatives considered**: Client substring list filtering and replacing existing DELETE semantics introduce ambiguity or compatibility breaks.

### Revision tracking and confirmation snapshot

**Decision**: Add an internal monotonic bigint per diagram. Diagram repository writes increment it; successful ADR graphWrite increments its owning diagram inside the same graph transaction. Hash affected full contents/revisions/provenance, membership, mode/root and required ancestor dependencies.
**Rationale**: Detect every supported persisted edit, including ADR-only changes and edit/revert under frozen clocks; preserve public artifact formats.
**Alternatives considered**: Timestamps or hashes alone miss cases. Root-wide counters reject unrelated sibling writes. Full-root comparisons on every write cost more and miss reverted intermediate writes. Triggers across every artifact table are unnecessary for the existing public service-writer protocol.

Direct repository ADR calls used by fixtures are not public writers; seed consistent revision state and test stale detection through service writes. Any future writer bypassing graphWrite must adopt graph locks and revision increments. External SQL writers would require database-enforced tracking.

### Locking and physical purge

**Decision**: Reuse existing graph locks for preview and execution. Recompute confirmation under execution locks. Check outside references and remove owned records leaf-first with restrictive FKs retained.
**Rationale**: Serializes supported writers and prevents partial deletion; selecting a child never deletes its parent owner.
**Alternatives considered**: Token validation outside mutation races; child-only locks miss ancestor changes; cascade migrations silently widen scope; loops over public single-artifact deletion produce partial outcomes/internal blockers.

Use bulk owned ADR removal rather than single-ADR delete because internal replacement chains are within the authorized subtree. Check external source, owner, parent, trash-root, endpoint, group, ADR-link and replacement references. Clear internal trash-root references before batch roots are removed.

### Memory rollback

**Decision**: Capture pre-action graph IDs and restore even when root is absent; include newly created members safely. Restore ADR registration indexes as well as records.
**Rationale**: Existing rollback traversal throws after permanent root removal.
**Alternatives considered**: Reusing rollback unchanged fails atomicity; replacing memory repositories is unnecessary.

### Confirmation and operational choices

**Decision**: Explicit --id/--name, --trash/--permanent, optional --yes; cancellation exits 1, usage exits 2, commit exits 0. No auto retry, extra dry-run/JSON options or token table.
**Rationale**: Small extension of existing conventions that supports scripts and preserves explicit destructive consent.
**Alternatives considered**: Default mode conflicts with requirements; interactive-only confirmation excludes scripts.

## Current documentation

Context7 resolved Drizzle ORM to /drizzle-team/drizzle-orm-docs (official, High reputation, score 82.53), and fetched transaction/restrictive-FK guidance on 2026-10-11. PowerShell npx.ps1 was blocked by execution policy; npx.cmd succeeded outside the sandbox.

[Official transaction guidance](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/transactions.mdx) confirms transaction-scoped writes, rollback and PostgreSQL isolation configuration. [Official FK action guidance](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/relations.mdx) confirms restrictive versus cascading actions. Reusing read-committed graph locks is an inference from inspected compliant writer behavior, not a claim that transactions alone prevent stale confirmation.

## Resolution

All planning unknowns resolved, including collection coordination, membership guards, whole-union dependencies, recovery batches, and additive contracts. Historical single-root validation does not prove the new collection flows; their race, rollback and performance guarantees require new implementation evidence.
