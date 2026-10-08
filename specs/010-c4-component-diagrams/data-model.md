# Data Model: C4 Component Diagrams

**Date**: 2026-10-08 | **Spec**: [spec.md](spec.md) | **REST**: [openapi.json](contracts/openapi.json)

## Diagram variants and ComponentScope

DiagramKind becomes `general | container | component`. General remains the Context-level diagram, including missing-kind legacy documents. Existing ContainerScope is unchanged. Component documents require ComponentScope, a boundary and `groups: []`; common UUID/name/status/timestamp fields remain.

| Scope field | Meaning and authority |
| --- | --- |
| parentDiagramId | Immediate Container diagram UUID; persisted in existing parent column, immutable |
| containerId | Internal Application/Datastore owner UUID in that parent; existing owner column, immutable |
| parentDiagramName | Resolved Container title from its Software System owner |
| containerName, containerDescription, containerTechnology, containerType | Current owning container metadata and application/datastore subtype; derived |
| systemContextDiagramId | Parent Container's general ancestor UUID; derived |
| softwareSystemId, softwareSystemName | Ancestor owning Software System identity/name; derived |

Persist only immediate parent/owner and boundary layout, not redundant ancestor/display names. Child name follows containerName without read-time writes/timestamp changes. Saves rehydrate metadata from locked sources and reject identity reassignment. Summary fields expose kind and the corresponding scope, not full contents.

## Element variants

All elements retain UUID id/diagramId, name, description, type, role, subtype, technology, sourceComponentId, position/size and timestamps. Scoped names are trimmed/nonblank up to 200 characters; required descriptions/technologies are nonblank; technology is at most 200 characters. Positions are finite; dimensions positive finite.

| Diagram/role | type | containerType | technology | sourceComponentId |
| --- | --- | --- | --- | --- |
| General element | Existing Person/System/legacy type | null | null | null |
| Container internal container | container | application/datastore | Required | null |
| Container external | person/software-system | null | null | General source UUID |
| Component internal component | component | null | Required | null |
| Component external sibling container | container | Source subtype | Source technology | Immediate sibling container UUID |
| Component external Person/System | person/software-system | null | null | Immediate Container external occurrence UUID |

C4 Components describe related functionality behind an interface inside the owner, not deployable containers or Code diagrams. Supporting metadata is read-only in the child and resolved from sources on load/refresh/save/export.

### Source chains and candidates

A sibling container's immediate and canonical source IDs coincide; authoritative editing occurs in the parent Container. For Person/System the path is Component occurrence → Container external occurrence → General element. Retain the immediate UUID; derive canonicalSourceComponentId and sourceDiagramId (authoritative editing diagram) by bounded validated resolution. The child depends on both source rows.

Removing the parent Container occurrence is blocked while active or recoverable children use it, even if the Context source still exists. Never flatten or automatically retarget. Each child permits one occurrence per canonical source; SQL additionally enforces immediate-source uniqueness. Owner inclusion, unsupported types, wrong-level chains and cycles are invalid. Occurrence role/source identities are immutable.

ComponentContext has scope, capturedAt and candidates carrying immediate id, name/description/type/containerType/technology, canonicalSourceComponentId and sourceDiagramId. Candidates exclude the owner, can be selected without a preexisting interaction, and copy neither relationships nor ADRs.

## Boundary, relationships and ADRs

Reuse boundary position/size storage and fitting; initial (0,0), 480×320. Match existing 24-unit side/bottom clearance, 68-unit top inset and supporting clearance of 24 units. Fit/displace as one history edit. Boundary is not a persisted component or ADR/relationship endpoint.

Relationships keep UUIDs and local stable endpoints, directed direction, a required nonblank label, nullable protocol up to 200 characters and existing timestamps. Both endpoints belong to the document and differ; at least one is internal Component. Supporting-to-supporting and boundary links fail.

ADR/link tables remain unchanged. Local links target the exact child occurrence/component/relationship UUID, never substituted canonical source IDs. Existing lifecycle/replacement/count rules apply without inherited decisions. Bounded history and timestamps remain; blocked owner/source undo preserves current document and history cursor.

## PostgreSQL migration

Plan forward `backend/drizzle/0007_c4_component_diagrams.sql`; do not edit applied 0005/0006. No new columns or backfill.

1. Widen diagrams_kind_check to general/container/component.
2. Widen diagrams_container_scope_check for both child kinds: nonnull parent/owner/boundary, parent distinct from child, explicit nonnull finite coordinates and positive finite sizes; general scope columns stay null.
3. Widen components_c4_role_check to the variants above with explicit nonnull required type/subtype/metadata. Preserve legacy general types.
4. Preserve owner unique across trash, composite owner-parent FK, source FK, component identity uniqueness, occurrence unique and parent/source/trash indexes.
5. Reconcile Drizzle declarations with existing SQL's parent/trash-root/composite FKs so future generated changes retain them.

Cross-row level matching, source eligibility/canonical uniqueness, bounded acyclicity and ancestor activity are service checks under locks. Preserve stable upsert/diff saves instead of delete/reinsert. Compatibility fixtures preserve UUIDs, timestamps, types/subtypes, geometry, relationships, ADR links and earlier trash provenance.

## Graph coordination and lifecycle

Resolve highest general ancestor; lock it first, rediscover membership, then affected descendants ancestor-first with UUID sorting at equal depth. Diagram/ADR writes and consistent export reads share one transaction/lock protocol. Unrelated roots remain independent.

| Operation | Preconditions/result |
| --- | --- |
| First create/open | Active ancestors and saved internal owner; unique child, empty boundary |
| Reopen | Same canonical identity; existing content, no name-projection writes |
| Entry to trashed child | RESTORE_REQUIRED; preserve recoverable owner uniqueness |
| Save | Active chain, valid immutable scope/status/source and dependencies; same child, normalized name |
| Protected removal/reclassification | Active or trashed child/occurrence; DIAGRAM_DEPENDENCY with corrective action, unchanged data |
| Application↔Datastore | Owner remains eligible; preserve child |
| Trash ancestor | Exact confirmed active descendant set, one batch/root, atomic |
| Restore | Confirm current IDs/batch, activate ancestor-first, validate entire result, atomic |

Restore walks to the highest required inactive ancestor and previews its exact existing batch. Earlier independent batches remain separate. requestedDiagramIncluded=false explains a requested child requiring a subsequent explicit restore after ancestor activation. Stale impact/batch forces re-preview; failed validation rolls back.

## Export source and draft state

Browser source membership: Context includes active Container/Component descendants; Container includes active Component children; Component alone. Read omitted ancestors for validation/context, never package navigation.

Retain entryDiagramId, sourceCapturedAt, diagram/ADR members and existing Container availability; add Component availability and keyed sourceContexts for kind-specific scoped metadata, replacing the singleton containerContext. The coordinated client/API DTO change preserves route/member/entry fields. Detached results release locks before rendering/compression.

Existing UUID-keyed retained draft overrides apply only to included saved members, without changing identity/ownership/membership. Reconcile ancestor-driven metadata in hierarchy order; omitted ancestors use validated source snapshots. No invented drafts, implicit saves, silent source repairs or incomplete packages.
