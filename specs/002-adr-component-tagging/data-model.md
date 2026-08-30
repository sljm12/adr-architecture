# Data Model: Architecture Decision Records

## ArchitectureDecisionRecord (`adrs`)

- `id: UUID` — primary key, generated once and immutable.
- `diagramId: UUID` — owning active diagram; required for component-scope validation.
- `title: string` — required, human-readable, non-blank.
- `context: string` — required, non-blank.
- `decision: string` — required, non-blank.
- `consequences: string` — required, non-blank.
- `alternativesOrConstraints: string | null` — optional.
- `status: draft | accepted | superseded | rejected` — required; status changes are unrestricted.
- `replacementAdrId: UUID | null` — required when status is `superseded`; must identify another ADR
  in the same diagram and must not equal `id`.
- `createdAt: timestamp` and `updatedAt: timestamp` — server-managed.

Validation rejects missing required text, unsupported statuses, invalid UUIDs, self-replacement,
cross-diagram replacement, and superseded records without a replacement. A replacement target cannot be
deleted while referenced. Rejected and superseded records remain queryable.

## ComponentReference (`adr_component_links`)

- `adrId: UUID` — foreign key to `adrs.id`.
- `componentId: UUID` — foreign key to the existing diagram component identity.
- `createdAt: timestamp` — audit metadata.

Primary key is `(adrId, componentId)` to prevent duplicate links. The service verifies that the component
exists and belongs to the ADR's diagram before insert. Missing or cross-diagram links are rejected;
unlinked ADRs are valid and represented by an empty collection.

## Existing related entities

`Diagram` owns `Component` records. Component rename and position updates do not change `component.id`.
Relationships continue to reference component IDs. Component deletion is rejected when links exist and
returns the blocking ADR IDs/titles so the user can remove affected links explicitly before retrying.

## State and invariants

1. Draft edits may exist locally without a saved server record; only validated records are persisted.
2. Create/update/link/unlink operations preserve `adrs.id` and all unrelated links.
3. Save failures leave the local draft intact with `unsaved`/`error` state and a retry command.
4. Deletes require UI confirmation and server-side dependency checks.
