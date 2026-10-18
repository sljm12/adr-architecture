# Data Model: Lossless Diagram Export and Import

## Portable archive

The machine-readable boundary is [archive.schema.json](contracts/archive.schema.json). Runtime implementation belongs in `shared/src/archive/` and must match that contract without coercion, trimming, default values, or unknown-key removal. Archive row names map to database columns; no React Flow state is transported.

| Field | Type and rule |
| --- | --- |
| `format` | Literal `adr-diagram-archive`. |
| `version` | Integer literal `1`. Reject other versions explicitly. |
| `purpose` | `diagram` or `recovery`. Both use the same import workflow. |
| `exportedAt` | Canonical UTC timestamp with six fractional digits. Export metadata only. |
| `selectedDiagramId` | UUID of the selected diagram; for recovery, the first sorted pre-existing changed diagram seed. Must occur in `seedDiagramIds`. |
| `seedDiagramIds` | Nonempty unique UUID array. For normal export, exactly `[selectedDiagramId]`; for recovery, the pre-existing diagrams whose contents changed. |
| `includedDiagramIds` | Sorted unique UUID manifest, exactly the identities in `records.diagrams`. |
| `recoveryForFileSha256` | Null for normal export; SHA-256 of the original incoming UTF-8 file for recovery. |
| `records` | Exactly the eight arrays below. Empty owned arrays remain explicit. |

Normal scope is the fixed point of: seed -> top-level ancestor -> every descendant of that root -> every referenced record's owning top-level hierarchy, including Trash roots, repeated until closed. Recovery uses the union of the same closure for all changed pre-existing seeds. File validation proves scope closure and rejects undeclared extra unrelated roots. Seed identity and manifest must be consistent; records appear once.

## Primitive values

- UUIDs: standard hyphenated text; comparison and fingerprints use lowercase, preserving the same 128-bit identity and version. Duplicate definitions after case normalization fail.
- Timestamp: finite Gregorian UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ`, years 0001–9999, calendar-valid including leap days; no infinity, offset variants, or Date conversion. Nullable timestamp columns remain null. Unsupported stored values fail export with the field path.
- Portable revision: decimal string `0` or nonzero digits without leading zeros, range `0..9223372036854775807`.
- Layout scalar: finite binary64 encoded as canonical shortest round-trip decimal string; `-0` is distinct from `0`. Require that decoding and canonical rendering return exactly the input. Width/height must additionally be positive. Decimal strings are not arbitrary-precision decimal fields.
- Text: retain exact Unicode, whitespace, empty-string and null values. Validate existing length/nonblank rules without replacing the original text. Legacy free-form general component classifications remain supported.
- All record fields are required, including nullable fields. JSON object key order and array order do not express saved order; export sorts by primary identity and endpoint-pair identity for determinism.

## Eight portable record collections

| Collection | Identity | Required fields |
| --- | --- | --- |
| `diagrams` | `id` | `id`, `name`, `status`, `kind`, `createdAt`, `updatedAt`, `trashedAt`, `parentDiagramId`, `ownerComponentId`, `scopeX`, `scopeY`, `scopeWidth`, `scopeHeight`, `trashBatchId`, `trashRootDiagramId`, `deletionRevision`. |
| `components` | `id` | `id`, `diagramId`, `name`, `description`, `type`, `role`, `containerType`, `technology`, `sourceComponentId`, `x`, `y`, `width`, `height`, `createdAt`, `updatedAt`. |
| `relationships` | `id` | `id`, `diagramId`, `sourceComponentId`, `targetComponentId`, `direction`, `label`, `protocol`, `createdAt`, `updatedAt`. |
| `systemGroups` | `id` | `id`, `diagramId`, `name`, `x`, `y`, `width`, `height`, `createdAt`, `updatedAt`. |
| `systemGroupMembers` | `(groupId, componentId)` | `groupId`, `componentId`, `createdAt`. |
| `adrs` | `id` | `id`, `diagramId`, `title`, `context`, `decision`, `consequences`, `alternativesOrConstraints`, `status`, `replacementAdrId`, `createdAt`, `updatedAt`. |
| `adrComponentLinks` | `(adrId, componentId)` | `adrId`, `componentId`, `createdAt`. |
| `adrRelationshipLinks` | `(adrId, relationshipId)` | `adrId`, `relationshipId`, `createdAt`. |

Nullability follows the existing persistence schema. `general` diagrams have null parent/owner/scope; child diagrams have valid owners and boundaries. Retain raw saved child names and cached external-participant metadata, even when ordinary views derive different display values from their current owners/sources. These caches must not become extra identity keys.

## Validation projection and graph rules

Create a temporary domain projection with numeric layout and source-derived scope fields, then apply existing C4, group, ADR, and relationship rules. Do not write the projection back. Extend validation only for missing archive-level coverage: all eight table identities, ownership and source closure, field ranges, recovery provenance, manifest equality, and the destination union. Existing invariants govern lifecycle and replacement validity; do not add a prohibition on supported multi-ADR replacement cycles.

For each included diagram, its entire owned record set is authoritative. Construct the proposed state by replacing all eight-table data owned by included diagrams while retaining every other destination diagram and its records. Validate that combined state before writes. Identity is scoped by collection: equal UUID bytes in different tables do not imply the same artifact. A matching same-type UUID under incompatible ownership fails; diagrams may not change parent/owner/kind under an existing identity. Endpoint pairs remain identities, not newly assigned UUIDs.

Incoming-only records are additions, existing same-identity differing rows are replacements, destination-only owned records are removals, and byte-equivalent stored values after primitive normalization are unchanged. Count each table's records once. A change to a membership/link timestamp is a replacement, not an unchanged link.

## Installation-local confirmation ledger

New operational table `diagram_confirmation_epochs`:

| Column | Rule |
| --- | --- |
| `diagram_id` | UUID primary key, deliberately no FK/cascade. Retain after permanent deletion. |
| `epoch` | Nonnegative bigint. Missing entry means zero. Increment in the same import transaction for every effectively changed or inserted diagram; overflow aborts atomically. |

Epochs are installation-local concurrency coordination, not architecture artifact values or historical revisions. They are never part of archive files and never reset by import, recovery, purge, or UUID reuse. Operational bookkeeping is distinct from the original portable `diagrams.deletion_revision`, which is restored exactly. No ledger entry changes for a no-op exact reimport.

Migration `0009_diagram_archive.sql` adds this table without changing existing artifact values; changes the source-reference uniqueness index to an equivalent deferrable constraint; and aligns schema metadata with the already-existing ADR replacement FK. Preserve all earlier applied migrations. Add coverage for upgrading a populated database, rollback, duplicate source rejection in normal writes, valid source swaps during import, and timestamp/revision preservation.

## Transactional write order

1. Parse and validate the standalone file before writer coordination. Inside one collection transaction, read raw destination rows, relevant absent/present identities and epochs, validate the combined graph, reconstruct the reviewed recovery file, and reject a mismatched fingerprint before mutation.
2. Defer only the source-reference unique constraint. Upsert new/existing general diagrams and owner components, then container diagrams and components, then component diagrams and components. Existing common identity rows remain in place. Delay recovery-root references until all required diagram rows exist.
3. Upsert groups and relationships; stage needed ADR replacement references as null within the transaction, insert/update ADR rows, then restore exact replacements after all referenced ADRs exist. Add/update memberships and both ADR-link kinds with their original timestamps.
4. Remove stale links and memberships before stale relationships, groups, ADRs and components. Clear obsolete ADR replacement references and remove external occurrences before obsolete canonical sources. Never delete diagram rows as an import side effect. Preserve retained references by validating the final graph, not by deleting common rows.
5. Restore every exact incoming nullable/reference field after staging, verify every primitive and final invariant, force deferred constraint checking, advance changed-diagram epochs, and commit. Skip identical rows. A failure rolls back artifacts and epochs together.

Chunk SQL parameters safely using fixed known columns and bound values; do not construct SQL from file keys. An import has one transaction regardless of batching. A failure while applying a late table, reference, epoch, or deferred constraint must roll back the whole operation.

## Preview state and transitions

`file selected -> standalone validated -> destination reviewed -> recovery downloaded/acknowledged when needed -> confirmed -> committed -> views refreshed`.

Cancellation from any pre-commit state makes no saved changes. A save or relevant destination/file change returns to fresh review. Failed commit rolls back; response loss after submission is an uncertain outcome, never an automatic retry. Refresh failure after a confirmed commit is a separate successful-import/failed-refresh state.

The preview binds exact input bytes, preview time, all incoming identities including absent identities, relevant retained dependencies and complete owned rows, original revisions, local epochs, delta, collisions, and recovery digest. Do not bind unrelated graph content unless it can change scope or dependencies. No expiry or server token registry is introduced.

Recovery files include only pre-existing changed seeds plus complete prior dependencies. They cannot contain diagrams that did not exist before the import. Reimporting recovery retains newly added destination diagrams, and their references can block recovery even without later edits.

## Memory repository parity

Extend existing memory diagram/ADR stores with raw snapshot/apply methods and missing per-link/per-membership creation metadata; include these and epochs in collection snapshots/rollback. Existing write methods must maintain this metadata. Do not introduce a second independent memory artifact store or reconstruct timestamps at export time. Seed fixtures with explicit raw values. Real PostgreSQL tests remain mandatory for driver precision, constraints, and lock behavior.
