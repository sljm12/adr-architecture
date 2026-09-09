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

The composite primary key `(adrId, componentId)` prevents duplicate links. Component-link
replacement is atomic: validate every requested component belongs to the ADR's diagram, then replace
the complete set. An empty set is valid and is represented as an empty component-link collection.

## RelationshipReference (`adr_relationship_links`)

| Field | Type | Rules |
|---|---|---|
| `adrId` | UUID | Foreign key to `adrs.id`; part of the composite primary key. |
| `relationshipId` | UUID | Foreign key to `relationships.id`; part of the composite primary key. |
| `createdAt` | timestamp | Server-managed link creation time. |

The composite primary key `(adrId, relationshipId)` prevents duplicate links. Relationship-link
replacement is atomic: validate every requested relationship belongs to the ADR's diagram, then
replace the complete set. An empty set is valid. Component and relationship link sets are replaced
independently, so updating one set preserves the other.

## ComponentAdrSummary (read model)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Stable ADR identity; direct navigation target. |
| `title` | string | Current ADR title. |
| `status` | `draft \| accepted \| superseded \| rejected` | Current ADR lifecycle status. |
| `updatedAt` | timestamp | Last successful ADR mutation. |

For a valid component in the active diagram, the component-scoped ADR summary returns every linked
ADR exactly once, ordered consistently with the ADR list. A valid component with no links returns an
empty collection, which the UI presents as a no-linked-ADRs state rather than an error. The summary
is derived from `adr_component_links` and `adrs`; it is not persisted as a second copy.

## RelationshipAdrSummary (read model)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Stable ADR identity; direct navigation target. |
| `title` | string | Current ADR title. |
| `status` | `draft \| accepted \| superseded \| rejected` | Current ADR lifecycle status. |
| `updatedAt` | timestamp | Last successful ADR mutation. |

For a valid relationship in the active diagram, the relationship-scoped ADR summary returns every
linked ADR exactly once, ordered consistently with the ADR list. A valid relationship with no links
returns an empty collection, which the UI presents as a no-linked-ADRs state rather than an error.
The summary is derived from `adr_relationship_links` and `adrs`; it is not persisted as a second
copy.

## Existing related entities

`Diagram` owns `Component` and `Relationship` records. Component and relationship IDs remain stable
through ordinary rename, relabel, endpoint, reposition, and visual edits, so ADR links never store
names, labels, endpoints, React Flow IDs, or positions. Relationships continue to reference
component IDs independently of ADR links.

## Reference and deletion invariants

1. A draft may exist locally without a saved server record; only a validated ADR is persisted.
2. Every persisted ADR belongs to an existing diagram.
3. Every component link belongs to an existing component in the ADR's diagram.
4. Every relationship link belongs to an existing relationship in the ADR's diagram.
5. A superseded ADR references a different persisted ADR in the same diagram.
6. An ADR cannot be deleted while another ADR references it as `replacementAdrId`; the response
   identifies each blocking ADR so references can be repaired or removed explicitly.
7. A component cannot be deleted while any ADR links to it or to a dependent relationship that
   would be removed; the response identifies blocking ADRs.
8. A relationship cannot be deleted while any ADR links to it; the response identifies blocking
   ADRs.
9. Create/update/link/unlink operations preserve stable IDs and unrelated links.
10. Save failures leave the local draft intact with `unsaved`/`failed` state and a retry action.
11. UI deletion requires confirmation; server-side dependency checks remain authoritative.
12. Component and relationship summary reads are scoped to the active diagram and artifact identity;
    they expose
    only linked ADR metadata and preserve the stable ADR ID needed to open the full record.

## State transitions

`status` has no restricted transition graph: `draft`, `accepted`, `superseded`, and `rejected` may
transition to any supported status. The invariant is conditional: entering `superseded` requires a
valid replacement; leaving `superseded` may clear the replacement reference in the same validated
update. Replacement cycles are not prohibited by the feature unless later requirements add that rule.
