# Data Model: C4 Container Diagrams

**Feature**: [spec.md](./spec.md)

**Decisions**: [research.md](./research.md)

## Domain representation

The shared domain remains independent of React Flow. Existing diagram, component, relationship, ADR and link UUIDs remain stable. All coordinates are absolute diagram coordinates. API timestamps are ISO 8601 strings; PostgreSQL stores timestamptz.

### Diagram and scope

| Field | Shape | Rules |
| --- | --- | --- |
| id, name, status, createdAt, updatedAt, trashedAt | Existing diagram fields | Preserve IDs and original creation time. Name length 1–200 after trimming. |
| kind | general or container | Defaults to general only for legacy/general data. Immutable after creation. |
| scope | null or ContainerScope | Required for container; null for general. Ownership cannot be reassigned by PUT. |
| boundary | null or BoundaryLayout | Required for container, including empty children; null for general. |
| components, relationships, groups | Existing collections | Container documents require groups to be empty. |

**ContainerScope** contains:

- `parentDiagramId`: source general diagram UUID.
- `softwareSystemId`: owning parent component UUID.
- `parentDiagramName`, `softwareSystemName`, `softwareSystemDescription`: server-resolved display values, captured for review/export. Description may be null.
- A general parent and an ordinary element of type software-system are required. External occurrences resolve to that source, never become owners themselves.
- Parent/system display names follow the source on load/context refresh; child diagram name remains independently editable after its initial default.
- The owner association is unique across active and trashed children. A child cannot own another child through an internal container.

**BoundaryLayout**: position {x, y} and positive finite size {width, height}. It has no separate artifact ID. Its React Flow ID is synthesized from the child diagram UUID, excluded from component collections, and cannot be a relationship or ADR target.

### Component roles

Extend Component with `role` (element/container/external), `technology` (string or null) and `sourceComponentId` (UUID or null).

| Role | Diagram kind | Type and fields | Identity and layout |
| --- | --- | --- | --- |
| element | general | Existing nullable/free-form type remains readable; supported new writes use person/software-system. Technology and source are null. | Existing component UUID and behavior. |
| container | container | type container; nonblank name (max 200), responsibility in description, and technology (max 200); source null. | New local component UUID; inside system boundary. |
| external | container | Source is a parent element of type person/software-system; local technology null. Name, description and type are read-only source projections. | New local occurrence UUID, distinct from source UUID; local position/size outside boundary. |

An external occurrence references exactly one ordinary source element in the owning parent; source chains, other-parent sources, the owner itself, and duplicate (diagramId, sourceComponentId) pairs are invalid. Source Person/Software System reclassification is allowed when otherwise valid; source reclassification to an unsupported type is blocked while occurrences depend on it. An owner cannot change away from Software System while its child exists.

For existing database columns that require names, the server may maintain an external name/description/type cache on write. Every load/context/export resolves current source values; cache contents never override sources. Child PUT does not edit parent details. An existing occurrence's role and source reference are immutable: replace it explicitly using the normal dependency safeguards.

### Relationships

Keep existing relationship fields and UUIDs; add nullable `protocol` (max 200 characters after trimming).

- In general diagrams, retain current label/direction rules; protocol defaults to null.
- In container diagrams, direction is directed and label is nonblank; label describes the interaction.
- Endpoints reference local component UUIDs in the same diagram. At least one endpoint must have role container.
- Container-to-container and container-to-external connections are allowed in either direction. External-to-external connections, self-links, missing endpoints and boundary endpoints are invalid.
- Protocol is optional and, when provided, is displayed/exported with the interaction label.

### ADRs and links

No new ADR hierarchy or link table is required. Existing ADRs remain diagram-owned and use existing lifecycle states, replacement rules and timestamps. `adr_component_links` targets local container/occurrence component IDs; `adr_relationship_links` targets local relationship IDs. Parent ADRs are not inherited. All mutations verify that the ADR diagram and its source parent are active before writes, coordinated with the graph transaction.

### Resolved summaries and source context

Extend DiagramSummary with kind and nullable resolved scope (parentDiagramId, parentDiagramName, softwareSystemId, softwareSystemName, softwareSystemDescription). Creation/update dates keep their existing meaning. CLI and frontend shared response validation must retain these fields.

Container availability response: canonical parent/system IDs, availability none/active/trashed, and child summary or null. GET is read-only; POST create-or-open owns mutation.

Container context response: resolved scope, current eligible source elements with IDs/name/description/type, and capturedAt. It supplies the external picker and unsaved browser export. No source positions are needed; returned source metadata cannot be edited from the child.

### Trash provenance

Server-only `trashBatchId` and `trashRootDiagramId` are nullable UUID columns on diagrams. They are not client-writable document fields.

| Transition | Rule |
| --- | --- |
| Parent active → trashed | Under one graph transaction, mark root and its currently active direct children with a fresh common batch/root ID and trashedAt. |
| Child active → independently trashed | Fresh batch ID with the child's own ID as root. Keep parent active. |
| Parent trashed → active | Restore root and exactly the children carrying that batch/root marker. Preserve children trashed earlier. Clear restored markers. |
| Child trashed → active | Require active parent and valid owner/source references. Parent-cascade children cannot restore independently while parent is in trash. |
| Legacy trashed → active | Null provenance means a single-row restore unless feature children are associated; handle their own provenance explicitly. |

Restore preserves all artifact UUIDs, timestamps other than updatedAt/trashedAt, ADR content, links and layouts. Broken contextual references cause rollback with actionable failure.

## PostgreSQL migration design

Add `backend/drizzle/0005_c4_container_diagrams.sql` during implementation. It is additive and should be applied after migrations 0001–0004. No SQL migration is generated by this planning command.

### diagrams

- kind text/enum, NOT NULL, default general.
- parent_diagram_id nullable UUID referencing diagrams.id, restrictive deletion.
- owner_component_id nullable UUID; unique owner index across all statuses.
- scope_x, scope_y, scope_width, scope_height nullable doubles for boundary layout.
- trash_batch_id and trash_root_diagram_id nullable UUID; root references diagrams.id restrictively.
- Index parent_diagram_id and the trash root/batch pair.
- General kind requires ownership/boundary columns null; container kind requires them populated, with finite positive boundary dimensions.
- Add unique target (id, diagram_id) on components, then a composite owner FK (owner_component_id, parent_diagram_id) to that target to enforce owner membership. Contextual source type/role and active-state rules remain transactional service checks.

### components

- role text/enum NOT NULL default element.
- technology nullable varchar(200).
- source_component_id nullable UUID referencing components.id restrictively.
- Unique index (diagram_id, source_component_id); ordinary/internal null sources do not collide.
- Index source_component_id for dependency lookup.
- Local CHECKs enforce role-specific source/technology requirements and container type/description rules. Cross-row parent/source rules are checked under the graph lock.

### relationships

- protocol nullable varchar(200); no changes to existing UUID endpoints.
- Container-specific direction/label/endpoint-role validation occurs in shared invariants plus transaction contextual checks.

### Existing data and API compatibility

- Existing rows receive kind general, role element, null source/technology/protocol/provenance and no boundary. Legacy free-form types remain exactly as stored.
- Omitted new fields normalize only for general/legacy documents. A PUT of an existing container that omits its required scope/kind must fail; it must never demote it to general.
- Existing groups retain their representation and fitting rules. Container diagrams cannot contain SystemGroups.
- Reject unknown feature fields/kinds/roles on writes instead of stripping unrecognized architecture content. Server-derived display fields may be echoed but are resolved again.
- Existing creation timestamps are preserved. Source rename hydration does not manufacture a local edit or mutate parent layout.
- Existing PostgreSQL test cleanup must remove child occurrences/child diagrams before source components/parent rows because of restrictive new FKs.

## Validation layers and transactions

1. Shared structural schema: field shapes, UUIDs, finite dimensions and required text.
2. Shared pure invariants: roles per diagram kind, unique IDs, endpoints, boundary containment/external exclusion, empty groups for child, distinct owner/external semantics.
3. Contextual backend validation: canonical owner/source lookup, immutability, active state, source-parent membership, source metadata resolution and dependency blockers.
4. Repository transaction: lock source parent first; lock affected children in UUID order; reread; validate previous/incoming diff and ADR blockers; apply ID-preserving changes and return a resolved document. Failed writes roll back all rows.
5. Database constraints backstop ownership, source existence and duplicate associations.

A full-document PUT cannot bypass DELETE protections. Omitted ADR-linked artifacts or owner/source components return 409 blockers rather than dropping links. Valid new source/owner associations are never checked in a separate transaction from their insertion.

## Deterministic layout rule

- Empty boundary: x=0, y=0, width=480, height=320.
- With containers: union their rectangular bounds, expand by 24 units on left/right/bottom and reserve 24+44 units above. Retain a minimum 480 by 320 size.
- A boundary-affecting edit computes all layout effects once. Process overlapping external occurrences in UUID order, place each immediately to the right of the fitted boundary with 24-unit clearance, then advance vertically until it avoids other external rectangles.
- Directly moving/resizing an external occurrence so its rectangle intersects the boundary is rejected. Touching the boundary does not provide clearance; enforce the same 24-unit gap.
- Movement, resize, fitted boundary and displaced occurrences are one domain history snapshot. Undo/redo never rewrite IDs. Keyboard and pointer movements use the same command.
- Saved geometry that violates these rules is rejected with field-level errors rather than silently repaired at persistence/export.

## Dependency resolution

- Owner deletion/reclassification is blocked even if its child is trashed. No permanent deletion or ownership detachment is introduced; feedback instructs the author to keep the Software System or trash the parent diagram to hide the complete architecture recoverably.
- Source deletion is blocked until all its occurrences, including those in recoverable children, are explicitly removed after resolving ADR/relationship blockers. A trashed child must be restored before editing those occurrences.
- Container/occurrence removal checks local relationships and ADR links. Relationship removal checks ADR links.
- Confirmation preflight is informational. DELETE compares the confirmed affected-diagram ID set against the current set under lock and returns TRASH_IMPACT_CHANGED if it differs.
