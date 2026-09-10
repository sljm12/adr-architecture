# Feature Specification: C4 System Groups

**Feature Branch**: `003-c4-system-groups`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "The software now when creating a component can select from a list of C4 model artifacts. Specifically from the https://c4model.com/diagrams/system-context. I would like to be able to group different systems together to form a bigger system and have a bounding box over the grouped systems."

## Clarifications

### Session 2026-09-11

- Q: Can a Software System belong to more than one system group in the same diagram? → A: Each Software System belongs to at most one group.
- Q: When a grouped system is moved or resized toward or beyond the group boundary, how should the application behave? → A: Constrain the member inside the boundary and use an explicit removal action.
- Q: How should Mermaid export handle a diagram that contains system groups? → A: Export groups as labeled Mermaid `subgraph` sections and explain that exact canvas positions are not preserved.
- Q: When a new group is created, should its selected systems keep their existing positions or be automatically arranged inside the boundary? → A: Keep the existing positions and fit the boundary around the systems.
- Q: Should group names that differ only by capitalization or surrounding whitespace be treated as duplicates within the same diagram? → A: Treat names as duplicates after trimming and ignoring capitalization.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create C4 system-context components (Priority: P1)

When creating a diagram component, an architecture author can choose a C4 System Context artifact type so that the diagram clearly distinguishes people from software systems.

**Why this priority**: Correct artifact classification is the foundation for making system-context diagrams understandable and for deciding which elements may be grouped.

**Independent Test**: Create one component for each supported system-context artifact type and verify that the selected type is shown on the component and remains available when the diagram is reopened.

**Acceptance Scenarios**:

1. **Given** the author is creating a component, **When** the artifact-type choices are shown, **Then** the author can choose at least Person or Software System and can understand what each choice represents.
2. **Given** the author creates a component with a selected artifact type, **When** the component appears on the diagram, **Then** its type is retained and is distinguishable from components of other types.
3. **Given** the author cancels component creation, **When** the creation form closes, **Then** no component or incomplete artifact is added.

---

### User Story 2 - Group software systems into a larger boundary (Priority: P1)

When several software systems collectively form a larger system, an architecture author can select them, give the group a name, and show them inside a labeled bounding box.

**Why this priority**: A visible larger-system boundary is the core value of this feature: it lets readers understand ownership or scope without losing the detail of the constituent systems.

**Independent Test**: Create at least two Software System components, group them, and verify that a named bounding box encloses them while their individual names, positions, and relationships remain visible.

**Acceptance Scenarios**:

1. **Given** a diagram contains at least two Software System components, **When** the author selects those systems and starts grouping, **Then** the author can provide a group name and create a group.
2. **Given** a group is created, **When** the diagram is displayed, **Then** a labeled bounding box is rendered behind the member systems with enough visible spacing to distinguish the boundary from the members, without rearranging the systems’ existing positions.
3. **Given** a group contains multiple systems, **When** the author moves the group, **Then** the member systems move with it while preserving their relative positions.
4. **Given** a group exists, **When** the author renames the group or ungroups it, **Then** the requested change is reflected without deleting the member systems or their relationships.

---

### User Story 3 - Preserve group meaning and references (Priority: P2)

When an architecture author saves, reopens, or edits a grouped diagram, the group boundary and its membership remain consistent so that the diagram can continue to support ADR references and review.

**Why this priority**: Grouping must improve communication without making existing architecture data fragile or invalid.

**Independent Test**: Save a diagram containing a group, reopen it, rename and reposition a member, and verify that the group membership, relationships, and any ADR links still refer to the same architecture elements.

**Acceptance Scenarios**:

1. **Given** a saved diagram contains a named group, **When** the author reopens it, **Then** the group name, member systems, boundary, and member relationships are restored.
2. **Given** a grouped system has ADR links or relationships, **When** the system is renamed or repositioned, **Then** those references remain attached to the same system.
3. **Given** an author deletes a group, **When** deletion is confirmed, **Then** the group boundary is removed but member systems, relationships, ADR links, and their identities are preserved.

---

### Edge Cases

- The author attempts to create a group with fewer than two systems; the action is rejected with a clear explanation and no partial group is created.
- The author selects a Person or another non-system artifact for a system group; the interface prevents the invalid selection or explains why it cannot be grouped.
- A member system is moved or resized toward or beyond the group boundary; movement is constrained so the member remains enclosed, and the author can explicitly remove it from the group.
- A group name is empty, whitespace-only, or duplicates another group name in the same diagram after trimming and ignoring capitalization; the author receives actionable validation and the existing group data is not changed.
- A grouped diagram is exported to a format that cannot represent group boundaries; the author is warned about the limitation and grouping data is not silently removed from the saved diagram. Mermaid represents supported groups as labeled `subgraph` sections and explains that exact canvas positions are not preserved.
- A group contains a member whose name changes; the boundary and membership remain tied to the stable member identity rather than the old name or screen position.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The component-creation flow MUST offer the C4 System Context artifact types supported by this feature, including Person and Software System, with human-readable labels and descriptions.
- **FR-002**: The system MUST store the selected artifact type as part of the component’s architecture data and MUST show that type wherever the component is presented for editing or review.
- **FR-003**: The system MUST allow an author to select two or more Software System components and create a named system group from them without automatically rearranging their existing positions.
- **FR-004**: A system group MUST have its own stable identity, human-readable name, and membership references to the stable identities of its member systems; each Software System MUST belong to at most one group.
- **FR-005**: The system MUST render each system group as a labeled bounding box behind its member systems, with all members visually enclosed and individually readable.
- **FR-006**: Moving a system group MUST move all member systems together while preserving their relative arrangement; it MUST NOT change the logical relationships between members or other components.
- **FR-007**: The system MUST constrain member movement and layout changes so a group boundary continues to enclose all of its members, and MUST provide an explicit way to remove a member from the group.
- **FR-008**: The author MUST be able to rename a group, review its members, and ungroup it without deleting the member systems, their relationships, or their ADR links.
- **FR-009**: The system MUST reject invalid group creation or membership changes with an actionable message, including attempts to group fewer than two systems, unsupported artifact types, or group names that duplicate another name after trimming and ignoring capitalization.
- **FR-010**: Group membership, group names, boundary layout, component artifact types, relationships, and ADR links MUST persist when the diagram is saved and reopened.
- **FR-011**: Renaming or repositioning a component MUST NOT break its group membership, relationships, or ADR links.
- **FR-012**: Destructive actions affecting groups MUST require clear confirmation and MUST preserve member systems and their references when a group is deleted.
- **FR-013**: Mermaid export MUST represent supported system groups as labeled `subgraph` sections and clearly explain that exact canvas positions are not preserved. When an export format cannot represent system groups, the system MUST clearly identify the unsupported grouping information to the author and MUST NOT silently discard it from the saved diagram.
- **FR-014**: Group creation, review, editing, and removal MUST be usable with keyboard navigation, readable labels, clear validation feedback, and sufficient visual contrast.

### Key Entities

- **C4 Artifact Type**: The system-context classification assigned to a component, including Person and Software System, with a human-readable label and description.
- **Software System Component**: A named architecture element representing a system in the diagram, with a stable identity used by relationships, ADR links, and group membership.
- **System Group**: A named larger-system boundary with a stable identity and a collection of member software system identities.
- **Group Boundary Layout**: The visual position and dimensions used to display a group’s labeled bounding box around its members.
- **Group Membership**: The durable association between a system group and a member software system; it is independent of names and screen positions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability validation, authors can create a Person or Software System component and identify its artifact type in under 30 seconds on their first attempt.
- **SC-002**: Authors can create a named group containing two to twenty software systems in under 60 seconds, with the resulting boundary visibly enclosing every selected system.
- **SC-003**: 100% of valid group memberships, group names, component types, relationships, and ADR links remain intact after a save-and-reopen cycle in validation tests.
- **SC-004**: In usability validation, at least 90% of authors can rename or ungroup a system group without deleting a member system or its references on their first attempt.
- **SC-005**: Every invalid grouping attempt in validation produces an actionable message and leaves the existing diagram unchanged.
- **SC-006**: Authors can distinguish the group boundary from its member systems at normal diagram zoom without relying on color alone.

## Assumptions

- Version one focuses on C4 System Context artifacts: Person and Software System. Container, Component, Code, deployment, and other C4 diagram levels are outside this feature’s scope.
- A system group represents a named larger-system boundary for organization and communication; member systems remain independently addressable architecture elements.
- Only Software System components can be members of a system group. Person components remain outside the group boundary in version one.
- A Software System can belong to at most one system group in version one; group boundaries do not overlap through shared membership.
- Member movement is constrained within the current group boundary; membership changes happen only through an explicit removal action.
- Mermaid export preserves group names and membership semantically as `subgraph` sections, but does not preserve exact canvas positions.
- Creating a group preserves each selected system’s existing position and calculates the initial boundary around those positions.
- Group-name uniqueness is checked after trimming whitespace and ignoring capitalization.
- Version one supports non-nested groups. A group cannot contain another group, and a group is not a new relationship endpoint.
- Existing component relationships and ADR links continue to target individual stable component identities; grouping does not rewrite those references.
- The author has access to the existing diagram editing and persistence workflows, and this feature does not introduce authentication, permissions, or real-time collaboration.
