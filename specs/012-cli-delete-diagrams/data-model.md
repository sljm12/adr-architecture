# Data Model: CLI Diagram Deletion

## Existing identity and ownership

Keep artifact UUIDs. General diagrams own Container children via Software System components; Containers own Component children via Application/Datastore components. Source references, ADR links and replacements are dependencies, not ownership edges. Follow three supported saved levels.

Exact names use existing resolved saved summary names, including owner-derived child titles. Compare unchanged strings; blank input is rejected. UUID-shaped names remain selectable as names.

## Persistent revision

Retain existing diagrams.deletion_revision: bigint, non-null, non-negative and server-managed. Migration 0008 already provides it; this update needs no schema migration. Expose it only to internal repository code as a decimal string, never JavaScript number or editable document field.

Initialize on create. Increment on successful diagram save, component/relationship removal, Trash/restore, and every ADR mutation through AdrService.graphWrite. Mutations and increments share a transaction; failure rolls both back. Memory stores counters alongside documents and snapshots them. Purge removes the counter.

## Boundary entities

| Entity | Fields and rules |
|---|---|
| DeletionSelector | Exactly one strict object: {id: UUID} or {name: non-blank literal string}; no unknown fields or normalization. |
| Mode | Exactly trash or permanent; required. |
| DeletionImpact | rootDiagramId, mode, non-empty affectedDiagrams (existing DiagramSummary fields), confirmationToken. |
| Confirmation | Strict {mode, confirmationToken}, posted to resolved root UUID. |
| DeletionResult | Strict {rootDiagramId, mode, affectedDiagrams}; pre-deletion summaries returned after commit. |

These boundary entities remain the unchanged single-root contract. Trash searches active only; permanent searches active and trashed. Zero matches fail; duplicates return candidate summaries with guidance to choose a UUID or explicitly use --all-matches through the collection contract. Legacy arrays retain root-first ordering.

## Collection boundary entities

| Entity | Fields and rules |
|---|---|
| CollectionTarget | Strict tagged union: `{kind: "all-matches", name: nonblank literal string, mode: "trash" or "permanent"}` or `{kind: "clear-trash"}`. Clear Trash has no name, UUID, or mode input. |
| CollectionPreview | Strict `{target: CollectionTarget}`. Name matches use existing resolved saved summaries and mode eligibility. |
| CollectionImpact | Strict `{target, mode, rootDiagramIds, affectedDiagrams, affectedCount, confirmationToken}`. Mode equals target.mode for all-matches, permanent for clear-trash. |
| CollectionConfirmation | Strict `{target, rootDiagramIds, confirmationToken}`; root IDs are the previewed UUID set, not arbitrary additional selectors. |
| CollectionResult | Strict `{target, mode, rootDiagramIds, affectedDiagrams, affectedCount}`; identical identities and pre-action summaries to the reviewed impact, returned only after commit. |

rootDiagramIds is sorted by UUID and unique: every eligible exact-name match, including nested matches, for all-matches; empty for clear-trash. All-matches requires nonempty roots and affected summaries; each root occurs in the affected set. Clear Trash allows zero affected summaries, all must be trashed, and rootDiagramIds must be empty. affectedCount equals affectedDiagrams.length. Names are not normalized. Unknown fields, malformed/repeated IDs, inconsistent modes/counts, duplicate affected UUIDs, and wrong eligibility are rejected. A client cannot authorize deletion by supplying a different root set with an old token.

Collection affected summaries are ordered by absolute saved hierarchy depth then UUID. Parents precede affected children; selected descendants are not duplicate entries. Permanent removal uses reverse depth order, retaining UUID tie ordering for determinism. Clear Trash can include a child with an active ancestor; the ancestor and owner remain outside scope and intact. An active descendant of a removed trashed ancestor is an external blocker.

The versioned collection snapshot binds target/action/mode, root identities, complete eligible match or Trash membership, unique affected full saved-state snapshots and revisions, descendant membership guards, recovery provenance, and required ancestors/sources. Full ADR content/revisions are internal only. Unrelated graphs are not hashed merely because the transaction coordinates all writes. Clearing empty Trash returns a valid zero-item impact; the CLI ends without execution or confirmation.

Collection preview and execution each run under separate collection transactions. PostgreSQL table-before-row locking blocks supported writers while discovering/rechecking membership; memory serializes top-level create and graph writes with collection actions. Execution rejects changed match sets, Trash membership, content, provenance, or ancestor dependencies before mutation. No locks span human confirmation. Memory restores the complete pre-action diagrams/provenance/revisions and ADR/index state on failure, without traversing deleted roots.

Internal confirmation snapshot includes format version, root/mode, summaries, complete subtree membership/statuses, affected full documents/ADRs/links/replacements/provenance/revisions, and source/owner ancestor data and revisions contributing to resolved content. Sort object keys and unordered identity sets deterministically; preserve meaningful order. SHA-256 token is opaque lowercase 64-character hex. It is a concurrency precondition, not authentication; no persistent token registry or new expiry policy.

Ancestor revision changes may conservatively require re-review even when derived display values are unchanged. Unrelated graphs do not invalidate confirmation. Previously trashed descendants are membership guards for Trash, not new batch members. Full ADR content and internal revisions are not returned in preview.

## State transitions

| Action | Outcome |
|---|---|
| Trash active root | Root and active descendants trashed together; earlier Trash batches preserved. |
| Permanent active/trashed root | Entire selected subtree physically removed regardless of descendant status. |
| All-matches Trash | Active union trashed once; one existing batch per outermost selected subtree; prior batches preserved. |
| All-matches permanent | Entire unique union physically removed; internal cross-root references do not block. |
| Clear nonempty Trash | Exactly all reviewed trashed diagrams and owned artifacts permanently removed; active data unchanged. |
| Clear empty Trash | Successful no-op, zero affected diagrams; no execution or consent prompt. |
| Invalid/cancel/stale/blocked | No deletion changes; concurrent edits preserved. |
| Execution failure | Complete transaction rollback including counters and registration indexes. |

Existing restore remains ancestor-first/batch-bound. Purging a child frees the owner's uniqueness slot for later explicit creation with a new UUID; stale saves must not resurrect the old UUID.

## Purge validation/order

Reject missing/cyclic/wrong-level hierarchy and inbound external references: diagram parent/owner/trash-root, component sources, relationship endpoints, group memberships, ADR component/relationship links, and replacement IDs. Include owning diagram/artifact IDs and next action. Do not silently detach an outside record.

Run blocker checks once against the complete authorized union, not per root. Within one transaction clear internal trash-root references; delete owned ADR links/records as a set (internal and cross-root replacement chains do not block); remove owned group memberships/groups and relationships; delete components and diagrams deepest-first so source/owner dependencies remain until dependents are removed. Keep restrictive FKs; unexpected constraints cause rollback and actionable errors.

Memory purge removes documents, provenance/revision maps, ADR records and registered diagram/component/relationship indexes. Rollback uses retained pre-action IDs and safely tracked new IDs without needing the removed root.
