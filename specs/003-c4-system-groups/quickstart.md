# Quickstart Validation: C4 System Types and System Groups

## Prerequisites

- Node.js and npm installed.
- Dependencies installed with `npm install`.
- PostgreSQL available and `DATABASE_URL` configured for persistence tests.
- The existing database migrations applied in order, including
  `backend/drizzle/0003_system_groups.sql` after the prior diagram and ADR migrations.
- A diagram containing at least two components, and at least one saved component/relationship or
  ADR link when validating reference preservation.

## Validation commands

From the repository root:

```text
npm install
npm test
npm run build
npm run test:e2e
```

The REST shape is defined in [contracts/openapi.yaml](./contracts/openapi.yaml), and entities,
invariants, migration expectations, and compatibility behavior are defined in
[data-model.md](./data-model.md). The existing diagram GET/PUT save boundary is the only group
persistence API.

## Acceptance scenarios

1. **Create typed C4 components**: Open a new component form. Verify it offers Person and Software
   System with readable descriptions. Create one of each, verify the type is visible on the node and
   inspector, cancel another creation, and verify no component is added.
2. **Persist types**: Save, reopen, and verify each component keeps its same UUID, name, position, and
   C4 type. Verify a legacy component with a null type loads as Unclassified and cannot be grouped
   until it is edited to Software System.
3. **Create a valid group**: Select two or more Software System components with keyboard/multi-select,
   verify every selected component is visibly highlighted and remains distinguishable from unselected
   components, then choose `Group selected systems`, enter a non-blank unique name, and verify the
   labeled boundary is behind and visibly encloses every member. Confirm each selected system keeps
   its existing position while the boundary is fitted around them. Verify the selection feedback is
   cleared after completion. Repeat with two-to-twenty systems.
4. **Reject invalid groups**: Try fewer than two members, a mixed Person and Software System
   selection, an unclassified member, a blank/whitespace-only name, and a duplicate group name using
   capitalization or surrounding-space differences. For the mixed selection, verify the message names
   the incompatible artifact types and explains that a Person cannot be grouped with a Software
   System. Verify each action gives an actionable message, creates no partial group, and leaves the
   document unchanged.
5. **Move and fit members**: Move a group and verify every member moves by the same delta with
   relative positions and relationship endpoints unchanged. Drag or resize a member beyond each
   edge of the current boundary and verify the group automatically expands or repositions to enclose
   every member with visible spacing, without rearranging members. Move the member back toward the
   other systems and verify unused boundary space is readjusted. Verify the explicit `Remove from
   group` action removes membership without moving or deleting the component.
6. **Review and ungroup**: Select a group, review its name and complete member list, rename it, and
   confirm ungrouping. Verify the boundary and membership disappear while all member components,
   relationships, ADR links, IDs, and positions remain.
7. **Save and reopen integrity**: Save a diagram containing typed components, a group, relationships,
   and ADR links. Reopen it and verify group name, membership, layout, types, relationship endpoints,
   and ADR component references are byte-for-byte equivalent except for server-managed update times.
8. **Deletion protection**: Attempt to delete a grouped component. Verify the user receives a clear
   group-membership conflict and must remove membership or ungroup first. After explicit membership
   removal, verify ordinary component deletion still follows the existing relationship confirmation
   workflow.
9. **Mermaid export**: Export a grouped diagram and verify the source contains every component and
   relationship exactly once, emits each group as a labeled `subgraph`, distinguishes Person from
   Software System shapes, and does not claim to preserve exact canvas coordinates. Verify invalid
   group data produces a group-specific export error and no incomplete file.
10. **Failure and history behavior**: Simulate a failed group save. Verify the local group draft and
    undo/redo history remain available, the status is visibly failed/unsaved, and retry persists the
    unchanged draft. Undo/redo group creation, rename, member removal, and movement without changing
    stable component, relationship, or ADR IDs.
11. **Accessibility and responsive behavior**: Complete creation, selection, rename, member removal,
    ungroup confirmation, validation, and save/reopen with keyboard navigation. Verify selected-state
    highlighting, incompatibility explanations, labels, focus order, Escape/Tab dialog behavior,
    44px targets, visible focus, sufficient contrast, and text/shape cues that do not rely on color
    alone. Repeat with the responsive inspector layout.
