# Feature Specification: C4 Container Diagrams

**Feature Branch**: `009-c4-container-diagrams`

**Created**: 2026-09-30

**Updated**: 2026-10-02

**Status**: Draft

**Input**: User description: "Create a new branch. The user wants to create C4 model container diagrams as specified at https://c4model.com/diagrams/container and https://c4model.com/abstractions/software-system. The user shall be able to create a container diagram when double-clicking a Software System, and there should be an option to create a container diagram when the Software System is clicked or being viewed."

**Update request**: "When adding a component to a Container diagram, the only options are Application or Datastore, not Software System or Person. When editing a container diagram entered from a parent diagram, save it under that originating parent rather than as a Parent Diagram."

## Clarifications

### Session 2026-10-02

- Q: If a parent diagram is in trash, what should happen when someone tries to restore one of its container diagrams? → A: Offer to restore the parent and its affected children together, with confirmation.
- Q: If a parent element is used as an external participant in a container diagram, what should happen when its type changes to something other than Person or Software System? → A: Block the type change and identify the dependent occurrences that must be removed first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create or open a container diagram from a Software System (Priority: P1)

An architecture author double-clicks a Software System to create and enter its container diagram. The author can also select or view the Software System and use a visible "Create container diagram" action. After creation, both entry points open the existing diagram so the author can continue detailing the same system.

**Why this priority**: These are the requested entry points and establish the connection between the system overview and its internal architecture.

**Independent Test**: In a saved diagram containing two Software Systems and a Person, use double-click on the first system and the selected-system action on the second. Verify that each opens a new container diagram associated with the correct system and that repeating either action opens its existing diagram.

**Acceptance Scenarios**:

1. **Given** a saved Software System has no container diagram, **When** the author double-clicks it, **Then** one container diagram is created and opened with that system identified as its scope and an empty labeled system boundary.
2. **Given** a Software System is selected or its details are being viewed, **When** it has no container diagram, **Then** a visible, keyboard-accessible "Create container diagram" action is available and creates and opens the same kind of diagram as double-click.
3. **Given** a Software System already has a container diagram, **When** the author double-clicks it or uses "Open container diagram" in its details, **Then** the existing diagram opens with its saved content and no duplicate is created.
4. **Given** a Person, unclassified element, or system group boundary is selected, **When** the author views its actions or double-clicks it, **Then** it cannot be used as the owning Software System of a container diagram.
5. **Given** a Software System belongs to an existing system group, **When** the author creates its container diagram, **Then** the container diagram belongs to that individual system and its group membership remains intact.
6. **Given** creation or loading fails, **When** the author attempts either entry point, **Then** the current diagram remains available, the author receives an actionable error and retry option, and retry does not produce a duplicate diagram.
7. **Given** another Software System is shown as an external participant in a container diagram, **When** the author uses either entry point on it, **Then** the action creates or opens the child of its source Software System, using the same association as that system's parent view.

---

### User Story 2 - Describe containers and their communication (Priority: P1)

An architecture author models the applications and data stores inside one Software System. Adding a component offers exactly two types: "Application" and "Datastore". The diagram shows each container's responsibilities and technology, connections between containers, and existing people or other Software Systems included from the parent as external participants.

**Why this priority**: A linked empty diagram becomes useful when it can explain the system's internal architecture according to C4 container semantics.

**Independent Test**: Open the add-component workflow in a container diagram and verify that its only type choices are Application and Datastore. Model a web application, a service, and a data store with their descriptions and technologies, connect them, and include an existing Person and another Software System from the parent through the external participant workflow. Verify that a reader can distinguish internal containers, external participants, and communication.

**Acceptance Scenarios**:

1. **Given** a container diagram is open, **When** the author adds a component, **Then** the only type choices are "Application" and "Datastore", Software System and Person are unavailable, and the author supplies a nonblank name, a description of its responsibilities, and its technology before the container appears inside the owning system's boundary with these details readable.
2. **Given** an existing container, **When** the author edits its details, position, or size, **Then** the changes are shown, all internal containers remain enclosed by the boundary, and their identities and links remain intact.
3. **Given** two containers, **When** the author connects them, **Then** a directed relationship with a nonblank description of the interaction is shown; the author can also record a communication technology or protocol.
4. **Given** the parent diagram contains a Person or another Software System that interacts with an internal container, **When** the author includes that participant and adds the interaction, **Then** it appears outside the owning system boundary with its correct C4 type and a relationship to the container.
5. **Given** an included external participant is repositioned in the container diagram, **When** the author returns to the parent diagram, **Then** the participant's original position and the parent's existing relationships are unchanged.
6. **Given** invalid container details, an invalid relationship endpoint, or an unsupported artifact type, **When** the author submits the change, **Then** the system identifies the violated rule and creates no partial artifact.
7. **Given** an editable container diagram, **When** the author undoes and redoes an ordinary container or relationship edit, **Then** the existing editing history restores the corresponding content and references.
8. **Given** an Application or Datastore has been created and saved, **When** the author reopens the diagram and edits that component, **Then** its selected type is retained and the available type choices remain Application and Datastore.

---

### User Story 3 - Navigate and continue work without losing context (Priority: P2)

An architecture author moves between the system overview and its container diagram, saves the work under the parent from which it was entered, and returns later. The saved child retains its owner-derived name and container diagram level and is listed under that parent. The current diagram level and owning Software System remain clear, and ordinary renaming or repositioning does not break the association.

**Why this priority**: Reliable navigation and persistence make the new diagram part of the existing architecture workflow.

**Independent Test**: From a named parent diagram, enter a Software System's container diagram, edit and save it twice, and verify that one child is listed under that parent with its owner-derived name and container diagram level. Return to the parent, rename and move the owning system, then reopen the child after refreshing and through the diagram list. Verify parent and owner associations, container details, relationships, and layout, and that the parent's content was not replaced by the child's edits.

**Acceptance Scenarios**:

1. **Given** a container diagram is open, **When** the author reviews its heading and navigation, **Then** "Container diagram" and the owning Software System's current name are visible and the author can return to its parent diagram.
2. **Given** either diagram has unsaved changes, **When** the author attempts to navigate away, **Then** the existing save, discard, or cancel workflow is applied; canceling or a failed save preserves the changes and keeps the current view open.
3. **Given** a saved container diagram, **When** the author refreshes or reopens it through its owning system or the diagram list, **Then** its scope, containers, external participants, relationships, details, and layout are restored.
4. **Given** the owning system or an external participant is renamed in the parent diagram, **When** the child is next loaded, **Then** the current source name is shown and the same stable association and references remain.
5. **Given** two Software Systems have identical names, **When** each has a container diagram, **Then** each entry point opens the diagram associated with the selected system's identity.
6. **Given** container diagrams appear in the existing diagram list, **When** the author browses the list, **Then** each is listed under its associated parent and identified as a container diagram with its owning system and parent diagram; filtered results retain this parent identification, and opening an entry creates no additional diagram.
7. **Given** the author entered a container diagram from a Software System in a parent diagram, **When** the author edits and saves the child, **Then** the existing child is saved under that parent with its owner-derived name and container diagram level, without being renamed or classified as "Parent Diagram", creating a separate top-level diagram, or replacing the parent's architecture content.
8. **Given** a saved container diagram is reopened from the diagram list or after refreshing, **When** the author edits and saves it again, **Then** the same child identity and original parent association are retained regardless of the latest entry point.
9. **Given** two different parent diagrams contain Software Systems with identical names, **When** the author edits and saves each system's container diagram, **Then** each child remains under its own originating parent with no reassignment or duplicate entry.

---

### User Story 4 - Preserve decisions and recoverable architecture data (Priority: P2)

An architecture author links ADRs to containers and their relationships and safely manages the new diagrams. Existing architecture and decisions remain accessible when diagrams are saved, exported, moved to trash, or restored.

**Why this priority**: The project treats diagrams and ADRs as linked architecture knowledge; adding a new diagram level must preserve that knowledge.

**Independent Test**: Link an ADR to a container and a relationship, save and reopen the diagram, exercise deletion safeguards, and restore a trashed diagram. Verify reference integrity and the behavior of the existing exports.

**Acceptance Scenarios**:

1. **Given** a container or container relationship, **When** the author links an ADR using the existing workflow, **Then** the linked decision can be reviewed and remains attached to the same artifact after renaming, repositioning, saving, and reopening.
2. **Given** a Software System owns an active or recoverable container diagram, **When** the author tries to delete that system or change its type, **Then** the operation is blocked with an explanation of the dependent diagram.
3. **Given** a parent participant is referenced by an active or recoverable container diagram, **When** the author tries to delete that source participant or change its type to something other than Person or Software System, **Then** the operation is blocked and identifies the dependent occurrences that must be explicitly removed first; the source, occurrences, relationships, and ADR links remain unchanged by the blocked attempt.
4. **Given** a parent diagram with active child container diagrams, **When** the author confirms moving the parent to trash, **Then** the confirmation identifies the affected children, those children also become unavailable for active editing, and restoring the parent restores the children that were active before that operation with their identities and links.
5. **Given** a container diagram is moved to trash independently, **When** its owning system is viewed or double-clicked, **Then** the author is offered restoration of that diagram rather than silent replacement; restoration preserves its content and references.
6. **Given** a container diagram is exported using an existing export option, **When** the format supports the content, **Then** the export identifies the owning system and represents its boundary, containers, displayed metadata, external participants, relationships, and any ADR content required by that format; otherwise an actionable error identifies the unsupported content and no incomplete export is presented as successful.
7. **Given** a container diagram became unavailable when its parent was moved to trash, **When** the author attempts to restore that child, **Then** the system offers to restore the parent and all children affected by that trash operation together, identifies those diagrams before confirmation, and restores them with their identities and links only after confirmation; cancellation leaves their trash states unchanged.

### Edge Cases

- Repeated double-clicks or activating both entry points while creation is pending create at most one child diagram for the same owning system.
- The owning system has not yet been saved: creation requires a successful parent save; failure leaves the author in the parent with their changes intact.
- The owning system is renamed, moved, resized, grouped, or ungrouped: its child association remains based on identity.
- Duplicate system names or later name changes do not cause diagrams to be merged or reassigned.
- Switching between a parent and its child updates the add-component type choices for the current diagram level; a previously selected Software System or Person type cannot carry into child component creation.
- Renaming a child or its parent, repeating a save, or reopening a child directly from the diagram list does not promote it to a parent diagram, replace its name with "Parent Diagram", or change its parent association.
- A child save fails: the edits and original parent association remain intact, and retry updates the same child without creating a top-level entry or overwriting the parent.
- A new container diagram has no containers yet: the boundary and an instruction to add the first container remain visible, and the empty diagram can be saved and reopened.
- A container is moved or resized beyond the current boundary: the boundary adjusts to enclose all internal containers without changing their ownership.
- An expanding boundary would overlap an external participant: that occurrence is repositioned outside the boundary with visible spacing, preserving its source identity and relationships; directly placing an external occurrence inside the boundary is rejected with an explanation.
- The author selects the owning system itself as an external participant, includes the same source participant twice, or adds a relationship between two external participants: validation rejects the change with an explanation.
- Including an external participant does not automatically copy system-level relationships into container-level relationships or invent connections.
- The author attempts to reclassify a source participant to a type other than Person or Software System while active or recoverable child occurrences reference it: the change is blocked, the dependent occurrences that must be removed first are identified, and existing relationships and ADR links remain intact.
- A referenced source artifact is unavailable or a saved ownership reference is broken: the diagram reports the affected reference and prevents saving or exporting it as a valid complete artifact.
- A child was already in trash before the parent was trashed: restoring the parent leaves that child in trash until explicitly restored.
- A child restoration is requested while its parent is in trash: the system offers confirmed restoration of the parent and the children affected by that parent's trash operation, rather than activating a child alone. Children already in trash before that operation still require separate explicit restoration after the parent is restored.
- A diagram load, save, trash, restore, or export fails: the author receives clear failure feedback and no operation silently removes artifacts or reports a false success.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an author to create and enter a C4 container diagram by double-clicking a Software System. For an external Software System occurrence, the action MUST resolve to its source Software System and the same child association used in the source's parent diagram.
- **FR-002**: Selecting or viewing a Software System, including an external occurrence, MUST expose a visible "Create container diagram" action when no child exists and an "Open container diagram" action when its child is active. The explicit action MUST support keyboard use.
- **FR-003**: A container diagram MUST be associated with exactly one owning Software System through stable identities. Each owning system MUST have at most one active or recoverable container diagram; repeated or overlapping creation attempts MUST return the same diagram.
- **FR-004**: Only Software System artifacts MUST be eligible owners. A Person, unclassified artifact, container, or system group MUST NOT be treated as the owning Software System; grouping MUST NOT change eligibility or ownership.
- **FR-005**: The system MUST save an unsaved owning system and its parent successfully before creating its child. Creation and loading MUST show progress, success, or an actionable failure without losing the current work or leaving a duplicate or unusable partial child.
- **FR-006**: Each container diagram MUST show one labeled boundary identifying its owning Software System. All internal containers MUST remain visually enclosed, including after adding, moving, resizing, or removing containers. People and other Software Systems MUST be visibly outside this boundary. If the boundary expands over an external occurrence, the occurrence MUST be repositioned outside it with visible spacing while preserving its source reference and relationships; attempts to place an external occurrence inside it MUST be rejected with an explanation.
- **FR-007**: Authors MUST be able to create, edit, position, resize, and remove containers representing applications or data stores. In a container diagram, the add-component workflow and component type editing MUST offer exactly "Application" and "Datastore"; Software System, Person, and unclassified types MUST NOT be available for creating or reclassifying an internal component. The selected type MUST persist through save and reopen. Each container MUST have a stable identity, a nonblank name, a nonblank responsibility description, and a nonblank technology value. Names, C4 types, responsibilities, and technology MUST be readable on the diagram.
- **FR-008**: Authors MUST be able to create, edit, and remove directed relationships between two internal containers or between an internal container and an external participant. Each relationship MUST have stable endpoint references and a nonblank interaction description, with an optional communication technology or protocol; the description and any supplied technology or protocol MUST be readable on the diagram. Relationships between two external participants and relationships to the boundary itself MUST be rejected.
- **FR-009**: Authors MUST be able to include a Person or a Software System from the owning system's parent diagram as an external participant. Its displayed name, description, and type MUST derive from the source artifact and reflect source changes when the child is loaded. Its diagram position MUST be independent of its parent position. The owning system itself and duplicate occurrences of the same source in one child MUST be rejected.
- **FR-010**: The diagram MUST clearly identify its container level and current owning system name, provide navigation to the parent diagram, and apply the existing save, discard, or cancel behavior before leaving unsaved work. A failed save or canceled navigation MUST preserve the work and current view.
- **FR-011**: Saved container diagrams MUST be available through the existing diagram list and their owning systems. The list MUST place each child under its associated parent diagram and show its owner-derived name, container diagram level, owning system, and parent diagram. Filtering MUST retain enough parent identification to locate the child's scope. A child MUST NOT appear as a separate top-level parent diagram.
- **FR-012**: Ownership, diagram identities, container details and layout, external participant source references and layout, relationships, ADRs, and artifact links MUST persist across save, refresh, and reopen. Renaming, positioning, resizing, or grouping an owning system MUST NOT change these associations.
- **FR-013**: Ordinary container and relationship edits MUST participate in the existing undo and redo workflow without changing artifact identities or leaving unresolved references.
- **FR-014**: The existing ADR creation, lifecycle, linking, and review workflows MUST be available for containers and their relationships. Links MUST target stable artifact identities. Parent ADR links MUST NOT be automatically copied to child containers or relationships.
- **FR-015**: Deleting an owning Software System or changing it to another artifact type MUST be blocked while an active or recoverable child diagram depends on it. Deleting a source participant or changing its type to something other than Person or Software System MUST likewise be blocked while occurrences in active or recoverable child diagrams depend on it. The explanation MUST identify the dependency and the action needed to resolve it; for a source participant, it MUST identify the dependent occurrences that must be explicitly removed first. A blocked attempt MUST leave the source artifact, occurrences, relationships, and ADR links unchanged.
- **FR-016**: Moving a parent diagram to trash MUST require confirmation explaining which active container diagrams will also become unavailable. Restore MUST return the parent and exactly those children affected by that operation with their identities, content, and references; previously trashed children MUST remain trashed.
- **FR-017**: Independently moving a container diagram to trash and restoring it MUST use the existing confirmed, recoverable deletion workflow. Its owner MUST expose "Restore container diagram" while it is in trash; double-click MUST offer that restoration without silently creating a replacement. If restoration is requested while the parent is in trash, the system MUST offer to restore the parent and the children affected by its trash operation together according to FR-016, identify the affected diagrams before confirmation, and leave their trash states unchanged on cancellation. A child MUST NOT become active while its parent remains in trash; children already in trash before the parent operation MUST still require separate explicit restoration after the parent is restored.
- **FR-018**: Removing containers, relationships, or external occurrences MUST follow existing confirmation and reference-protection rules and MUST identify affected ADR links. Cancellation MUST leave the artifacts and references intact.
- **FR-019**: Existing exports for a container diagram MUST preserve its system scope, boundary, containers, displayed details, external participants, and relationships, plus ADR content and references required by the selected format. Invalid or unsupported content MUST produce an actionable validation error rather than silent omission. Exporting a parent diagram MUST NOT claim to include child diagram contents unless they are actually included.
- **FR-020**: Existing diagrams without container diagrams MUST continue to load, edit, save, group, link ADRs, and export without data loss or being reclassified as container diagrams.
- **FR-021**: Creation, editing, navigation, validation, and recovery actions MUST provide readable labels, visible keyboard focus, accessible contrast, and clear success and failure feedback. Scope and artifact type MUST be distinguishable without color alone.
- **FR-022**: Validation MUST reject missing required container details, invalid relationship endpoints, unsupported artifact types, broken ownership or external source references, and invalid internal/external placement without silently discarding content.
- **FR-023**: Saving edits to a container diagram MUST update that child using its stable identity and preserve its association with the parent diagram containing its owning Software System. A child entered from that parent MUST remain saved under it. Saving MUST preserve the child's owner-derived name and container diagram level rather than assigning the generic name or classification "Parent Diagram", MUST NOT create a duplicate or top-level parent entry, and MUST NOT replace the parent's architecture content with child content. These rules MUST apply to repeated saves, saves before navigation, and saves after refresh or opening from the diagram list. Failed saves MUST preserve unsaved work and the parent association for retry.
- **FR-024**: Component creation and type editing MUST use the choices permitted for the current diagram level, including after navigating between parent and child. Attempts to create or reclassify an internal child component as Software System, Person, or another unsupported type MUST be rejected with an actionable explanation and no partial artifact. Existing parent people and Software Systems MUST remain includable only through the external participant workflow defined in FR-009.

### Key Entities

- **Owning Software System**: An existing Software System representing a unit that delivers value to users, with a stable identity in its parent diagram and an association to its container diagram.
- **Parent Diagram**: The diagram containing the source owning Software System, identified by a stable identity and used to organize its child container diagrams independently of names or the latest navigation entry point.
- **Container Diagram**: A diagram saved under its associated parent, with its own stable identity and name, container diagram level, a single owning system, a labeled system boundary, internal containers, external participants, relationships, layout, and associated ADRs.
- **Container**: An application or data store inside the owning Software System, described by its stable identity, selected Application or Datastore type, name, responsibilities, technology, position, and size.
- **External Participant Occurrence**: A Person or another Software System shown outside the boundary, with a stable occurrence identity for child relationships and ADR links, a stable source reference to its parent artifact, and its own local layout.
- **Container Relationship**: A directed, identified interaction between permitted diagram elements, with stable endpoints, a description, and an optional communication technology or protocol.
- **ADR Artifact Link**: An association connecting an ADR to an identified container, external participant occurrence, or relationship within the container diagram, using the existing decision lifecycle.
- **System Boundary**: The visual enclosure of the single owning system's containers; it is distinct from the existing group boundary that organizes multiple Software Systems.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability validation, at least 90% of first-time authors can create and enter a container diagram through either requested entry point within 30 seconds from a saved Software System being visible, without separate instructions.
- **SC-002**: In 100% of repeated-action, duplicate-name, and grouped-system validation cases, creation and reopening identify exactly the intended owning system and produce no duplicate child diagram.
- **SC-003**: An author can model three containers, their responsibilities and technologies, two internal interactions, and one external participant interaction in under five minutes using prepared architecture information.
- **SC-004**: At least 90% of reviewers can identify the owning system, all internal containers, their technologies, and external participants within one minute of viewing a representative diagram without relying on color alone.
- **SC-005**: In 100% of save/reopen, rename/reposition, undo/redo, and trash/restore validation cases, the expected architecture content, stable identities, ownership, and ADR references remain intact.
- **SC-006**: In 100% of invalid-input, unavailable-reference, failed-operation, and unsupported-export validation cases, the author receives an actionable explanation, no data is silently discarded, and no failed operation is reported as successful.
- **SC-007**: An author using only a keyboard can select a Software System, create or open its child, add and edit a container, create an interaction, save, and return to the parent.
- **SC-008**: All representative existing diagrams without child diagrams retain their content and existing grouping, ADR linking, editing, and export behavior in compatibility validation.
- **SC-009**: In 100% of container component creation, type editing, and parent-to-child navigation validation cases, Application and Datastore are the only available internal component types; Software System and Person creation attempts produce no internal artifact, while including existing external participants remains available.
- **SC-010**: In 100% of child edit/save, repeated-save, save-before-navigation, refresh/reopen, diagram-list entry, rename, duplicate-name, and failed-save/retry validation cases, the child retains its identity, owner-derived name, container diagram level, and original parent association, appears under that parent, and produces no duplicate or top-level parent entry or replacement of parent content.

## Assumptions

- Both double-click and a visible selected/viewed-system action are required. A plain click continues to select the Software System; it does not immediately create or navigate to a child.
- The first release provides one canonical container diagram per Software System artifact. Multiple alternative views for the same system are outside this feature.
- The parent diagram is the existing diagram containing the source Software System. A group of Software Systems remains an organizational grouping and does not become the C4 boundary of a container diagram.
- Saving "under the parent" means retaining the child's separate identity and content while organizing it beneath its originating parent in the diagram list. "Parent Diagram" is not an automatic child name or level. Opening a source-linked external Software System still uses that source system's canonical parent association as specified in FR-001.
- Any Software System artifact in a parent diagram can be modeled, whether or not it is a member of a system group. Separate artifacts with matching names remain separate systems.
- A new child starts with a named boundary and no containers. Its read-only title equals the current Software System name; ownership is determined by stable identity.
- Containers describe applications and data stores in the C4 sense. Deployment infrastructure, environments, Component and Code diagrams, and deeper diagram levels are outside this feature.
- "Application" includes services and other executable containers; "Datastore" denotes a data store. These are the two user-facing choices for internal components. Adding them and including existing external participants are distinct actions.
- External participants are selected from the source parent diagram; authors create new people or Software Systems there first. Displayed source details are edited in the parent, while occurrence layout and interactions are edited in the child.
- Container relationships are authored explicitly; parent system-level relationships do not determine which internal container participates in an interaction.
- Container diagrams use the existing save, editing history, ADR, diagram list, and recoverable trash workflows. No authentication, permissions, collaboration, or new revision-history capability is introduced.
- Existing exports are dependencies that must either represent the selected child completely according to their current content contract or reject unsupported content clearly. New recursive exports, interactive navigation between exported parent and child diagrams, and new import workflows are outside this feature.
- Implementation validation will cover both creation entry points, C4 scope and boundary rendering, Application/Datastore choices across navigation and editing, container metadata and relationship validation, child save placement and repeated saves, persistence, stable references and ADR lifecycle behavior, compatibility with existing artifacts, recovery, and representative exports.

### Reference Guidance

- [C4 container diagram](https://c4model.com/diagrams/container): Defines a diagram scoped to one Software System, with internal applications or data stores and supporting connected people or Software Systems.
- [C4 Software System abstraction](https://c4model.com/abstractions/software-system): Defines the system abstraction and its user value. The existing multi-system grouping capability does not change the identity of an individual Software System.

## Owner-name synchronization (2026-10-05)

This clarification supersedes independent child naming in earlier revisions.

- **FR-025**: Container titles always follow the current owning Software System, including legacy/custom titles, resolved by stable parent/owner UUIDs. General diagram names remain editable. No schema migration or read-time writes/timestamp changes. Container title inputs MUST be read-only. The sidebar MUST preview draft owner names immediately before filtering/sorting; undo/redo/discard restore the corresponding label. Successful saves reconcile captured server metadata without replacing newer drafts; failed saves preserve preview and error feedback. Load/list/availability/create-or-open/trash/restore/export MUST expose the current persisted owner name.
- **SC-011**: In every rename-before/after-creation, undo/redo/discard, failure/retry, delayed-list, reload/reopen, duplicate-name, recovery and export regression, titles follow the correct owner while artifact IDs, creation times, content/layout and ADR references remain unchanged.
