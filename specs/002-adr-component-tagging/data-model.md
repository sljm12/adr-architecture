# Data Model: Architecture Decision Records

## ArchitectureDecisionRecord (`adrs`)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; generated once and immutable. |
| `diagramId` | UUID | Required foreign key to `diagrams.id`; the owning diagram. |
| `title` | string | Required, trimmed, non-blank; human-readable. |
| `context` | string | Required, trimmed, non-blank; long text preserved. |
| `decision` | string | Required, trimmed, non-blank; long text preserved. |
| `consequences` | string | Required, trimmed, non-blank; long text preserved. |
| `alternativesOrConstraints` | string or null | Optional; blank input normalizes to null. |
| `status` | `draft \| accepted \| superseded \| rejected` | Required; all transitions are allowed. |
| `replacementAdrId` | UUID or null | Required only for `superseded`; different ADR in the same diagram. |
| `createdAt` | timestamp | Server-managed; immutable after creation. |
| `updatedAt` | timestamp | Server-managed on successful mutation. |

The shared schema rejects invalid UUIDs, unsupported statuses, missing required text, self-
replacement, and a superseded ADR without a replacement. The service additionally rejects a
replacement from another diagram or a missing replacement. Superseded and rejected records remain
queryable.

## ComponentReference (`adr_component_links`)

| Field | Type | Rules |
|---|---|---|
| `adrId` | UUID | Foreign key to `adrs.id`; part of the composite primary key. |
| `componentId` | UUID | Foreign key to `components.id`; part of the composite primary key. |
| `createdAt` | timestamp | Server-managed link creation time. |

The composite primary key `(adrId, componentId)` prevents duplicate links. Link replacement is
atomic: validate every requested component belongs to the ADR's diagram, then replace the complete
set. An empty set is valid and is represented as an explicitly unlinked ADR.

## Existing related entities

`Diagram` owns `Component` records. Component `id` remains stable through rename and reposition, so
ADR links never store names, React Flow node IDs, or positions. Relationships continue to reference
component IDs independently of ADR links.

## Reference and deletion invariants

1. A draft may exist locally without a saved server record; only a validated ADR is persisted.
2. Every persisted ADR belongs to an existing diagram.
3. Every component link belongs to an existing component in the ADR's diagram.
4. A superseded ADR references a different persisted ADR in the same diagram.
5. An ADR cannot be deleted while another ADR references it as `replacementAdrId`; the response
   identifies each blocking ADR so references can be repaired or removed explicitly.
6. A component cannot be deleted while any ADR links to it; the response identifies blocking ADRs.
7. Create/update/link/unlink operations preserve stable IDs and unrelated links.
8. Save failures leave the local draft intact with `unsaved`/`failed` state and a retry action.
9. UI deletion requires confirmation; server-side dependency checks remain authoritative.

## State transitions

`status` has no restricted transition graph: `draft`, `accepted`, `superseded`, and `rejected` may
transition to any supported status. The invariant is conditional: entering `superseded` requires a
valid replacement; leaving `superseded` may clear the replacement reference in the same validated
update. Replacement cycles are not prohibited by the feature unless later requirements add that rule.
