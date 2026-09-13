# Implementation Plan: C4 System Groups

**Branch**: `003-c4-system-groups` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-c4-system-groups/spec.md`

## Summary

Extend the existing architecture diagram document with validated C4 system-context artifact types
and durable, non-nested system groups. The existing nullable component `type` field becomes the
canonical `person` / `software-system` classification for new components, while legacy unclassified
components remain readable. A group is a first-class domain artifact with a stable UUID, a name that
is unique per diagram after trimming and case-insensitive comparison, Software System member UUIDs,
and persisted boundary layout. PostgreSQL stores groups and normalized
membership rows in an additive migration, and the existing complete-document save remains the atomic
REST boundary.

The frontend will extend the current Zustand history and inspector workflow with C4 type selection,
multi-selection, group creation, group movement, member review/removal, rename, and confirmed
ungrouping. During grouping selection, every selected component will have a visible, non-color-only
selection state; incompatible selections will be blocked from group creation with a human-readable
explanation naming the artifact types and violated rule. React Flow will render each group as a
parent subflow node behind its children, but the shared domain remains authoritative and stores
absolute component positions. Relationships and ADR links continue to target component UUIDs
unchanged. Mermaid export will represent groups as semantic `subgraph` sections and will reject any
future unsupported group representation with an actionable group-specific error.

## Technical Context

**Language/Version**: TypeScript 5.8 strict mode; React 19.1; Node.js current LTS runtime; Vite 7

**Primary Dependencies**: React + Vite, `@xyflow/react` 12.8, Zustand 5, Zod 3.25, Fastify 5.4,
Drizzle ORM 0.44, PostgreSQL via `pg` 8.16, OpenAPI 3.0.3, Vitest 3.2, and Playwright 1.54,
matching the repository manifests and AGENTS.md technology stack

**Storage**: PostgreSQL through Drizzle. Reuse `components.type` for the canonical C4 artifact type;
add `system_groups` and `system_group_members` in additive migration `backend/drizzle/0003_system_groups.sql`.
Persist groups, members, boundary layout, and timestamps as normalized structured data.

**Testing**: Vitest for shared C4 type/group schemas and invariants, Mermaid group export, in-memory
and PostgreSQL group persistence, service validation, API/OpenAPI contract behavior, Zustand group
history, and React Flow adapter geometry. Playwright for create/type-display/group/create-move-
rename-member-removal/ungroup/save-reopen/export/error/accessibility workflows, including selected-
state highlighting and explanations for incompatible Person/Software System selections.

**Target Platform**: Modern desktop browser for the React frontend; static Vite hosting;
containerized Fastify API; managed PostgreSQL.

**Project Type**: Existing browser-based, single-user web application with a REST backend. No
authentication, permissions, workspaces, collaboration, offline storage migration, or advanced
revision history is introduced by this feature.

**Performance Goals**: Maintain interactive diagram editing near 60 fps for ordinary diagrams and
group dragging. Group creation and layout reconciliation should remain local and immediate for the
specified two-to-twenty system scenario. Complete save/reopen/export feedback remains visible within
the existing three-second representative workflow target.

**Constraints**: The domain model is authoritative and independent of React Flow. Groups are
non-nested and each component belongs to at most one group. Only Software System components may be
members. Group creation fits the boundary around selected systems without rearranging their existing
positions. Member movement may extend beyond the current boundary; the boundary automatically
resizes or repositions to fit all members with visible spacing, while membership changes happen
through an explicit removal action. Group deletion/ungrouping must preserve members, relationships,
and ADR links. Existing component, relationship, and ADR IDs must not change during type, name, position,
group, or layout edits. Grouping selection is transient UI state: every selected component must be
visibly distinguishable, and an ineligible or incompatible selection must be explained rather than
silently ignored. Invalid groups and unsupported C4 values must produce actionable validation without
partial mutation or silent export loss.

**Scale/Scope**: One active diagram at a time for one user; two supported C4 system-context types;
groups of two or more systems, with the success scenario covering two to twenty members; no nested
groups, group-to-group relationships, group ADR links, C4 container/component/code levels, or group
search/bulk editing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Architecture is a linked, versioned artifact - PASS**: Components, relationships, ADR links,
  and new system groups use stable UUIDs. Group membership references component IDs rather than names
  or screen positions. Existing timestamps and session history remain compatible with a future
  revision table.
- **II. Decisions are first-class and explainable - PASS / N/A for new ADR creation**: The feature
  does not add an incomplete ADR model. It preserves component identities and existing ADR links
  while grouping adds context around those same architecture elements.
- **III. User actions protect architectural data - PASS**: Ungrouping and removing a group require
  confirmation, preserve members and references, component deletion is blocked by group membership,
  and invalid save/export content is surfaced without silent loss.
- **IV. Artifact-boundary quality - PASS**: Shared validation, normalized persistence, REST contract,
  React Flow conversion, Mermaid export, stable-reference checks, rendering, accessibility, and
  Playwright workflows are all included in the design.
- **V. Simplicity and accessibility - PASS**: The feature extends the existing inspector, toolbar,
  confirmation dialog, Zustand history, and design tokens. It uses keyboard-selectable controls,
  text labels, visible selection and error/status feedback, focus treatment, and non-color-only
  group/type/selection cues.
- **Delivery and quality gates - PASS**: Affected artifact types, migration/reference implications,
  API behavior, design-system constraints, and validation scenarios are specified in the Phase 0/1
  artifacts below.

## Project Structure

### Documentation (this feature)

```text
specs/003-c4-system-groups/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                 # created later by $speckit-tasks
```

### Source Code (repository root)

```text
shared/
├── src/domain/types.ts          # C4 types, SystemGroup, DiagramDocument.groups
├── src/domain/invariants.ts     # group membership, names, layout, and reference rules
├── src/validation/schemas.ts    # C4 type and complete-document Zod validation
├── src/export/mermaid-export.ts # component shapes and group subgraphs
└── tests/                       # group domain, validation, compatibility, and export tests

backend/
├── drizzle/0003_system_groups.sql
├── src/persistence/schema.ts    # system groups and membership tables
├── src/persistence/diagram-repository.ts
├── src/services/diagram-service.ts
├── src/api/diagram-routes.ts    # existing complete-document contract and conflicts
└── tests/                       # repository, migration, service, API, and contract coverage

frontend/
├── src/state/diagram-store.ts   # C4 type and group edits with explicit history
├── src/adapters/react-flow/diagram-adapter.ts
├── src/components/DiagramCanvas.tsx
├── src/components/ComponentNode.tsx
├── src/components/SystemGroupNode.tsx
├── src/components/WorkspaceInspector.tsx
├── src/components/DiagramToolbar.tsx
├── src/styles.css
└── tests/                       # store, adapter, UI, and accessibility coverage

e2e/
└── tests/c4-system-groups.spec.ts
```

**Structure Decision**: Extend the existing `shared/`, `backend/`, `frontend/`, and `e2e/` boundaries.
The shared domain and Zod schemas own artifact shape and cross-reference rules; Fastify/Drizzle owns
transactional persistence and API validation; React/Vite owns the accessible editing workflow; and
React Flow remains a visual parent/child adapter. No new top-level package or subsystem is needed.

## Implementation Design

1. **Shared domain and validation**: Add `C4ArtifactType`, `SystemGroup`, `GroupBoundaryLayout`,
   and `DiagramDocument.groups` to `shared/src/domain/types.ts`. Keep `Component.type` nullable for
   legacy documents but define the supported new values as `person` and `software-system`. Extend
   `diagramDocumentSchema` with optional `groups` defaulting to `[]`; add group shape validation and
   field-addressable errors. Extend `assertDiagramInvariants` to enforce diagram ownership, stable
   UUIDs, unique group names after trimming and case-insensitive comparison, at least two unique
   Software System members, one-group-per-component, positive finite layout, and boundary containment
   after each group or member layout change.
   Keep relationships and ADR links component-based and unchanged.

2. **Persistence and service rules**: Add `systemGroups` and `systemGroupMembers` to
   `backend/src/persistence/schema.ts` and create `0003_system_groups.sql` with explicit indexes and
   non-cascading reference behavior. Update the in-memory and PostgreSQL diagram repositories to
   load groups deterministically, insert and replace group rows/members in the same transaction as
   components and relationships, preserve `createdAt`/IDs for existing groups, and return `groups: []`
   for older diagrams. Update `DiagramService` to validate complete documents before mutation and to
   return a group-aware dependency conflict when component deletion would leave membership rows.
   A group replacement may remove group rows only after the document validation succeeds, so ungroup
   cannot delete component, relationship, or ADR data.

3. **REST contract**: Expand the existing complete-document GET/PUT contract with `groups`, canonical
   C4 `type` values, `SystemGroup`, positions, sizes, and `minItems: 2` member lists. Keep omitted
   input groups backwards-compatible as an empty list and always return the field. Reuse the existing
   422 validation error with paths such as `groups[0].memberComponentIds`; validation messages and
   field details identify incompatible artifact types and explain the grouping rule. Keep the
   existing save boundary rather than adding group CRUD endpoints. Extend component-removal conflicts
   with the blocking group IDs. Document Mermaid export as emitting semantic subgraphs rather than
   exact canvas geometry.

4. **State and editing workflow**: Extend `frontend/src/state/diagram-store.ts` so `addComponent`
   requires a C4 type and group actions (`createGroup`, `renameGroup`, `moveGroup`, `removeGroupMember`,
   `ungroup`) use the existing `update`/bounded history path. Keep grouping selection IDs transient
   to the editor rather than in the document. Group creation validates selection, member types,
   minimum count, and a name unique after trimming and case-insensitive comparison before adding a
   UUID and calculating a padded boundary around the members' current positions. Every selected
   component receives visible selection feedback; an ineligible or incompatible selection is not
   silently filtered and the group action reports the artifact types and violated rule without
   mutating the document. Creation must not auto-arrange selected systems. Moving a group translates
   member absolute positions by the same delta. Member movement is reconciled by recomputing a padded
   group boundary around all rendered member boxes, allowing the boundary to expand or shift rather
   than clamping the member to the prior boundary; membership changes happen only through the explicit
   removal action.
   Member removal preserves its position; ungroup removes only group state. Type/name/layout/group
   edits set the document unsaved and retain the same component, relationship, and ADR IDs. Failed
   saves leave the draft and history unchanged, while a successful save replaces it with the server
   response.

5. **React Flow adapter and canvas**: Extend `toReactFlow` to calculate group nodes first, with a
   custom `systemGroup` node, persisted absolute group position/size, stable group ID, no connection
   handles, and a lower visual layer. Emit group children after their parent using `parentId`,
   relative positions, `expandParent: true`, and type data. Do not use a permanent hard child clamp
   that prevents the member from crossing the current boundary. Extend the reverse adapter/drag
   handling to convert child absolute positions and group drag deltas back to domain positions, fit
   the group around all current member boxes after member drag/resize, and persist the resulting
   group position and size without silently removing membership. Update `DiagramCanvas` to
   support keyboard-usable multi-selection with an explicit selected-state highlight, group selection, group drag, member drag, and
   group-vs-relationship selection
   without changing edge endpoints. Add `SystemGroupNode` as a flat labeled boundary that is
   selectable but not connectable; add visible C4 type labels/shapes to `ComponentNode`.

6. **Inspector and visual system**: Add a C4 artifact-type fieldset to component creation with
   readable Person and Software System descriptions; cancel closes without creating a component.
   Show the same type field in selected-component review/edit and update the existing component in
   place; a grouped component cannot change from Software System until it is explicitly removed from
   the group. Add an `Unclassified` compatibility state for legacy null values.
   Add a `Group selected systems` action that keeps selected components visibly identified, reports
   why a selection is invalid (including the Person/Software System incompatibility), and then opens
   a group form showing selected members and name validation. Selection feedback is cleared on
   deselection, cancellation, and successful grouping. Add group details with member list, type labels,
   rename, `Remove from group`, and confirmed `Ungroup` actions. Reuse `ConfirmDialog`, status
   announcements, and selected-item conventions. Apply `DESIGN.md`: `#272729` canvas, white node
   surfaces, `#0066cc` Action Blue for controls, `#0071e3` focus rings, `#e0e0e0` hairlines,
   existing typography and spacing tokens, 44px targets, visible focus, active scale feedback, and
   no gradients or decorative group shadows. Boundary shape, label, and member spacing must make
   grouping understandable without color alone and remain usable in the existing responsive
   inspector layout.

7. **Mermaid export**: Update `shared/src/export/mermaid-export.ts` to validate groups before
   emitting output, escape group names with the same safe-text rules, render Person and Software
   System with distinguishable Mermaid node shapes, place grouped nodes in stable-ID `subgraph`
   blocks, and emit all relationships exactly once. Add group-specific export errors for invalid or
   unrepresentable content; never omit a group or member silently. The contract and UI should explain
   that Mermaid preserves semantic membership but not exact React Flow positions.

8. **Verification**: Add shared tests for supported/legacy C4 types, group validation, duplicate
   membership/name, cross-diagram/missing/non-system members, boundary containment, ungroup reference
   preservation, and Mermaid subgraphs. Add repository/service/API tests for migration round-trip,
   transactional replacement, empty groups compatibility, invalid-save immutability, and deletion
   conflicts. Add frontend tests for type display, group history/undo/redo, group drag delta,
   parent-before-child adapter output, automatic boundary expansion/repositioning after member
   movement, group selection highlighting,
   incompatible-selection explanations, confirmation, and accessible error/status labels. Add
   Playwright coverage for creating Person and Software System components, grouping two-to-twenty
   systems, identifying selected components, rejecting mixed Person/Software System selections with
   an explanation, moving/renaming/reviewing/removing/ungrouping, save/reopen identity and ADR
   preservation, Mermaid export, invalid actions, and keyboard/focus behavior.

## Post-design Constitution Re-check

**PASS**: The design stores groups and membership as structured, stable-ID architecture artifacts;
keeps all relationships and ADR links attached to component UUIDs; validates group ownership,
eligibility, uniqueness, layout, and non-nesting before persistence; uses an additive relational
migration and an atomic complete-document save; confirms ungrouping and blocks unsafe component
deletion; renders and exports group meaning without silent omission; provides non-color-only
selection feedback and explains incompatible artifact types before mutation; and verifies behavior
at shared, persistence, API, adapter, UI, accessibility, and end-to-end boundaries. It reuses the
existing three-boundary architecture and design system without adding authentication, collaboration,
offline storage, or a second save protocol.

## Complexity Tracking

No constitution violations require justification. The new normalized group/membership tables, group
adapter node, and multi-selection workflow are the minimum complexity needed to provide durable
membership, parent movement, reference integrity, and an accessible review/removal workflow.
