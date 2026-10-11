# Research: CLI Diagram Deletion

## Existing evidence

- CLI main.ts uses strict Node argument parsing and exit statuses 0/1/2; api-client.ts validates shared schemas.
- DiagramService trashSnapshot/trash confirm only active UUIDs and preserve prior batches. No permanent diagram purge exists.
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

All planning unknowns resolved: existing dependencies, additive counter migration, shared locks, strict confirmation, normalized purge and rollback fix. Planned performance budgets and concurrency guarantees still require implementation evidence.
