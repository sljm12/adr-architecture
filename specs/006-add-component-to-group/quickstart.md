# Validation Quickstart

This guide validates adding an existing component to an existing group without changing
component identity, position, relationships, ADR links, or unrelated groups.

## Prerequisites

- Node.js and the repository dependencies are installed.
- The feature branch is based on `006-add-component-to-group` (the implementation branch may use a
  task-specific name such as `feature/spec-006-phase-4-5`).
- For browser validation, the frontend and backend can be started with npm run dev.

## Focused automated checks

Run the shared and frontend checks that cover the new domain action, layout, history, adapter, and
accessibility contracts:

    npx vitest run shared/tests/c4-system-groups.test.ts frontend/tests/system-group-store.test.ts frontend/tests/react-flow-groups.test.ts frontend/tests/system-group-ui.test.tsx frontend/tests/system-group-recovery.test.tsx

Run the API and persistence checks:

    npx vitest run backend/tests/contract/system-groups.test.ts backend/tests/persistence/system-groups.test.ts

Run the feature end-to-end workflow after its Playwright test is added:

    npm run test:e2e -- e2e/tests/add-component-to-group.spec.ts

## Manual browser validation

1. Start the application with npm run dev and open the diagram workspace.
2. Create one diagram and at least four Software System components.
3. Select two components with the existing Shift-based group-creation workflow and create
   Core systems. Create a second group from two other components named Support systems.
4. Plain-click Core systems, then Shift-click an ungrouped eligible component. Confirm that the
   group remains selected, the candidate is visibly identified, and the inspector offers an
   Add component to group action.
5. Confirm the action. Verify that the group member count increases, the boundary encloses all
   members with visible spacing, and the candidate's name, position, relationships, and ADR links
   remain attached to the same component.
6. Save, switch away, and reopen the diagram. Verify that the added membership and fitted boundary
   are restored.
7. Select the group and Shift-select one of its existing members. Verify an actionable message
   says the component is already in that group, no duplicate is created, and the group boundary
   does not change.
8. Select Core systems and Shift-select a member of Support systems. Verify the message names the
   current group and explains that the component cannot belong to a second group. Verify both
   groups remain unchanged.
9. Cancel a candidate selection and use Undo/Redo after a successful addition. Verify cancellation
   creates no draft change and Undo/Redo removes and reapplies only the membership and its fitted
   group layout.
10. Repeat the core flow with keyboard navigation and confirm that focus rings, labels, live
    success/error feedback, and 44px action targets remain usable without relying on color alone.

## Expected outcomes

- Valid additions are committed once and can be saved and reopened.
- Invalid, duplicate, conflicting, missing, and ineligible additions do not mutate the document.
- Stable component/group IDs, relationship endpoints, and ADR component links remain unchanged.
- The existing complete-document API contract returns 200 for valid documents and 422 with no
  replacement for invalid group membership, duplicate IDs, ineligible members, or invalid
  boundaries.
- A failed save leaves the added membership draft and undo/redo history available for retry.
- The relevant Vitest and Playwright checks pass.
