# Feature Specification: Add Existing Component to Group

**Feature Branch**: `006-add-component-to-group`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "The user should be able to add an exisiting component to an exisiting group. One way is to be able to select a group then \"shift\" to select a exisiting component and add it into the group. If the component selected is already part of the group, inform the user that he cant do it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add an existing component to a group (Priority: P1)

An architecture author can select an existing group and Shift-select an existing eligible component to add that component to the group. The group boundary updates to include the new member while the component remains the same architecture artifact.

**Why this priority**: Adding an existing component lets authors refine group boundaries as their understanding of a system evolves without deleting and recreating components or groups.

**Independent Test**: Open a diagram containing an existing group and an eligible component outside it, select the group, Shift-select the component, and verify that the component appears as a member of the group after the action is completed.

**Acceptance Scenarios**:

1. **Given** a diagram contains an existing group and an eligible component that is not in any group, **When** the author selects the group and Shift-selects the component, **Then** the interface clearly identifies both selections and offers the action to add the component to the selected group.
2. **Given** the author confirms the add-member action, **When** the action succeeds, **Then** the component becomes a member of the selected group, the group boundary encloses all members with visible spacing, and the component's name, identity, position, relationships, and ADR links remain intact.
3. **Given** a valid component has been added to a group, **When** the author saves and reopens the diagram, **Then** the membership and boundary are restored.

---

### User Story 2 - Explain duplicate or conflicting membership (Priority: P1)

An architecture author receives clear feedback when the selected component cannot be added because it is already a member of the selected group or already belongs to another group. The attempted action does not create duplicate membership or change existing group data.

**Why this priority**: Clear feedback prevents authors from thinking an add operation succeeded when the architecture data must remain unchanged, and it protects the one-group-per-component rule.

**Independent Test**: Try to add a component that is already in the selected group, then try to add a component belonging to a different group, and verify that each attempt is rejected with an explanation and no membership mutation.

**Acceptance Scenarios**:

1. **Given** the selected component is already a member of the selected group, **When** the author attempts to add it, **Then** the interface tells the author that the component is already in that group, does not add a duplicate membership, and leaves the group boundary and other data unchanged.
2. **Given** the selected component belongs to a different group, **When** the author attempts to add it to the selected group, **Then** the interface explains that the component already belongs to the named group and cannot be added to a second group, and both groups remain unchanged.
3. **Given** the author cancels the multi-selection or selects an invalid target, **When** the add-member action is not completed, **Then** no membership, position, or group-boundary data changes.

### Edge Cases

- The selected component is already in the selected group; the action is rejected as a duplicate and the message identifies the selected group.
- The selected component is in another group; the action is rejected and the message identifies the component's current group.
- The selected item is another group, a component type that is not eligible for system-group membership, or an item from another diagram; the action is unavailable or rejected with an actionable explanation.
- The group or component is deleted or changed by the time the author completes the selection; the action is rejected safely and the current diagram remains valid.
- The component lies far outside the current group boundary; the group expands or repositions to enclose it with consistent spacing without moving the component unexpectedly.
- The author uses keyboard navigation or cancels before confirming; selection feedback is understandable and no partial membership is persisted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an author to select an existing group and then use Shift-selection to select an existing eligible component for addition to that group.
- **FR-002**: The system MUST clearly distinguish the selected group, the component selected for addition, and the current membership state before the author confirms the action.
- **FR-003**: The system MUST provide an explicit add-member action or equivalent confirmation after the group and component are selected, and MUST show a clear success state when the membership is added.
- **FR-004**: A successful add-member action MUST add the component's stable identity to the selected group's membership without creating a new component or changing the component's name, identity, position, relationships, or ADR links.
- **FR-005**: After a successful addition, the system MUST update the group boundary so that it encloses every member with consistent visible spacing, including the newly added component.
- **FR-006**: The system MUST reject an add-member attempt when the selected component is already a member of the selected group, MUST tell the author that it cannot be added again, and MUST leave the existing membership and boundary unchanged.
- **FR-007**: The system MUST reject an add-member attempt when the selected component belongs to another group, MUST identify the existing group in the feedback, and MUST leave both groups unchanged.
- **FR-008**: The system MUST reject or disable add-member actions for groups, ineligible component types, missing items, or items from another diagram, with an actionable explanation and no partial mutation.
- **FR-009**: Membership changes MUST remain tied to stable group and component identities and MUST persist after the diagram is saved and reopened.
- **FR-010**: The add-member action MUST participate in the existing diagram edit history so the author can undo and redo a completed membership change without losing unrelated edits.
- **FR-011**: The workflow MUST provide keyboard-accessible selection, confirmation, cancellation, and feedback with readable labels and sufficient non-color selection cues.

### Key Entities

- **Existing Group**: A saved named boundary with a stable identity and a set of member component identities.
- **Existing Component**: A saved architecture element with a stable identity that may be added to a compatible group without being recreated.
- **Group Membership**: The durable association between one existing group and one existing component; a component belongs to zero or one group in this feature.
- **Transient Add Selection**: The temporary UI state representing the selected group and Shift-selected component before the author confirms or cancels the add action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability validation, at least 90% of authors can add an eligible existing component to an existing group on their first attempt in under 30 seconds.
- **SC-002**: In 100% of valid-addition tests, the group contains the selected component after confirmation and its boundary encloses every member with visible spacing.
- **SC-003**: In 100% of duplicate-membership tests, the author receives an explanation that the component is already in the selected group, no duplicate membership is created, and no unrelated data changes.
- **SC-004**: In 100% of conflicting-membership tests, the author receives an explanation naming the component's existing group, and both the existing and target groups remain unchanged.
- **SC-005**: In 100% of save-and-reopen tests, the added membership and all pre-existing component relationships and ADR links remain associated with the same stable identities.
- **SC-006**: At least 90% of authors can identify the selected group, selected component, successful add state, and rejection reason without relying on color alone.

## Assumptions

- Existing groups are already valid and contain at least two compatible components before this feature is used.
- Only eligible existing components from the current diagram can be added; nested groups and components shared by multiple groups remain out of scope.
- A component already in the selected group is a no-op error, while a component in another group is rejected to preserve the existing one-group-per-component rule.
- The add workflow uses the existing diagram save, selection, edit-history, and feedback patterns; it does not introduce authentication, permissions, collaboration, or a separate membership-management area.
- Adding a component does not automatically rearrange the component or other members; only the group boundary may expand or reposition to fit the current member bounds.
- Existing stable IDs are the source of membership, relationship, and ADR-link integrity; names and screen positions are not used as references.
