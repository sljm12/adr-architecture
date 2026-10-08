# Feature Specification: C4 Component Diagrams

**Feature Branch**: `010-c4-component-diagrams`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Create a new branch. Based on the C4 model, create a Component subdiagram under a Container, similar to how Container diagrams were created under System Context. Follow the existing Container implementation and use double-click to enter and edit the Component diagram. Reference https://c4model.com/diagrams/component and https://c4model.com/abstractions/component."

## Clarifications

### Session 2026-10-08

- Q: If a Person or Software System shown in a Container diagram is also used in a Component child, what should happen when the author removes it from the Container diagram? → A: Block removal and identify the Component children using it; their supporting occurrences must be removed first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create or open a Component diagram from a container (Priority: P1)

An architecture author double-clicks an Application or Datastore in a Container diagram to create and enter its Component diagram. Selecting that container also exposes a visible create/open action, following the existing Software System-to-Container workflow. Subsequent visits reopen the same child.

**Why this priority**: This is the requested entry point and connects the existing architecture hierarchy to the new level.

**Independent Test**: Open a Container diagram containing an Application and a Datastore. Double-click the Application and use the selected-container action for the Datastore. Return and repeat both actions, confirming that each owner has exactly one child and that the original System Context-to-Container entry still works.

**Acceptance Scenarios**:

1. **Given** a saved internal Application or Datastore has no child, **When** the author double-clicks it, **Then** one Component diagram is created and opened with an empty boundary labeled with that container's name.
2. **Given** an eligible container is selected or its details are viewed, **When** no child exists, **Then** a keyboard-accessible "Create component diagram" action creates and opens its child; if an active child exists, the action reads "Open component diagram".
3. **Given** a container already owns a Component diagram, **When** entry is requested repeatedly, through either action, or while another request is pending, **Then** the same child opens and no duplicate is created.
4. **Given** the container or its parent has unsaved changes, **When** a child must be created, **Then** creation requires a successful parent save; cancellation or save failure keeps the current work and view intact.
5. **Given** creation or loading fails, **When** the author retries, **Then** an actionable error and progress feedback are provided and retry opens the canonical child without creating an additional diagram.
6. **Given** a Person, Software System, boundary, or internal C4 Component, **When** it is selected or double-clicked, **Then** it does not become the owner of a Component diagram; existing Software System-to-Container navigation continues to work.
7. **Given** a supporting container occurrence in a Component diagram, **When** the author requests its Component diagram, **Then** its source container's canonical child opens, using the source's original parent association.

---

### User Story 2 - Describe a container's components and interactions (Priority: P1)

An architecture author describes the functional building blocks inside one container, their responsibilities, implementation technologies, and interactions. Existing connected containers, people, and Software Systems provide context outside the boundary. A C4 Component represents related functionality behind an interface within its container, rather than a separately deployable application.

**Why this priority**: The child must communicate the container's internal architecture at the C4 Component level.

**Independent Test**: Model three components inside an Application, describe their responsibilities and technologies, add two internal interactions, and include a sibling Datastore plus an existing external Person or Software System. Confirm that internal components, supporting participants, and interactions remain distinguishable after saving and reopening.

**Acceptance Scenarios**:

1. **Given** a Component diagram is open, **When** an internal element is added, **Then** its type is "Component", a nonblank name, responsibility description, and technology are required, and it appears inside the owning container boundary with those details readable.
2. **Given** an internal component, **When** its details, position, or size change, **Then** it remains enclosed by the boundary and retains its identity and references; undo and redo restore ordinary component and relationship edits.
3. **Given** two internal components, or an internal component and a supporting participant, **When** the author connects them, **Then** a directed relationship with a required interaction description and optional technology or protocol is displayed.
4. **Given** the parent Container diagram contains a sibling Application or Datastore or an included Person or Software System, **When** the author includes it as a supporting participant and records an interaction with an internal component, **Then** it appears outside the boundary with its source-derived details and type and its own local layout.
5. **Given** a supporting participant, **When** the author moves it or edits its local interactions, **Then** the source's position and parent relationships remain unchanged; its source details can be edited through navigation to their owning diagram.
6. **Given** invalid component details, unsupported internal types, missing endpoints, a self-relationship, an external-to-external relationship, the owning container as a supporting participant, or a duplicate source occurrence, **When** the author submits the change, **Then** validation explains the violated rule and creates no partial artifact.
7. **Given** navigation among System Context, Container, and Component diagrams, **When** the add/edit workflow is opened, **Then** it offers the types for the current level: existing context choices, Application/Datastore at Container level, and Component at Component level; previously selected types do not leak across levels.

---

### User Story 3 - Navigate and save the three-level hierarchy (Priority: P2)

An architecture author moves from System Context to Container to Component and back, saves work under the correct parent, and continues later. The Component diagram follows its owning container's name and remains a separate child of its original Container diagram.

**Why this priority**: The new level must fit the existing navigation and persistence workflow without losing scope or replacing parent content.

**Independent Test**: Enter a Component diagram through its container, edit and save twice, return through both ancestor levels, and reopen after refresh and through the diagram list. Rename its owner, exercise undo/redo/discard, and verify that the child's title follows the owner while its identity, parent association, content, and links remain unchanged.

**Acceptance Scenarios**:

1. **Given** a Component diagram is open, **When** its heading and navigation are reviewed, **Then** "Component diagram", its owning container, owning Software System, and parent Container diagram are identifiable; returning to the parent selects the owning container.
2. **Given** unsaved diagram or ADR work at any level, **When** the author navigates away, **Then** the existing save/discard/cancel behavior applies; cancellation or failed saving preserves the draft and current view.
3. **Given** Component diagrams in the saved list, **When** the author browses or filters it, **Then** children appear beneath their Container diagrams in the System Context hierarchy, with enough owner and ancestor identification to disambiguate matching names.
4. **Given** a Component diagram is saved repeatedly or after opening from the list or refresh, **When** the save completes, **Then** the same child identity, level, owner, and original parent association are retained; no top-level "Parent Diagram" entry, duplicate child, or replacement of ancestor content is produced.
5. **Given** the owning container is renamed, moved, resized, or switched between Application and Datastore, **When** its child is reopened, **Then** the child remains associated with that container and shows the current name; its title is read-only and follows the owner.
6. **Given** a draft owner rename, **When** the author reviews the saved list or uses undo, redo, or discard, **Then** the visible child title follows the corresponding draft name; failed saves preserve the draft preview and successful saves reconcile the saved name without replacing newer edits.
7. **Given** two containers with identical names in the same or different Container diagrams, **When** their children are saved and reopened, **Then** each opens under its own owner and ancestors with no merging or reassignment.
8. **Given** a supporting participant's source is renamed, **When** the child reloads or its source details are refreshed, **Then** the current source details appear without changing occurrence identities, local layouts, relationships, or ADR links.

---

### User Story 4 - Record decisions and recover the nested architecture safely (Priority: P2)

An architecture author links decisions to components and interactions and manages deletion and recovery across all three levels. Dependency checks and confirmed trash/restore operations protect architectural knowledge.

**Why this priority**: The new diagram level must preserve the project's existing reference and recovery guarantees.

**Independent Test**: Link and supersede a Component-level ADR, reopen it, exercise source and owner deletion blockers, trash and restore a Component diagram independently, and trash and restore each ancestor with active and previously trashed descendants.

**Acceptance Scenarios**:

1. **Given** internal components, supporting occurrences, and their relationships, **When** ADRs are created, linked, reviewed, or superseded, **Then** existing decision workflows work with those exact artifacts and links survive rename, movement, save, refresh, and reopen; ancestor ADR links are not automatically copied.
2. **Given** a container owns an active or recoverable Component diagram, **When** deletion or reclassification to a non-container is attempted, **Then** the action is blocked and identifies the dependent child and how to resolve it; switching between Application and Datastore remains permitted.
3. **Given** a source is used by an active or recoverable supporting occurrence, **When** deletion or a change to an unsupported source type is attempted, **Then** the action is blocked and identifies dependent occurrences; existing source, occurrence, interaction, and ADR data remain unchanged. This includes removing a Person or Software System occurrence from the parent Container diagram while a Component child uses it: the error identifies the affected children and the child occurrences that must be removed first, even if the original System Context element still exists.
4. **Given** a System Context or Container diagram with active descendants and descendants already in trash, **When** moving the ancestor to trash is confirmed, **Then** the confirmation names all affected active descendants, those descendants become unavailable, and restoration returns exactly the diagrams affected by that operation; previously trashed descendants remain trashed.
5. **Given** an independently trashed Component diagram, **When** its owner is selected or double-clicked, **Then** restoration is offered instead of creating a replacement; confirmed restoration preserves the original child and its references.
6. **Given** restoration of a child is requested while an ancestor is trashed, **When** recovery is presented, **Then** it identifies the required ancestors and affected descendants before confirmation; restoration never activates a child beneath an inactive ancestor and respects independently trashed descendants.
7. **Given** a destructive action or recovery confirmation is canceled or fails, **When** the author continues working, **Then** no false success is shown, unsaved work is retained, and no partial trash/restore result is committed.
8. **Given** a component, occurrence, or relationship with linked ADRs, **When** removal is requested, **Then** the existing confirmation and reference-protection rules identify the affected decisions; canceling leaves all artifacts and links intact.

---

### User Story 5 - Share Component diagrams through existing exports (Priority: P2)

An architecture author uses existing exports to share Component-level architecture and its decisions. Interactive HTML packages retain the established parent/child browsing behavior through the new level.

**Why this priority**: Sharing must preserve the scope and decisions of the new architecture level without silently dropping its content.

**Independent Test**: Export a populated Component diagram through the existing single-diagram formats and export an interactive HTML package from each hierarchy level. Verify scope, layout, details, exact ADR links, active descendants, parent navigation, and actionable failure for an invalid required child.

**Acceptance Scenarios**:

1. **Given** a valid Component diagram, **When** an existing single-diagram export is requested, **Then** it preserves container scope, boundary, internal components, supporting participants, displayed details, relationships, and the ADR content and references required by that format, or rejects unsupported content with a specific validation error.
2. **Given** a System Context diagram with active Container and Component descendants, **When** its interactive HTML package is exported, **Then** all active descendants are included and readers can open Container and then Component diagrams and return through the included parents while retaining exact artifact-to-ADR selection and browsing.
3. **Given** a selected Container diagram, **When** its interactive HTML package is exported, **Then** it opens that Container diagram and includes its active Component children without automatically including its System Context parent or sibling Container diagrams; selecting a Component diagram exports that child alone.
4. **Given** absent, trashed, or out-of-package children or source owners, **When** a reader explores the package, **Then** no broken navigation or creation/restoration action is offered and existing ADR selection still works.
5. **Given** a required included diagram or reference is invalid or cannot be loaded, **When** export is requested, **Then** the whole export fails with an actionable error identifying the affected diagram/artifact and no incomplete package is reported as successful.
6. **Given** retained unsaved diagram and ADR drafts, **When** an interactive package is exported, **Then** the existing draft-capture behavior applies at every included level, source-derived names match the captured ancestors, and export does not save or modify the editing session.
7. **Given** an extracted interactive package, **When** readers open it directly from disk without an application connection in the currently supported browsers, **Then** Component rendering, keyboard navigation, decision browsing, and the existing stylesheet customization work as they do for Container diagrams.

### Edge Cases

- Rapid or overlapping creation requests, retry after a lost response, and reopening after a failed post-creation load must reuse the existing child.
- Duplicate owner names across ancestors do not determine identity or change list placement.
- A parent save succeeds but navigation fails: saved content remains saved and retry opens the same child; a failed parent save never creates the child.
- An empty Component diagram remains valid and shows its named container boundary.
- Boundary expansion must keep internal components enclosed and reposition overlapping supporting occurrences outside it with visible spacing; directly placing a supporting occurrence inside is rejected.
- Inclusion copies neither ancestor relationships nor ADR links and does not invent component interactions. Supported source candidates need not already have an ancestor-level relationship because Component-level interactions are authored explicitly.
- A supporting Person or Software System in the parent Container diagram may itself reference System Context: its Component-level occurrence must retain the resolvable source chain and current source details. Removing the intermediate Container-level occurrence is blocked while active or recoverable Component children use it; the original System Context element remaining available does not bypass this dependency or automatically retarget child occurrences.
- A broken owner, ancestor, or supporting source reference must be identified; the diagram cannot be saved or exported as a valid complete artifact while that reference remains broken.
- Undo must not remove or invalidate an owner or source that acquired an active or recoverable dependent child/occurrence after that editing history was recorded.
- Trashing one Component diagram does not trash its parent or siblings. Trashing an ancestor covers active descendants at both lower levels and preserves independent trash history.
- Recovery requested through a deeply nested child must honor required ancestors and separate prior trash operations; cancellation leaves every status unchanged.
- Existing diagrams without Component children must retain their types, content, ADRs, hierarchy, and export behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authors MUST be able to create/open a Component diagram by double-clicking an internal Application or Datastore in a Container diagram, following the existing Software System-to-Container interaction. A plain click MUST continue to select the element.
- **FR-002**: Eligible selected/viewed containers MUST expose keyboard-accessible "Create component diagram", "Open component diagram", or "Restore component diagram" actions according to child availability, with progress, success, and actionable failure/retry feedback.
- **FR-003**: Each Component diagram MUST have its own stable identity and exactly one owning container in exactly one parent Container diagram. An owner MUST have at most one active or recoverable Component child; overlapping requests and retries MUST reuse it. Source-linked supporting containers MUST resolve to that same canonical child and parent.
- **FR-004**: Application and Datastore MUST be eligible owners. People, Software Systems, boundaries, and internal C4 Components MUST NOT be eligible owners of Component diagrams. Existing Software System-to-Container navigation MUST remain available, including supported external source occurrences.
- **FR-005**: Before first child creation, unsaved owning-container and parent changes MUST be saved successfully through the existing workflow. A canceled or failed save MUST preserve the draft and current view and MUST NOT create a child. A failed child load after creation MUST permit retry of that same child.
- **FR-006**: A Component diagram MUST describe the internals of one container and show a single labeled container boundary enclosing all internal components. Supporting participants MUST remain outside it. Boundary expansion MUST reposition overlapping supporting occurrences outside with visible spacing while preserving references; direct invalid placement MUST be rejected.
- **FR-007**: Authors MUST be able to add, edit, position, resize, and remove internal C4 Components with stable identities, nonblank names, responsibilities, and technology values. Names, the "Component" type, responsibilities, and technologies MUST be readable. Internal creation and type editing MUST allow only Component, distinct from Container-level Application/Datastore and context-level types, including after navigation.
- **FR-008**: Authors MUST be able to create, edit, and remove directed relationships between two different internal components or between an internal component and a supporting participant. Relationships MUST retain stable endpoint identities, require nonblank interaction descriptions, and display any optional supplied protocol or technology. Self-links, boundary endpoints, missing endpoints, and supporting-to-supporting relationships MUST be rejected.
- **FR-009**: Authors MUST be able to include sibling Application/Datastore containers and existing Person/Software System occurrences from the immediate parent Container diagram as supporting participants. Each occurrence MUST have a stable local identity, resolvable source identity, source-derived details and type, and independent local layout. A supporting Person/Software System MUST retain both its immediate Container-level source occurrence identity and the resolvable canonical source chain to System Context. The owner itself and duplicate occurrences of the same canonical source MUST be rejected. Parent relationships and ADR links MUST NOT be copied automatically.
- **FR-010**: Supporting details MUST reflect current source data on load or explicit source refresh, resolving existing ancestor source chains. Source details MUST be edited in their owning diagram; a navigation action MUST identify that diagram. Local layout and interactions MUST NOT modify source layout or ancestor relationships.
- **FR-011**: Headings and navigation MUST identify Component level, owning container, parent Container diagram, and owning Software System. Return-to-parent navigation MUST open the immediate parent and select the owning container. Save/discard/cancel protection MUST apply to unsaved diagram and ADR work during all hierarchy navigation.
- **FR-012**: The existing diagram list MUST display Component children beneath their Container parents within the System Context hierarchy. Labels and filtered results MUST retain owner and ancestor context sufficient to distinguish matching names; Component children MUST NOT become top-level parent entries.
- **FR-013**: Saving MUST update the same Component child and preserve its original parent, owner, level, and separate content, regardless of entry point. Repeated saves, save-before-navigation, refresh, and list entry MUST NOT create duplicates, assign the generic "Parent Diagram" classification/name, or replace ancestor architecture content. Failed saves MUST preserve draft content and association for retry.
- **FR-014**: Component titles MUST be read-only and follow the owning container's current name, using identity rather than text to resolve ownership. List previews MUST reflect draft owner renames before filtering/sorting and respond to undo/redo/discard. Load, list, availability, create/open, recovery, and export MUST show the corresponding saved owner name; successful save reconciliation MUST preserve newer drafts. Rename synchronization MUST NOT change child identity, creation time, or content/layout or count as a separate user edit to the child.
- **FR-015**: Diagram, component, occurrence, relationship, and ADR identities MUST remain stable UUIDs. Owner/ancestor associations, details, layout, source references, relationships, ADR content, and links MUST persist through save, refresh, reopen, rename, and movement. Switching an owning container between Application and Datastore MUST retain its child.
- **FR-016**: Ordinary internal-component, occurrence-layout, relationship, and ADR edits MUST use the existing undo/redo workflow without changing identities or introducing broken references. History operations affecting owners or sources MUST obey current dependency protections.
- **FR-017**: Existing ADR creation, lifecycle, linking, count, and review workflows MUST work for Component-level internal elements, supporting occurrences, and relationships. Links MUST resolve to the exact stable artifacts in their diagram. Ancestor ADR links MUST NOT be inherited automatically.
- **FR-018**: Deleting an owner or reclassifying it to a non-container MUST be blocked while an active or recoverable Component child depends on it. Deleting a supporting source or changing it to an unsupported source type MUST be blocked while active or recoverable occurrences depend on it. Removing a Person/Software System occurrence from the immediate parent Container diagram MUST likewise be blocked while active or recoverable Component children reference that occurrence, even when its original System Context source still exists. The error MUST identify every affected child and the dependent occurrences that must be removed first; the operation MUST NOT automatically cascade removal or retarget them directly to System Context. Errors MUST identify dependent diagrams/occurrences and the next corrective action, leaving existing artifacts and links intact.
- **FR-019**: Confirmed trash of a System Context or Container diagram MUST identify and deactivate all active descendants, including Component diagrams. Restoration MUST preserve identities and references and restore exactly the diagrams affected by that operation, leaving descendants previously trashed independently in trash. Independently trashing a Component diagram MUST leave ancestors and siblings active.
- **FR-020**: A recoverable child MUST be restored rather than replaced through owner entry actions. Restoring beneath inactive ancestors MUST require confirmed restoration of the necessary ancestors and affected descendants while respecting independent prior trash operations. No child MUST become active beneath an inactive ancestor. Canceled or failed trash/restore MUST NOT commit partial status changes or discard drafts.
- **FR-021**: Removing components, supporting occurrences, or relationships MUST follow existing confirmation and ADR reference-protection rules. Cancellation MUST retain artifacts and links. Broken owner, ancestor, source-chain, and endpoint references MUST be surfaced with actionable errors and MUST prevent saving/exporting an invalid complete artifact.
- **FR-022**: Existing single-diagram exports MUST preserve Component scope, boundary, internal elements, supporting participants, displayed metadata, layout, relationships, and ADR information required by each format. Unsupported or invalid content MUST fail clearly without silent omission; a single-diagram snapshot MUST NOT claim to bundle ancestors or descendants.
- **FR-023**: Existing interactive HTML export MUST extend its established hierarchy behavior: a System Context package includes its active Container and Component descendants; a Container package includes its active Component children; a Component package contains that child alone. Packages MUST open at the selected level, preserve exact ADR selection/browsing and draft capture, and offer parent/child or canonical-source navigation only to included diagrams. Trashed descendants MUST be excluded. Required invalid/unavailable content MUST fail the complete export. Existing direct-from-disk browser support, keyboard access, and stylesheet customization MUST continue to work.
- **FR-024**: Existing System Context and Container diagrams MUST continue to load, edit, save, group where supported, navigate, link ADRs, recover, and export without reclassification or data loss. Adding the new level MUST NOT alter existing Application/Datastore choices or Software System ownership rules.
- **FR-025**: Core creation, editing, navigation, validation, and recovery MUST support keyboard use, readable labels, visible focus, accessible contrast, and clear status feedback consistent with the existing editor. Diagram level, internal/supporting roles, and scope MUST be distinguishable without color alone.

### Key Entities

- **Owning Container**: An identified Application or Datastore inside a Container diagram, owning at most one active or recoverable Component child.
- **Component Diagram**: An independently identified child with Component level, owner-derived title, immediate parent/owner association, ancestor context, container boundary, internal elements, supporting occurrences, relationships, layout, and local ADRs.
- **C4 Component**: Related functionality encapsulated behind an interface within one container; described by identity, name, responsibilities, technology, and local layout. It is not a separately deployable container or a code-level class diagram.
- **Supporting Participant Occurrence**: A locally identified representation of a sibling container or an existing Person/Software System from the parent, retaining its immediate parent source identity, canonical source chain, and local relationship/ADR targets. A Person/Software System occurrence depends on both its Container-level source occurrence and its original System Context source.
- **Component Relationship**: An identified directed interaction with stable local endpoints, an interaction description, and optional communication technology/protocol.
- **Container Boundary**: The labeled enclosure of the owner's internal components; distinct from Software System boundaries and organizational system groups.
- **ADR Artifact Link**: An existing association between a local decision and identified elements/relationships, preserving decision lifecycle and scope.
- **Diagram Hierarchy and Recovery Impact**: Identity-based System Context-to-Container-to-Component associations and the exact set of diagrams affected by a confirmed trash/restore operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time authors in usability validation create and enter a Component diagram within 30 seconds of seeing a saved eligible container, using double-click or the visible action without separate instructions.
- **SC-002**: In 100% of repeated, overlapping, retry, duplicate-name, and supporting-source entry cases, exactly the intended owner's canonical child opens with no duplicate or reassignment.
- **SC-003**: An author can model three components with responsibilities and technologies, two internal interactions, and one supporting-container interaction, then save and reopen the result within five minutes using the existing editing patterns.
- **SC-004**: In 100% of save/reopen, repeated-save, list-entry, rename, undo/redo/discard, and failed-save/retry validation cases, child identities, parent associations, layouts, relationships, and ADR links remain correct and no ancestor content is replaced.
- **SC-005**: In 100% of level-switching validation cases, internal creation offers only the allowed types for the current level; Component diagrams offer Component and Container diagrams retain Application/Datastore.
- **SC-006**: Every tested owner/source deletion blocker, boundary violation, invalid relationship, broken reference, cancellation, and failed operation explains the corrective action and preserves existing data without false success.
- **SC-007**: In 100% of independent-child and ancestor trash/restore cases across all three levels, the exact affected set is recovered with stable content and links; previously trashed descendants remain trashed and no active child has an inactive ancestor.
- **SC-008**: All required create/open, edit, save, parent-return, ADR-link, and recovery workflows can be completed using only the keyboard and convey level/scope without relying on color.
- **SC-009**: In all representative supported export cases, Component scope, details, relationships, and required ADR links are preserved. Interactive packages include exactly the active descendants specified for their entry level and all offered diagram/ADR links work without an application connection in the existing supported browsers.
- **SC-010**: All existing System Context and Container workflow regression cases remain successful without data loss, changed ownership, or changed level-specific type choices.

## Assumptions

- This feature specifies one canonical Component diagram per container, matching the existing one-child-per-Software-System Container workflow. Alternative views for the same owner are outside scope.
- Both Application and Datastore are eligible containers. Component diagrams are optional: no child is created until the author requests one, and an empty child is valid.
- "Component" means the C4 abstraction within a container. The product's older generic use of "component" for a diagram element does not make Software Systems, people, or containers internal C4 Components.
- A new Component diagram starts with an empty named container boundary. Internal components use one Component type; arbitrary subtypes, separate deployment units, Code diagrams, and deeper drill-down are outside scope.
- Following the Container implementation includes a selected-element keyboard action, source-aware canonical entry, owner-derived read-only naming, stable child saves, hierarchical listing, source refresh, editing history, local ADRs, dependency checks, and recoverable trash.
- Supporting participants are selected from the immediate Container parent. New containers, people, and Software Systems are created in their existing owning level first. Existing source chains are preserved; unrelated diagrams are not a new participant catalog.
- Component-level relationships are authored explicitly. Choosing a supporting participant does not require an existing ancestor-level interaction and never copies one automatically.
- The existing save, discard, cancel, undo/redo, ADR lifecycle, deletion safeguards, and recovery policies remain dependencies. Authentication, permissions, workspaces, collaboration, offline application editing, and advanced revision history are outside scope.
- Existing export capabilities are extended to recognize the new level, including the already-supported interactive HTML parent/child packages. New export formats, new import workflows, automated source-code discovery, and automated diagram generation are outside scope.
- Interface work will follow `DESIGN.md` and the existing Container editor patterns rather than introducing a new visual system.
- Implementation validation must cover both entry points; permitted types and C4 rendering; invalid details/endpoints/source chains; stable saves and rename previews; ADR lifecycle/link integrity; three-level navigation and recovery; persistence compatibility for existing artifacts; and representative single-diagram and interactive exports. This checklist validates requirements quality, not implementation completion.

### Reference Guidance

- [C4 Component diagram](https://c4model.com/diagrams/component): Establishes the single-container scope, its internal components, and supporting containers, people, and Software Systems directly connected to them.
- [C4 Component abstraction](https://c4model.com/abstractions/component): Defines components as related functionality encapsulated behind an interface inside a container; deployment belongs to the container.
- [Existing Container specification](../009-c4-container-diagrams/spec.md): Establishes the corresponding create/open, ownership, naming, editing, navigation, save placement, source, ADR, and recovery behaviors.
- [Existing interactive HTML export specification](../007-export-interactive-html/spec.md): Establishes package interactivity, included-child navigation, scoped ADR browsing, draft capture, and portable browser behavior to retain at Component level.
