# Feature Specification: Architecture Decision Records

**Feature Branch**: `002-adr-component-tagging`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "The app should also be able to key in Architecture Decision Records (ADR). The ADR should be able to be tagged to specific components in the Software Architecture Diagram but it is not mandatory to do so."

## Clarifications

### Session 2026-08-30

- Q: Which status transitions should be allowed for an ADR, and must a superseded ADR reference its replacement? → A: Status changes are unrestricted, but a superseded ADR must always reference its replacement.
- Q: What should happen if a replacement ADR is deleted while another ADR references it? → A: Prevent deletion until all replacement references are repaired or explicitly removed.
- Q: What should happen when saving an ADR fails because the backend is unavailable? → A: Preserve edits, show an unsaved/error state, and allow retry.
- Q: What should happen when a diagram component with ADR links is deleted? → A: Block component deletion until affected ADR links are repaired or explicitly removed.
- Q: Which ADR fields must be completed before an ADR can be saved as valid? → A: Title, context, decision, and consequences are required; alternatives or constraints are optional.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record an architecture decision (Priority: P1)

An architecture practitioner creates and saves an Architecture Decision Record so the reasoning
behind a system choice is available alongside the architecture diagram.

**Why this priority**: Capturing the decision and its rationale is the primary value of the
feature, whether or not the decision affects a specific diagram component.

**Independent Test**: Create an ADR with its required decision information, save it, reopen it,
and confirm that the content, status, and timestamps are preserved.

**Acceptance Scenarios**:

1. **Given** an ADR workspace, **When** the user creates an ADR and enters its title, context,
   decision, consequences, and alternatives or constraints, **Then** the ADR can be saved with
   a stable identity and a clear saved state.
2. **Given** a saved ADR, **When** the user reopens it, **Then** all entered content and metadata
   are displayed without unintended changes.
3. **Given** an ADR with incomplete required information, **When** the user attempts to save it,
   **Then** the user receives an actionable validation message and the incomplete record is not
   presented as a completed decision.

---

### User Story 2 - Optionally link an ADR to diagram components and relationships (Priority: P1)

An architecture practitioner links an ADR to one or more specific components and/or relationships
in a software architecture diagram when the decision directly affects those artifacts, while
retaining the option to keep the ADR unlinked when its scope is broader or not yet known.

**Why this priority**: Component and relationship references make decisions explainable in
architectural context, while optional linking supports cross-cutting, exploratory, and
platform-level decisions.

**Independent Test**: Create an ADR, attach it to one component, one relationship, and then
multiple components and relationships, save and reopen it, and verify the references; view each
linked artifact and verify its ADR references; also save an ADR with no component or relationship
references.

**Acceptance Scenarios**:

1. **Given** an ADR and an existing diagram, **When** the user selects one or more components to
   tag, **Then** the ADR shows those component names as linked references.
2. **Given** an ADR and an existing diagram, **When** the user selects one or more relationships to
   tag, **Then** the ADR shows those relationship references with enough endpoint or label
   information to distinguish each relationship.
3. **Given** an ADR, **When** the user selects both components and relationships, **Then** the ADR
   preserves and displays both sets of links together.
4. **Given** an ADR with component or relationship references, **When** the user removes one
   reference and saves, **Then** the remaining references are preserved and the removed reference
   is no longer shown.
5. **Given** an ADR with no component or relationship references, **When** the user saves and
   reopens it, **Then** the ADR remains valid and is clearly identified as unlinked rather than
   requiring an artifact selection.
6. **Given** a linked component or relationship is renamed, repositioned, or otherwise edited,
   **When** the user views the ADR, **Then** the reference still resolves to the same artifact.
7. **Given** a component or relationship has one or more linked ADRs, **When** the user views that
   artifact, **Then** its view shows each linked ADR by title and status and provides a way to open
   the corresponding ADR.
8. **Given** a component or relationship has no linked ADRs, **When** the user views that artifact,
   **Then** its view clearly indicates that no ADRs are linked without treating the state as an
   error.
9. **Given** an ADR displays a linked component or relationship, **When** the user chooses that
   reference, **Then** the corresponding artifact is selected or focused in the active diagram.

---

### User Story 3 - Edit diagram components and relationships without breaking ADR links (Priority: P1)

An architecture practitioner updates the name of a component or the label and direction of a
relationship as the architecture evolves, while keeping existing ADR references attached to the
same underlying artifacts.

**Why this priority**: Architecture diagrams change over time; editing their meaning or wording
must not invalidate the decision history connected to them.

**Independent Test**: Create two named components and a directed, labeled relationship between
them, link an ADR to both artifacts, rename one component, change the relationship label, reverse
the relationship direction, save and reopen the diagram, and verify that the updated diagram and
ADR references are correct.

**Acceptance Scenarios**:

1. **Given** a component with or without linked ADRs, **When** the user changes its name and saves,
   **Then** the new name is shown everywhere the component is displayed, its stable identity is
   unchanged, and all ADR links still resolve to that component.
2. **Given** a relationship with or without linked ADRs, **When** the user changes its label and
   saves, **Then** the new label is shown on the relationship, its endpoints and stable identity
   are unchanged, and all ADR links still resolve to that relationship.
3. **Given** a directed relationship, **When** the user changes its direction, **Then** the
   relationship's source and target are reversed, the diagram shows the new direction, and its
   stable identity, label, and ADR links are preserved.
4. **Given** a relationship that may be directed or undirected, **When** the user changes its
   direction mode, **Then** the relationship visibly reflects the selected mode and remains linked
   to the same relationship artifact.
5. **Given** edited component and relationship data, **When** the user saves and reopens the
   diagram, **Then** the changed names, labels, directions, and ADR references are preserved.

---

### User Story 4 - Find and manage decision status (Priority: P2)

An architecture practitioner reviews existing ADRs, identifies their lifecycle status, and edits
or supersedes a decision without silently losing its history.

**Why this priority**: Decision history remains useful only when users can distinguish current
decisions from decisions that are drafts, rejected, or replaced.

**Independent Test**: Create ADRs in each supported status, filter or review them, change one to
superseded, and verify that the original remains discoverable with its status and history.

**Acceptance Scenarios**:

1. **Given** multiple ADRs with different statuses, **When** the user reviews the ADR list,
   **Then** each ADR displays its title, status, and last updated time.
2. **Given** an ADR, **When** the user changes its status to superseded and identifies the replacing
   ADR, **Then** the original remains available, is visibly marked as superseded, and retains the
   reference to its replacement.
3. **Given** an ADR with saved content, **When** the user requests deletion, **Then** the user
   must confirm the destructive action and receives clear feedback about the result.

### Edge Cases

- An ADR may be intentionally unlinked from all components and relationships; it MUST remain valid
  and discoverable.
- A referenced component may be deleted; the system MUST identify the affected ADR reference and
  require an explicit repair or removal rather than silently dropping the link.
- A referenced relationship may be deleted; the system MUST identify the affected ADR reference
  and require an explicit repair or removal rather than silently dropping the link.
- A referenced component may be renamed or moved; the ADR link MUST continue to resolve by stable
  component identity.
- A referenced relationship may be relabeled or have its visual representation edited; the ADR
  link MUST continue to resolve by stable relationship identity.
- A component name MUST NOT be blank or whitespace-only; the user MUST receive an actionable
  validation message and the previous valid name MUST remain available when such an edit is
  attempted.
- Two components may have the same human-readable name; they MUST remain distinguishable by
  stable identity, and renaming one MUST NOT change the other or its ADR links.
- Clearing an optional relationship label MUST leave a valid relationship and a resolvable ADR
  link.
- Reversing a relationship's direction or changing it between directed and undirected MUST update
  the relationship semantics without creating a new relationship or breaking its ADR links.
- Attempting to link an ADR to a component or relationship from a different diagram or to a missing
  artifact MUST be rejected with an actionable message.
- Removing a component that would also remove relationships linked to ADRs MUST identify all
  affected ADR links and require them to be repaired or explicitly removed before the component
  removal proceeds.
- Two ADRs may have similar or identical titles; each MUST remain distinguishable by stable
  identity and visible metadata.
- Content containing punctuation, non-Latin characters, or long text MUST remain readable and
  persist without truncation.
- Changing an ADR status or deleting an ADR MUST not silently remove its component or relationship
  references or history.
- An ADR referenced as the replacement for another ADR MUST NOT be deleted until those replacement
  references are repaired or explicitly removed.
- If saving an ADR fails because the backend is unavailable, the system MUST preserve the user's
  edits, clearly identify the ADR as unsaved, and provide a retry action.
- A diagram component or relationship with ADR links MUST NOT be deleted until all affected ADR
  links are repaired or explicitly removed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to create, name, edit, save, reopen, and delete an
  Architecture Decision Record.
- **FR-002**: An ADR MUST support title, context, decision, consequences, alternatives or
  constraints, status, and creation and update timestamps. Title, context, decision, and
  consequences are required for a valid saved ADR; alternatives or constraints are optional.
- **FR-003**: The system MUST assign each ADR a stable identity that remains unchanged when its
  content, status, or component references change.
- **FR-004**: The system MUST validate required ADR information before treating an ADR as saved
  and MUST identify missing or invalid information with an actionable message.
- **FR-005**: The system MUST support the lifecycle statuses draft, accepted, superseded, and
  rejected. Status changes MAY move between any supported statuses, but an ADR marked superseded
  MUST reference its replacement ADR.
- **FR-006**: The system MUST allow a user to associate an ADR with zero, one, or multiple
  specific components and/or relationships in an existing software architecture diagram.
- **FR-007**: Component and relationship associations MUST reference stable artifact identities
  rather than names, labels, or visual positions, so links remain valid after an artifact is
  renamed, relabeled, repositioned, or otherwise visually edited.
- **FR-008**: The system MUST prevent an ADR from being linked to a missing component or
  relationship, or to an artifact outside the selected diagram, and MUST report the validation
  failure clearly.
- **FR-009**: The system MUST show an ADR's linked components and relationships and provide a way
  to navigate from the ADR to each linked artifact when it is available.
- **FR-010**: The system MUST show whether an ADR has no component or relationship links without
  treating the absence of links as an error.
- **FR-011**: When a linked component or relationship is deleted, the system MUST surface the
  affected ADR links and require the user to repair or remove those links explicitly.
- **FR-012**: The system MUST preserve ADR content, status, timestamps, stable identity, and
  component and relationship associations when the ADR is saved and reopened.
- **FR-013**: The system MUST keep superseded and rejected ADRs discoverable and visibly labeled
  rather than silently deleting them.
- **FR-014**: The system MUST require clear confirmation before deleting an ADR and MUST provide
  clear success or failure feedback for create, save, update, link, unlink, status-change, and
  delete actions.
- **FR-015**: ADR creation, editing, linking, and review MUST support keyboard navigation,
  readable labels, clear status feedback, and accessible contrast.
- **FR-016**: The system MUST prevent deletion of an ADR that is referenced as the replacement for
  another ADR until each replacement reference is repaired or explicitly removed, and MUST explain
  the blocking references to the user.
- **FR-017**: If saving an ADR fails because the backend is unavailable, the system MUST preserve
  the user's edits, clearly identify the ADR as unsaved, and provide a retry action.
- **FR-018**: The system MUST prevent deletion of a diagram component with ADR links until each
  affected link is repaired or explicitly removed, and MUST identify the blocking ADRs to the user.
- **FR-019**: When a user views a diagram component, the system MUST show all ADRs linked to that
  component, including each ADR's title and current status.
- **FR-020**: The component view MUST provide a way to open each displayed ADR without requiring
  the user to search for it again.
- **FR-021**: When a component has no linked ADRs, the system MUST show a clear no-linked-ADRs
  state that is distinct from an error or unavailable-data state.
- **FR-022**: When a user views a diagram relationship, the system MUST show all ADRs linked to
  that relationship, including each ADR's title and current status.
- **FR-023**: The relationship view MUST provide a way to open each displayed ADR without requiring
  the user to search for it again.
- **FR-024**: When a relationship has no linked ADRs, the system MUST show a clear no-linked-ADRs
  state that is distinct from an error or unavailable-data state.
- **FR-025**: The system MUST prevent deletion of a diagram relationship with ADR links until
  each affected link is repaired or explicitly removed, and MUST identify the blocking ADRs to the
  user.
- **FR-026**: The system MUST identify ADR links to relationships that would be removed as a
  consequence of component deletion and MUST require those links to be repaired or explicitly
  removed before the component deletion proceeds.
- **FR-027**: The system MUST allow a user to change a component's name and save the change without
  changing the component's stable identity.
- **FR-028**: The system MUST allow a user to edit a relationship's label and direction, including
  reversing the source and target of a directed relationship and changing between directed and
  undirected modes where those modes are supported.
- **FR-029**: When a component name or relationship label and direction are edited, the system MUST
  preserve the edited artifact's stable identity, endpoints where they are not intentionally
  changed, and all ADR links to that artifact.
- **FR-030**: The system MUST reject a blank or whitespace-only component name with an actionable
  validation message and MUST keep the last valid name available for correction or retry.
- **FR-031**: The system MUST preserve component-name edits and relationship label and direction
  edits when the diagram is explicitly saved and later reopened.

### Key Entities *(include if feature involves data)*

- **Architecture Decision Record (ADR)**: A first-class architecture artifact containing a stable
  identity, title, context, decision, consequences, alternatives or constraints, lifecycle status,
  timestamps, zero or more component and relationship references, and a replacement ADR reference
  when its status is superseded.
- **Component Reference**: A link from an ADR to a specific diagram component identified by the
  component's stable identity, with enough information to show and navigate to the component.
- **Relationship Reference**: A link from an ADR to a specific diagram relationship identified by
  the relationship's stable identity, with enough endpoint or label information to show and navigate
  to the relationship.
- **Relationship**: A diagram connection with a stable identity, two component endpoints, a
  direction mode and, for directed relationships, an ordered source and target, plus an optional
  label.
- **Component ADR Summary**: The set of linked ADR titles and statuses shown when a user views a
  diagram component, with access to open each referenced ADR.
- **Relationship ADR Summary**: The set of linked ADR titles and statuses shown when a user views a
  diagram relationship, with access to open each referenced ADR.
- **ADR Status**: The lifecycle state of an ADR: draft, accepted, superseded, or rejected.
- **Diagram**: The existing software architecture artifact that owns the components and
  relationships eligible for ADR references.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create and save a complete ADR with no component or relationship links in under 3
  minutes without external instructions.
- **SC-002**: At least 95% of valid ADR save-and-reopen acceptance tests preserve all required
  content, status, timestamps, stable identity, and component or relationship references.
- **SC-003**: At least 95% of tested ADRs can be linked to zero, one, or multiple valid diagram
  components and/or relationships with the displayed references matching the selected artifacts.
- **SC-004**: At least 95% of tested component and relationship edits leave existing ADR references
  resolvable to the same artifacts.
- **SC-005**: 100% of tested missing-artifact or cross-diagram link attempts provide an actionable
  validation message and do not create a broken reference.
- **SC-006**: At least 90% of representative users complete the create, optionally link, save,
  reopen, and review workflow on their first attempt.
- **SC-007**: Users can determine an ADR's status, component-or-relationship-link state, and save
  outcome within 3 seconds of opening or completing the relevant action.
- **SC-008**: In 100% of tested backend-save failures, the user's edits remain available for retry,
  the ADR is visibly marked unsaved, and no completed-save state is falsely reported.
- **SC-009**: In 100% of tested component- or relationship-deletion attempts involving ADR links,
  deletion is blocked until the affected links are repaired or explicitly removed, and the blocking
  ADRs are identified.
- **SC-010**: In 100% of tested ADR save attempts, records missing a title, context, decision, or
  consequences are rejected with an actionable message, while records omitting alternatives or
  constraints can be saved when the other required fields are complete.
- **SC-011**: In 100% of tested component views, every linked ADR is shown with its title and
  current status, and each displayed ADR can be opened directly.
- **SC-012**: In 100% of tested component views with no linked ADRs, the user sees a clear
  no-linked-ADRs state rather than an empty or ambiguous panel.
- **SC-013**: In 100% of tested relationship views, every linked ADR is shown with its title and
  current status, each displayed ADR can be opened directly, and an unlinked relationship shows a
  distinct no-linked-ADRs state.
- **SC-014**: At least 95% of tested save-and-reopen cycles preserve component identities and
  updated names, relationship identities and updated labels or directions, and all existing ADR
  references remain resolvable to the same artifacts.
- **SC-015**: In 100% of tested component rename and relationship label or direction changes, the
  active diagram displays the requested update and no ADR link is silently removed or redirected.
- **SC-016**: In 100% of tested blank or whitespace-only component-name edits, the edit is rejected
  with an actionable message and the last valid name remains available.

## Assumptions

- The first release targets individual users working with one active diagram at a time; shared
  real-time editing and permission management are out of scope.
- An ADR can be created before its related diagram components or relationships are known, and
  artifact linking is optional rather than a save prerequisite.
- The existing diagram model provides stable component identities and retains them through normal
  rename and reposition operations, and provides stable relationship identities through normal
  label, endpoint, direction, and visual edits.
- Relationship direction consists of a directed or undirected mode; reversing a directed
  relationship changes its ordered source and target while preserving the relationship identity.
  Relationship labels are optional and may be cleared.
- This feature covers editing existing component names and relationship labels or direction when
  needed to maintain linked ADR context; broader diagram authoring behavior remains governed by
  the diagram feature specification.
- ADR import, export, templates, and bulk editing are out of scope unless added by a later feature.
- Component and relationship ADR summaries are shown for the currently viewed artifact in the
  active diagram; cross-diagram search and a separate ADR reporting view are out of scope.
- ADR data and history follow the project's existing storage, privacy, and recovery policies.
