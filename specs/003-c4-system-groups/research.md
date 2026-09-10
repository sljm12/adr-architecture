# Research: C4 System Groups

## Decision: Reuse the existing component `type` field for C4 system-context artifact types

**Decision:** Treat `Component.type` as the canonical C4 artifact-type value for this feature:
`person` or `software-system`. Keep the field nullable in persisted documents so diagrams created
before this feature remain loadable; new component creation requires one of the two supported values.
Legacy components with a null type are shown as `Unclassified` and cannot be added to a system group
until they are edited to a supported type.

**Rationale:** The existing domain, API, and PostgreSQL schema already have a nullable architecture
classification field. Reusing it avoids a second overlapping classification column and avoids a
data migration that would invent types for existing components. The C4 system-context source
describes people and software systems as the primary/supporting elements and deliberately keeps
lower-level technologies out of this view. See the [C4 system context guidance](https://c4model.com/diagrams/system-context).

**Alternatives considered:** A new `c4ArtifactType` column was rejected because it duplicates the
existing classification field and adds a compatibility mapping without enabling a user-visible
capability. Retaining arbitrary free-form values was rejected for new components because grouping
needs a closed, validated set of eligible artifact types.

## Decision: Model groups as first-class domain artifacts with normalized membership

**Decision:** Add `SystemGroup` records to `DiagramDocument.groups`. Each group has its own UUID,
diagram UUID, a name unique after trimming and case-insensitive comparison, member component UUIDs,
and persisted boundary layout (`x`, `y`, `width`, `height`) plus server-managed timestamps. Store the
records in `system_groups` and the
associations in `system_group_members` with a composite primary key.

**Rationale:** Group names and positions are user-authored architecture metadata, not a React Flow
implementation detail. Stable group and member IDs let rename, reposition, save/reopen, and ungroup
operations preserve component, relationship, and ADR identities. A separate membership table keeps
membership queryable and prevents dangling references without encoding an array in PostgreSQL.

**Alternatives considered:** Storing only a `groupId` on each component was rejected because it
makes group identity and group layout awkward to persist and would make deletion/ungroup semantics
less explicit. Storing members as a JSON or PostgreSQL array was rejected because foreign-key and
duplicate-membership validation would move out of the relational boundary.

## Decision: Use non-nested, single-membership groups

**Decision:** A software-system component may belong to at most one group in v1; a group may contain
two or more software systems, and groups may not contain other groups. Relationships continue to
target component UUIDs only. Deleting or ungrouping a group removes only the group and membership
records, never the member components, relationships, or ADR links.

**Rationale:** React Flow's parent-child model provides one `parentId` per child. A single membership
rule therefore gives each component one unambiguous visual parent and prevents overlapping boundary
semantics. It also keeps the domain smaller while satisfying the specified non-nested-group scope.

**Alternatives considered:** Overlapping group membership was rejected because it cannot map cleanly
to one React Flow parent without a custom positioning system and would make movement ambiguous.
Nested groups were rejected because they are explicitly outside v1 and would require recursive
layout, deletion, and validation rules.

## Decision: Keep the domain model authoritative and adapt groups into React Flow subflows

**Decision:** The React Flow adapter will emit one custom group node before its child component
nodes. Each child uses `parentId`, a position relative to the group, and `extent: 'parent'`; the
group node is non-connectable and rendered behind its children. The domain still stores absolute
component positions and the persisted group boundary. Drag handlers translate visual parent/child
positions back into domain coordinates at the end of a drag.

**Rationale:** Current React Flow documentation describes `parentId` for parent-child subflows,
relative child positions, `extent: 'parent'` for constraining child movement, and a parent-before-
children ordering requirement. It also exposes an absolute position for adapting child movement.
Using those facilities gives the UI natural group dragging while keeping React Flow out of the
serialized artifact model. See the [React Flow subflow documentation](https://github.com/xyflow/xyflow/blob/main/_autodocs/system-core.md).

**Alternatives considered:** Persisting raw React Flow nodes was rejected because it would couple
architecture data to a visual library and weaken stable-reference guarantees. A purely decorative
rectangle overlay was rejected because it would not provide parent movement, bounded member drag,
or durable membership semantics.

## Decision: Preserve positions, constrain members, and make removal explicit

**Decision:** Group creation computes a padded boundary around the selected systems without changing
their existing positions. Subsequent member movement or resizing is constrained so the rendered member
remains inside the persisted boundary; the system never auto-arranges a member or silently changes its
membership. The group inspector provides an explicit `Remove from group` action that preserves the
component's absolute position and all references. Group layout validation never permits a persisted
boundary smaller than its member geometry plus the label/padding insets.

**Rationale:** This satisfies the requirement that a member remain enclosed while avoiding accidental
membership deletion or surprising creation-time movement. Persisting the resulting boundary makes
reopen deterministic and allows a group to move as one unit while preserving relative positions.

**Alternatives considered:** Automatically removing a member that crosses the edge was rejected as
silent data loss. Automatically deleting a group when it falls below two members was rejected because
it would make a layout edit destructive. Allowing unrestricted child movement was rejected because it
would produce a boundary that no longer communicates the intended system scope.

## Decision: Reuse the complete diagram save contract rather than add group CRUD endpoints

**Decision:** Extend the existing `GET /api/diagrams/{diagramId}` and `PUT /api/diagrams/{diagramId}`
document contracts with `groups`. Group create, rename, member removal, layout changes, and ungroup
are local Zustand edits recorded in the existing history and persisted together with components and
relationships in one transaction. The input accepts a missing `groups` property as an empty array
for backwards compatibility; responses always return `groups`.

**Rationale:** The current application already saves the complete validated document transactionally.
Adding per-group endpoints would duplicate save state, create partial-save failure cases, and add
complexity not required by the feature. Shared Zod validation and the backend service remain the
authoritative validation boundary.

**Alternatives considered:** Separate group CRUD endpoints were rejected because they would need a
second client draft/save protocol and would make group/component layout updates non-atomic. Client-
only groups were rejected because reopen and future multi-user support require backend persistence.

## Decision: Represent groups semantically in Mermaid with `subgraph`

**Decision:** Extend the current Mermaid exporter to emit system groups as Mermaid `subgraph`
sections, placing each member system inside its group and leaving ungrouped components at the
top level. Render `person` with a person-distinguishing node shape and `software-system` with the
existing system node shape. Group UUIDs remain internal stable identifiers; exact canvas coordinates
and React Flow drag behavior are not promised by Mermaid. If a future export format cannot represent
groups, it must fail with an actionable group-specific validation message rather than omit the group.

**Rationale:** Mermaid subgraphs preserve the group name and membership sufficiently for a portable
architecture view while retaining all relationship endpoints. The existing exporter already rejects
unsafe text and validates every artifact before output, so group names and member references can use
the same boundary checks.

**Alternatives considered:** Silently exporting only member nodes was rejected because it loses the
larger-system meaning. Rejecting every Mermaid export containing groups was rejected because Mermaid
can express a useful semantic boundary even though it cannot preserve pixel positions.

## Decision: Apply the existing Apple-style design system to the new controls

**Decision:** Use the existing workspace surfaces and tokens from `DESIGN.md`: near-black diagram
canvas (`#272729`), white component surfaces, the single Action Blue (`#0066cc`) for interactive
controls, Focus Blue (`#0071e3`) for focus rings, readable near-black/white text, 1px hairlines,
44px minimum targets, and 8/12/17/24/32px spacing rhythm. Render group boundaries flat, labeled, and
without a decorative shadow or gradient; use a line treatment and text label so membership is not
communicated by color alone.

**Rationale:** The current UI already follows these conventions, and extending the existing inspector,
toolbar, focus behavior, and confirmation dialog keeps the feature accessible and visually coherent.

**Alternatives considered:** Adding a second accent color or a card-shadow hierarchy was rejected by
the design guidance. A color-only distinction for Person, Software System, and group boundaries was
rejected because it fails the accessibility requirement.
