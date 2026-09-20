# Implementation Plan: Add Existing Component to Group

**Branch**: 006-add-component-to-group | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from /specs/006-add-component-to-group/spec.md

## Summary

Extend the existing system-group editor so an author can select a saved group, Shift-select
another saved component, review the proposed membership, and commit the component into the group.
The change will use the existing document model, bounded diagram history, group-boundary fitting,
and complete-document save. Shared validation will reject duplicate or conflicting membership
before any document mutation, while the existing API and database representation will persist the
new stable component-to-group association without a new endpoint or migration.

## Technical Context

**Language/Version**: TypeScript with React 19 and Node.js

**Primary Dependencies**: Vite, @xyflow/react, Zustand, Fastify, Drizzle ORM, Zod, Vitest, and Playwright

**Storage**: Existing PostgreSQL system_groups and system_group_members tables through the current
complete-document PUT flow; no schema migration is required.

**Testing**: Vitest for shared invariants, frontend store/history, adapter, and UI contracts;
Playwright for the end-to-end selection, feedback, save/reopen, and accessibility workflow.

**Target Platform**: Browser-based single-user diagram editor on the existing desktop and responsive
workspace layouts.

**Project Type**: React frontend with a Fastify REST API and shared TypeScript domain package.

**Performance Goals**: A valid add-member action updates the local diagram state in the same
interaction, performs no per-member network requests, and continues to use the existing single
complete-document save request.

**Constraints**: Preserve stable UUIDs, absolute domain-owned component positions, existing
relationships and ADR links, one-group-per-component membership, bounded undo/redo, atomic save
validation, Shift-based selection semantics, accessible feedback, and the current DESIGN.md visual
system. Do not add authentication, collaboration, nested groups, or a separate membership API.

**Scale/Scope**: Existing single-user diagrams and the current group size expectations. This feature
adds one existing component at a time to one existing non-nested group; bulk membership editing and
cross-diagram membership are out of scope.

## Constitution Check

- **I. Architecture Is a Linked, Versioned Artifact**: PASS. Membership changes reference existing
  stable group and component IDs, remain in the diagram document, and are recorded by existing
  bounded history and save behavior. Relationships and ADR links remain component-based.
- **II. Decisions Are First-Class and Explainable**: PASS. The feature does not alter ADR records or
  their links; it preserves the component identities those records reference.
- **III. User Actions Must Protect Architectural Data**: PASS. Invalid additions are rejected before
  mutation, failed saves preserve the draft, and cancellation/duplicate/conflicting attempts are
  no-ops.
- **IV. Quality Is Verified at the Artifact Boundary**: PASS. Shared, store, UI, persistence/API,
  adapter, and Playwright coverage are specified for valid additions, invalid additions, layout,
  history, persistence, and reference integrity.
- **V. Simplicity and Accessibility Guide the Product**: PASS. The design reuses the existing
  Shift-selection and group-details surfaces, adds no new subsystem, and requires keyboard-reachable
  actions, readable labels, live feedback, and non-color selection cues.

No constitution violations require justification.

## Project Structure

### Documentation for this feature

specs/006-add-component-to-group/

- plan.md
- research.md
- data-model.md
- quickstart.md
- contracts/openapi.yaml
- checklists/requirements.md
- tasks.md (created by speckit-tasks, not by this plan)

### Source code and tests

shared/

- src/domain/invariants.ts
- src/domain/group-layout.ts
- src/domain/types.ts
- tests/c4-system-groups.test.ts

frontend/

- src/state/diagram-store.ts
- src/components/DiagramCanvas.tsx
- src/components/DiagramWorkspace.tsx
- src/components/WorkspaceInspector.tsx
- src/components/ComponentNode.tsx
- src/components/SystemGroupNode.tsx
- src/styles.css
- tests/system-group-store.test.ts
- tests/react-flow-groups.test.ts
- tests/system-group-ui.test.tsx
- tests/system-group-recovery.test.tsx

backend/

- src/services/diagram-service.ts
- src/persistence/diagram-repository.ts
- tests/contract/system-groups.test.ts
- tests/persistence/system-groups.test.ts

e2e/

- tests/add-component-to-group.spec.ts

## Structure Decision

Use the existing three-part web application structure. Shared domain and layout helpers remain
independent of React Flow. The frontend owns transient selection and user interaction state; its
store mutates the shared-shaped DiagramDocument through the existing history wrapper. The backend
continues to validate and persist complete documents transactionally. The API contract documents
the existing PUT behavior for this additive membership change rather than introducing a new route.

## Phase 0 Research Decisions

The resolved design decisions and alternatives are recorded in [research.md](./research.md).
No unresolved clarification items remain.

## Design Details

### Domain validation and document mutation

1. Add a pure group-member-add validation path alongside the existing group invariants. It must
   distinguish missing group or component, non-Software-System component, component already in the
   target group, and component already in a different group.
2. Add a diagram-store action such as addGroupMember(groupId, componentId). It validates first,
   appends the existing component ID exactly once, recalculates the group boundary from the current
   member positions, updates only the group membership/layout metadata, and pushes one history
   entry.
3. Failed validation must set actionable group feedback without changing the document, save status,
   or undo/redo stacks. A successful action marks the document unsaved and clears stale group errors.
4. The component's name, type, stable ID, absolute position, relationships, and ADR links remain
   unchanged. The group ID and group creation timestamp remain unchanged; only membership, fitted
   layout, and update timestamp may change.

### Selection and interaction state

1. Extend the transient canvas-selection model with a compound group-member-add selection carrying
   groupId and componentId. Keep ordinary component selection and the existing multi-component
   group-creation selection separate.
2. When a group is selected in the normal canvas mode, Shift-selecting a component creates the
   compound candidate state instead of entering group creation mode. The group remains visibly
   selected and the candidate component receives the existing non-color selection cue.
3. Keep the existing group-creation path unchanged: when the group form is active, component
   selection remains the temporary list used to create a new group. Pane click, cancellation, a
   normal click, diagram switch, and successful completion clear or reduce the transient candidate
   state according to the existing selection conventions.
4. The group details inspector will explain the Shift-select interaction, show the candidate
   component, expose an Add component to group action, and retain existing rename, remove-member,
   and ungroup actions. On success it should keep the group selected and show a live confirmation.
5. Duplicate and conflicting candidates should expose feedback before mutation. The duplicate
   message must state that the component is already in the selected group. The conflicting message
   must identify the component's current group and state that a component cannot belong to a second
   group. Invalid candidates must disable or reject the action with an actionable live message.

### Rendering and layout

1. Reuse fitGroupBoundsAfterLayout with the existing member-box defaults for the membership
   mutation. The new component remains at its existing absolute position; the group expands or
   repositions around all members with the established padding.
2. Let the existing React Flow adapter consume the updated domain document. After success, the
   component becomes a child of the existing group node with a relative visual position while the
   persisted domain position remains absolute. No React Flow node identity or relationship endpoint
   changes.
3. Preserve DESIGN.md rules: dashed group boundaries, reserved group header, Action Blue for
   selected/focused states, non-color selection cues, 44px controls, readable live feedback, and
   existing responsive inspector behavior.

### Persistence and API boundary

1. Reuse PUT /api/diagrams/{diagramId} with the complete document. The client sends the existing
   group with one additional component ID and the fitted position/size.
2. Keep current Zod document validation and assertDiagramInvariants as the server-side final guard.
   Duplicate member IDs, cross-group membership, missing items, wrong diagram IDs, non-Software
   System members, and invalid boundaries must return the existing actionable 422 validation shape
   without replacing stored data.
3. Keep the current repository transaction and system_group_members primary key/indexes. The
   existing replacement path already preserves group/component IDs and replaces membership rows
   atomically; no endpoint or SQL migration is needed.

### Verification strategy

- Shared domain tests cover valid candidate addition, same-group duplicate, different-group
  conflict, ineligible/missing candidates, fitted bounds, and unchanged relationship/reference
  data.
- Frontend store tests cover successful membership, no-op errors, one history entry, undo/redo,
  persistence payload shape, and unchanged unrelated fields.
- Adapter and UI contract tests cover group-plus-candidate rendering, stable parent/relative
  position conversion, accessible labels, live alerts, keyboard-reachable controls, and the
  separation from new-group selection.
- Backend contract and persistence tests cover a PUT with an additional member, normalized
  round-trip, invalid replacement immutability, and stable membership rows/IDs.
- Playwright covers valid addition, boundary enclosure, save/reopen, duplicate feedback,
  cross-group feedback, cancel/no-op behavior, and keyboard-accessible confirmation.

## Post-Design Constitution Check

- Stable group/component identities, relationship endpoints, and ADR component links remain
  unchanged: PASS.
- The domain mutation is independent of React Flow and the adapter only translates the updated
  document: PASS.
- Duplicate, conflicting, missing, and invalid candidates do not mutate local or persisted
  artifacts; save failures retain the draft for retry: PASS.
- The API/database boundary remains atomic and the quickstart/test plan covers the persisted
  artifact contract: PASS.
- The interaction reuses current surfaces and explicitly covers keyboard access, readable feedback,
  contrast, and non-color selection cues: PASS.

## Complexity Tracking

No violations. The feature adds one store action, one compound transient selection state, and
focused validation/test coverage on top of the existing group artifact and complete-document save
flow.
