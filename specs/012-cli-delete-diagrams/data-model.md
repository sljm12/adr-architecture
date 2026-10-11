# Data Model: CLI Diagram Deletion

## Existing identity and ownership

Keep artifact UUIDs. General diagrams own Container children via Software System components; Containers own Component children via Application/Datastore components. Source references, ADR links and replacements are dependencies, not ownership edges. Follow three supported saved levels.

Exact names use existing resolved saved summary names, including owner-derived child titles. Compare unchanged strings; blank input is rejected. UUID-shaped names remain selectable as names.

## Persistent revision

Add diagrams.deletion_revision: bigint, non-null, default zero for existing records, non-negative and server-managed. Migration 0008 preserves UUIDs, timestamps, contents and provenance. Expose it only to internal repository code as a decimal string, never JavaScript number or editable document field.

Initialize on create. Increment on successful diagram save, component/relationship removal, Trash/restore, and every ADR mutation through AdrService.graphWrite. Mutations and increments share a transaction; failure rolls both back. Memory stores counters alongside documents and snapshots them. Purge removes the counter.

## Boundary entities

| Entity | Fields and rules |
|---|---|
| DeletionSelector | Exactly one strict object: {id: UUID} or {name: non-blank literal string}; no unknown fields or normalization. |
| Mode | Exactly trash or permanent; required. |
| DeletionImpact | rootDiagramId, mode, non-empty affectedDiagrams (existing DiagramSummary fields), confirmationToken. |
| Confirmation | Strict {mode, confirmationToken}, posted to resolved root UUID. |
| DeletionResult | Strict {rootDiagramId, mode, affectedDiagrams}; pre-deletion summaries returned after commit. |

Trash searches active only; permanent searches active and trashed. Zero matches fail; duplicates return candidate summaries and require UUID. Arrays are root first then parent-before-child, UUID-ordered within each depth; entries are unique and include root.

Internal confirmation snapshot includes format version, root/mode, summaries, complete subtree membership/statuses, affected full documents/ADRs/links/replacements/provenance/revisions, and source/owner ancestor data and revisions contributing to resolved content. Sort object keys and unordered identity sets deterministically; preserve meaningful order. SHA-256 token is opaque lowercase 64-character hex. It is a concurrency precondition, not authentication; no persistent token registry or new expiry policy.

Ancestor revision changes may conservatively require re-review even when derived display values are unchanged. Unrelated graphs do not invalidate confirmation. Previously trashed descendants are membership guards for Trash, not new batch members. Full ADR content and internal revisions are not returned in preview.

## State transitions

| Action | Outcome |
|---|---|
| Trash active root | Root and active descendants trashed together; earlier Trash batches preserved. |
| Permanent active/trashed root | Entire selected subtree physically removed regardless of descendant status. |
| Invalid/cancel/stale/blocked | No deletion changes; concurrent edits preserved. |
| Execution failure | Complete transaction rollback including counters and registration indexes. |

Existing restore remains ancestor-first/batch-bound. Purging a child frees the owner's uniqueness slot for later explicit creation with a new UUID; stale saves must not resurrect the old UUID.

## Purge validation/order

Reject missing/cyclic/wrong-level hierarchy and inbound external references: diagram parent/owner/trash-root, component sources, relationship endpoints, group memberships, ADR component/relationship links, and replacement IDs. Include owning diagram/artifact IDs and next action. Do not silently detach an outside record.

Within one transaction clear internal trash-root references; delete owned ADR links/records as a set (internal replacement chains do not block); remove owned group memberships/groups and relationships; delete components and diagrams deepest-first so source/owner dependencies remain until dependents are removed. Keep restrictive FKs; unexpected constraints cause rollback and actionable errors.

Memory purge removes documents, provenance/revision maps, ADR records and registered diagram/component/relationship indexes. Rollback uses retained pre-action IDs and safely tracked new IDs without needing the removed root.
