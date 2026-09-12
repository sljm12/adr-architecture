# Data Model: C4 System Groups

## C4 artifact type

The existing `components.type` field is the serialized C4 system-context artifact type.

| Value | Label | Description | Group eligibility |
|---|---|---|---|
| `person` | Person | A user, actor, role, or persona interacting with systems. | No |
| `software-system` | Software System | A software system shown in the system-context view. | Yes |

The field remains nullable on stored documents for backwards compatibility with diagrams created
before this feature. A null value is presented as `Unclassified`, is not a valid new component
selection, and cannot be added to a system group until the component is edited to a supported C4
type. New component creation and saved feature documents use only the two supported values.

## Transient grouping selection

The active grouping selection is editor interaction state, not part of `DiagramDocument` and not
persisted through the API. It tracks the component identities currently selected for a possible
group. Every selected component has a visible selection cue that is distinguishable from unselected
components without relying on color alone. Selecting or deselecting a component updates that cue;
cancellation, successful grouping, or leaving grouping selection clears it.

If the selection includes an ineligible or incompatible component, group creation is blocked and the
feedback identifies the relevant artifact type or types and explains the rule. For example, a mixed
Person and Software System selection is rejected with an explanation that system groups contain only
Software Systems. No group or membership mutation is made while the selection is invalid.

## SystemGroup (`system_groups`)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; generated once and immutable. |
| `diagramId` | UUID | Required foreign key to the owning `diagrams.id`. |
| `name` | string | Required, stored trimmed, non-blank, and unique within the diagram after case-insensitive comparison. |
| `memberComponentIds` | UUID[] | At least two unique component IDs; every member is a Software System in the same diagram. |
| `position` | `{ x: number, y: number }` | Top-left boundary position in domain canvas coordinates; finite values. |
| `size` | `{ width: number, height: number }` | Positive finite dimensions; includes the group label area and member padding. |
| `createdAt` | timestamp | Server-managed; immutable after creation. |
| `updatedAt` | timestamp | Server-managed on successful document persistence. |

`memberComponentIds` is represented by `system_group_members` in PostgreSQL:

| Field | Type | Rules |
|---|---|---|
| `groupId` | UUID | Foreign key to `system_groups.id`; part of the composite primary key. |
| `componentId` | UUID | Foreign key to `components.id`; part of the composite primary key. |
| `createdAt` | timestamp | Server-managed membership creation time. |

Membership deletion is explicit during an accepted group replacement or ungroup operation. It does
not cascade to the component, its relationships, or its ADR links.

## DiagramDocument extension

`DiagramDocument` gains:

```text
groups: SystemGroup[]
```

The API returns `groups: []` for existing diagrams without groups. The input validator defaults a
missing `groups` property to an empty array so older clients and documents remain readable; the
returned document always contains the field.

Existing entities remain unchanged:

- `Diagram` owns components, relationships, and groups.
- `Component.id` remains the stable target for relationships and `adr_component_links`.
- `Relationship.sourceComponentId` and `Relationship.targetComponentId` continue to reference
  components, never groups.
- ADR records and their component links do not gain group references in v1.

## Invariants

1. Every group ID and member component ID is a valid stable UUID.
2. Every group belongs to the document's diagram; every member component belongs to that diagram.
3. Group names are trimmed, non-blank, and unique within a diagram after case-insensitive
   comparison. Duplicate names are rejected without mutating the current document.
4. Every group has at least two unique members, and every member's `type` is exactly
   `software-system`.
5. A component belongs to zero or one group. A group cannot contain another group, and group IDs are
   never relationship endpoints.
6. The group boundary has positive finite dimensions and encloses every member's rendered node box,
   including the label/header and configured padding. Group creation calculates this boundary around
   existing member positions without rearranging them. Later member movement or resizing is clamped
   to the boundary; no layout operation silently removes a member.
7. Group creation, rename, member removal, layout movement, and ungroup are document edits recorded
   in the existing active-diagram history. Ungroup removes only the group and membership records.
8. Moving a group applies the same delta to every member's domain position, preserving their relative
   arrangement and leaving relationship and ADR IDs unchanged.
9. Removing a member leaves its component at its current absolute canvas position. A group with fewer
   than two members cannot be persisted; the UI must ask the author to remove the whole group or add
   another Software System.
10. Component deletion is blocked while the component is a group member unless membership is removed
    explicitly first. This prevents dangling membership rows and makes the destructive consequence
    visible.
11. A failed save leaves the local document, groups, membership, and undo/redo history intact. A
    successful save updates server-managed timestamps while preserving existing group/component IDs.

## Validation and error semantics

Shared Zod schemas validate UUIDs, C4 type values for new/edit inputs, names, member uniqueness,
positive layout dimensions, and the shape of the complete document. Domain invariants perform the
cross-entity checks: group ownership, member ownership, type eligibility, one-group membership,
group-name uniqueness, and boundary containment.

The API returns the existing actionable validation shape with paths such as:

- `groups[0].name` — blank or duplicate group name after trimming and case-insensitive comparison.

- `components[2].type` — unsupported or missing C4 type for a new component.
- `groups[0].name` — blank or duplicate group name.
- `groups[0].memberComponentIds` — fewer than two members, duplicate IDs, missing component, or a
  non-Software-System member; the message identifies the incompatible artifact type and explains why
  it cannot be grouped.
- `groups[0].size` — non-positive or non-finite boundary dimensions.

No group mutation is committed when any validation rule fails.

## Persistence migration

Add `backend/drizzle/0003_system_groups.sql` after the existing diagram and ADR migrations:

- create `system_groups` with diagram ownership, name, boundary position/dimensions, and timestamps;
- create `system_group_members` with composite primary key `(group_id, component_id)` and explicit
  foreign keys;
- add indexes for `diagram_id` and `component_id` reverse lookups;
- do not add cascade behavior that could remove components, relationships, or ADR links during group
  deletion.

The repository maps normalized rows into the document's `groups` array in deterministic
`createdAt`/UUID order and replaces group rows/members transactionally with the rest of a saved
diagram.

## State transitions

```text
no group
  -> create (2+ Software Systems, unique trimmed/case-insensitive name, boundary fitted around current positions)
  -> active group
active group
  -> rename / move / constrained member layout
  -> remove one member (only if 2+ remain after the operation)
  -> ungroup (group and memberships removed; components remain)
```

Changing a component name, position, C4 type, relationship, or ADR link does not change the stable
group ID or member IDs. Changing a member from `software-system` to `person` is rejected until the
component is removed from its group.
