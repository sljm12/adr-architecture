# Feature Specification: Export Interactive HTML Package

**Feature Branch**: `007-export-container-diagrams`

**Created**: 2026-09-23

**Updated**: 2026-10-06

**Status**: Draft

**Input**: User description: "The user would want to be able to export a HTML version of the diagram and architecture decision records. The HTML version should be able to click on the components and relationships and show the ADRs that are tied to it. There should also be a page where the user can browse all the ADRs. The CSS for the HTML should be done such that the user can change the line and fill colors of the components. The diagram prefably should be in SVG so that the user can use in SVG editors and the ADRs in markdown. The whole things should be downloadable as a ZIP package."

**Update Input**: "Besides exporting the main diagram, also export the container diagrams. Selecting a System context diagram for export should include its sub container diagrams. Readers should be able to click from the System into the container while preserving all previously specified interactivity."

## Clarifications

### Session 2026-10-06

- Q: Which desktop browsers must support the exported package when opened directly from disk? → A: Chrome, Edge, Firefox, and Safari.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export and explore an architecture package (Priority: P1)

An architecture author downloads a portable package for the active diagram and opens its HTML entry page to share or review the architecture. When the active diagram is a System context diagram, the same package includes every active container diagram owned by its Software Systems. Readers can move from a Software System to its container diagram and back to the System context without access to the application. In every included diagram, selecting a component or relationship shows the ADRs linked to that exact artifact, including their titles, statuses, and full decision content.

**Why this priority**: Reviewers need to move directly from the architecture to the decisions that explain it.

**Independent Test**: Export a System context diagram with two active child container diagrams, a system with no child, and component-linked, relationship-linked, and unlinked ADRs in the parent and children. Open the extracted package without the application or network access; navigate into each child and back, and verify that every selection shows exactly its directly linked ADRs.

**Acceptance Scenarios**:

1. **Given** a valid diagram with named components, labeled relationships, and ADR links, **When** the author exports it and opens the extracted HTML entry page, **Then** the diagram displays its components, relationships, labels, direction, and layout, and the package works without an application connection.
2. **Given** an ADR linked to a component, **When** a reader selects that component, **Then** the page shows that ADR's title and status and lets the reader open its full content.
3. **Given** an ADR linked to a relationship, **When** a reader selects that relationship, **Then** the page shows the ADR linked to that relationship, even when the ADR is not linked to either endpoint component.
4. **Given** multiple ADRs linked to the same artifact, **When** a reader selects it, **Then** each linked ADR appears exactly once and no unrelated ADR appears.
5. **Given** a component or relationship without ADR links, **When** a reader selects it, **Then** the page clearly says that no ADRs are linked.
6. **Given** a System context diagram with multiple active child container diagrams, **When** the author exports it, **Then** one ZIP contains the parent and every active child with their complete diagram content and ADRs, and its entry page opens the selected System context diagram.
7. **Given** a Software System with an included container diagram, **When** a reader selects the system, **Then** its directly linked ADRs remain available and a visible, keyboard-accessible "Open container diagram" action opens the correct child without requiring a double-click.
8. **Given** a reader viewing an exported child, **When** they use its parent navigation, **Then** they return to the owning Software System in the exported System context diagram; the child identifies its container level and owning system throughout.
9. **Given** an included child containing applications, data stores, external participants, and directed interactions, **When** a reader opens it, **Then** its owning-system boundary, names, types, responsibilities, technologies, relationship descriptions, optional protocols, and layout are preserved, and its components and relationships retain the same ADR selection and browsing behavior as the parent.
10. **Given** a system with no child or only a trashed child, **When** a reader selects it, **Then** its ADR interaction still works, no broken child link or creation/restoration action appears, and the absence of an included active child is explained.
11. **Given** an included child with an external Software System occurrence whose source owns another included child, **When** a reader opens that occurrence's container diagram action, **Then** the source's existing child opens, and selection of the occurrence still shows only ADRs directly linked to that occurrence.
12. **Given** a directly selected container diagram, **When** the author exports it, **Then** the package opens that child with its complete content and ADR interactions, without automatically bundling its parent or siblings or offering links to diagrams outside the package.
13. **Given** a required active child cannot be loaded or has an invalid ownership, source, endpoint, or ADR reference, **When** the author exports its System context, **Then** the entire export fails with an actionable error identifying the affected diagram and artifact, and no incomplete ZIP is reported as successful.
14. **Given** unsaved parent or child diagram and ADR edits retained in the current editing session, **When** the author exports the System context, **Then** the package captures those drafts and the latest saved state of included diagrams without retained drafts, owner/source display details reflect the captured parent, and exporting neither saves nor changes the editing session.
15. **Given** an extracted parent-and-container package, **When** a reader opens it directly from disk in each required desktop browser with network access disabled, **Then** diagram rendering, parent/child and external-source navigation, exact ADR selection and browsing, keyboard access, and stylesheet customization work using normal browser settings, including after relocating the extracted directory.

---

### User Story 2 - Browse every ADR in the export (Priority: P1)

A reader opens the package's dedicated ADR browser page to review all decisions across its included diagrams, including decisions with no diagram links. Each decision identifies its diagram scope. Readers can move between a decision and its linked components or relationships in the correct parent or child diagram.

**Why this priority**: A complete decision catalog prevents unlinked, rejected, or superseded decisions from disappearing from review.

**Independent Test**: Export a System context and two children containing linked and unlinked ADRs in multiple lifecycle states, including duplicate titles and artifact names across diagrams; open the ADR browser and confirm that every ADR appears once and all references locate the correct diagram and artifact.

**Acceptance Scenarios**:

1. **Given** included diagrams with linked and unlinked ADRs, **When** a reader opens the ADR browser, **Then** every ADR belonging to every included diagram appears exactly once with its title, status, and diagram scope.
2. **Given** an ADR in the browser, **When** a reader opens it, **Then** its context, decision, consequences, alternatives or constraints, status, and available dates are readable.
3. **Given** an ADR linked to components or relationships, **When** a reader follows a linked reference from any exported page, **Then** the correct included diagram opens and the exact linked artifact is located, even when another diagram has an artifact with the same name.
4. **Given** an ADR with no links, **When** a reader views it, **Then** its content remains accessible and its unlinked state is clear.
5. **Given** a parent Software System and a child container or external occurrence, **When** a reader selects either artifact, **Then** the displayed ADRs follow that artifact's own links; source or parent ADRs are not automatically inherited by child artifacts.

---

### User Story 3 - Reuse and restyle exported artifacts (Priority: P2)

An author uses each exported diagram in an SVG editor, uses the ADR files in a Markdown workflow, and adjusts component outline and fill colors across the package's HTML diagrams through the documented stylesheet settings without redrawing diagrams.

**Why this priority**: Portable, editable artifacts let architecture documentation fit existing review and publishing workflows.

**Independent Test**: Extract a parent-and-children package, open every standalone diagram in an SVG editor and parent and child ADR files in a Markdown viewer, change the documented component color settings, and verify the parent and child HTML views and their navigation.

**Acceptance Scenarios**:

1. **Given** an exported package, **When** the author opens the separate standalone SVG for any included diagram in an SVG editor, **Then** component shapes, relationships, labels, grouping, and any owning-system boundary visible in that HTML diagram are present as editable vector content.
2. **Given** an exported package, **When** the author opens a parent or child ADR Markdown file, **Then** its title, status, decision fields, diagram scope, and references to the exact diagram artifacts are readable without the HTML view.
3. **Given** the package stylesheet, **When** the author changes its documented component outline and fill color settings, **Then** reopening each included HTML diagram shows the chosen colors without changing diagram structure, parent/child navigation, or ADR links.

### Edge Cases

- A package with no ADRs across its included diagrams still exports an ADR browser with a clear empty state; an individual diagram with no ADRs reports no linked ADRs on component and relationship selection even when other included diagrams have decisions.
- An empty diagram exports only if it is otherwise valid, and the HTML view explains that it has no components or relationships.
- Duplicate names, empty optional relationship labels, non-Latin text, punctuation, and reserved markup characters remain readable and cannot change the identity of links or execute as page content.
- A relationship-linked ADR appears when that relationship is selected, whether or not its endpoint components have ADR links.
- Renamed or repositioned components and edited relationships retain their links through stable identities in the export.
- A missing endpoint, broken ADR reference, unsupported visual element, or content that cannot be represented safely stops the export with an actionable error identifying the affected artifact; no incomplete package is presented as successful.
- If the author has unsaved edits, the export reflects the current visible diagram and ADR state and does not silently substitute an older saved version.
- If a package is moved to another directory or computer after extraction, its internal navigation and styling continue to work without network access.
- A System context with no active children retains the existing single-diagram export behavior. A valid empty child is included with its labeled owning-system boundary and explicit empty states.
- Trashed children are deliberately excluded and distinguished from missing or unreadable active children; export does not restore diagrams or create a child for a system with none.
- Systems, child titles, artifact names, and ADR titles may repeat; stable diagram, owner, artifact, and ADR identities determine navigation and prevent file collisions or duplicate entries.
- Renaming or grouping a Software System does not detach its child; the exported child title and boundary use the owning system name from the captured parent snapshot.
- External participant occurrences preserve their own identities and ADR links while resolving source display details against the captured parent. Repeated references to a system do not duplicate its child in the ZIP.
- An external source without a child in the package remains readable and selectable but has no navigation link outside the package. Child-to-sibling links do not expand the export scope or cause cyclic inclusion.
- A required child load fails, an active child has broken ownership, or any included diagram cannot be represented safely: the entire export fails, identifying the affected diagram and artifact rather than returning a parent-only package.
- Diagram changes made after the export snapshot is captured do not partially replace captured content. A snapshot that cannot retain resolvable ownership and source references fails with a retry instruction.
- A package-wide ADR browser may contain decisions from several diagrams; identical titles do not merge decisions, and a child with no ADRs still has a clear local empty state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the author export the active diagram and all ADRs belonging to it as one downloadable ZIP package, with clear success or failure feedback. When the active diagram is a System context diagram, the same package MUST also include every active container diagram owned by Software Systems in that context and all ADRs belonging to those children.
- **FR-002**: The package MUST contain an HTML entry page that works after extraction without an application connection or external network resources.
- **FR-003**: Each included diagram's HTML view MUST display every supported component, relationship, group, label, direction, and layout without silently omitting artifacts. Container views MUST also preserve their owning-system boundary, internal Application/Datastore types, responsibilities, technologies, external participants, interaction descriptions, and any supplied communication protocols.
- **FR-004**: Readers MUST be able to select each component and relationship by pointer and keyboard and see only the ADRs directly linked to that artifact, identified by title and status, with a way to read each ADR in full.
- **FR-005**: When a selected component or relationship has no linked ADRs, the HTML view MUST show an explicit empty state.
- **FR-006**: The package MUST provide a dedicated HTML ADR browser page that lists all ADRs belonging to all included diagrams exactly once, including unlinked, draft, accepted, superseded, and rejected ADRs, identifies each ADR's diagram scope, and lets readers open each one.
- **FR-007**: Each exported ADR view MUST show its available context, decision, consequences, alternatives or constraints, status, dates, diagram scope, and linked component and relationship references; linked references MUST open the correct included diagram and locate the exact corresponding artifacts.
- **FR-008**: The package MUST include a separate standalone SVG representation of every included diagram that can be opened independently in a standard SVG editor and retains the same supported diagram content as its HTML view.
- **FR-009**: The package MUST include a separate Markdown file for every ADR in every included diagram, retaining its decision fields, status, dates, diagram scope, and stable references to linked components and relationships, including when an ADR has no links.
- **FR-010**: The package MUST include a documented CSS stylesheet with straightforward settings for changing component outline and fill colors across all included HTML diagrams; changing those settings MUST NOT break diagram interactions, parent/child navigation, or ADR references.
- **FR-011**: Exported navigation and cross-references MUST use stable artifact identities rather than names or screen positions, so duplicate names and ordinary edits do not confuse links.
- **FR-012**: The export MUST capture an immutable snapshot of the selected diagram, included children, and their ADRs, including unsaved drafts retained in the current editing session and the latest saved state retrieved during export for included diagrams without such drafts. Later edits MUST NOT partially replace captured content. Export MUST NOT change or save any diagram or ADR as a side effect.
- **FR-013**: Before download, the system MUST validate every included diagram, ADR, ownership association, external participant source, and artifact link. Failure to load a required active child, or any missing, unsupported, or unsafe content, MUST stop the entire export with an actionable error identifying the affected diagram and artifact instead of silently dropping content or reporting a partial package as successful.
- **FR-014**: Exported user-authored text MUST be displayed as content, not interpreted as executable page markup or code.
- **FR-015**: The HTML view MUST provide readable labels, visible keyboard focus, and sufficient contrast for its default colors; diagram selection and ADR browsing MUST be usable without a pointer.
- **FR-016**: A System context export MUST discover children through stable owning-system and parent-diagram identities, include each active child exactly once, and exclude trashed children and diagrams outside that context. Renaming, repositioning, resizing, grouping, or duplicate names MUST NOT change which child belongs to which Software System.
- **FR-017**: The HTML entry page MUST open the selected diagram. In a bundled System context, each Software System with an included child MUST expose a visible, pointer- and keyboard-accessible "Open container diagram" action from its selected artifact details. Selecting the system MUST continue to expose its directly linked ADRs, including an explicit empty state when none exist.
- **FR-018**: Every bundled container view MUST identify its container level and owning Software System and provide a pointer- and keyboard-accessible return action to its parent context and owning system. Navigation MUST stay within the extracted package and work without the application or network access.
- **FR-019**: Component and relationship ADR selection, full ADR reading, empty states, ADR-to-artifact navigation, standalone SVGs, ADR Markdown files, and stylesheet customization MUST apply to every included container diagram with the same behavior specified for the parent. Parent/source ADR links MUST NOT be automatically inherited by child containers, relationships, or external occurrences.
- **FR-020**: An external Software System occurrence in an included child MUST expose navigation to its source's child only when that child is already included in the package. This action MUST resolve through the stable source identity; selecting the occurrence MUST retain its own local ADR links. Such navigation MUST NOT add unrelated diagrams or duplicate already included children.
- **FR-021**: Systems without an included active child MUST retain their existing artifact and ADR interactions and show an explanation that no active container diagram is included. The package MUST NOT expose broken child links, live-application links, or actions that create or restore diagrams.
- **FR-022**: Direct export of a container diagram MUST remain supported as a complete single-diagram package, without automatically including its parent or siblings. Its scope and owner MUST be identified, and navigation to diagrams absent from that package MUST NOT be offered.
- **FR-023**: Exported child titles, boundary headings, and external participant display details MUST resolve from the captured parent and source identities, including captured parent drafts when available. Artifact identities, child layouts, and ADR associations MUST remain unchanged. Navigation destinations and file references MUST remain unambiguous when diagrams, artifacts, or ADRs have identical names.
- **FR-024**: A System context with no active children and existing diagrams without container associations MUST retain their existing complete single-diagram export behavior. Extending the HTML ZIP scope MUST NOT change the scope of separate Mermaid or standalone SVG export actions.
- **FR-025**: Extracted HTML packages MUST support Chrome, Edge, Firefox, and Safari desktop browsers when opened directly from disk using normal browser settings without network access. All specified diagram, ADR, parent/child navigation, keyboard, styling, and relocation behavior MUST work in each required browser without a local web server or browser security-setting changes.

### Key Entities *(include if feature involves data)*

- **Export Package**: A portable snapshot of the selected diagram, its included active children when it is a System context, all their ADRs, and the files and internal navigation needed to browse them independently.
- **System Context Diagram**: The selected parent diagram containing Software Systems and other supported artifacts, identified independently of its name and used as the entry point and ownership scope of a parent-and-children export.
- **Container Diagram**: An included child with its own stable identity, one owning Software System, container level, owner-derived title, system boundary, containers, external occurrences, relationships, layout, and ADRs.
- **Diagram Artifact**: A component, relationship, or group with stable identity and diagram scope, plus the names, labels, types, details, positions, and connections needed for its exported visual representation.
- **External Participant Occurrence**: A child-local artifact with its own stable identity, position, relationships, and ADR links, whose display details and any available Software System child navigation resolve through its parent source identity.
- **Architecture Decision Record**: A decision with stable identity, diagram scope, lifecycle status, decision content, dates, and zero or more artifact links.
- **Artifact Link**: An association from an ADR to a component or relationship in the same diagram, preserved by stable identity in every exported view and file.
- **Presentation Settings**: Documented stylesheet settings that control component outline and fill colors in the HTML view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests covering single diagrams and System contexts with up to 10 active children and aggregate totals of 100 components, 200 relationships, and 100 ADRs, 100% of valid exports produce one ZIP package that opens after extraction without an application or network connection.
- **SC-002**: In 100% of tested exports, every component, relationship, group, system boundary, required displayed detail, and ADR from every included source diagram is represented in the package, and every component or relationship selection shows exactly its directly linked ADRs.
- **SC-003**: At least 90% of representative readers can find an ADR from a selected diagram artifact and find an unlinked ADR from the ADR browser within 2 minutes without instructions.
- **SC-004**: In 100% of tested exports, each included diagram's standalone SVG and every ADR file open in standard tools and preserve the readable content and stable references specified for them.
- **SC-005**: In 100% of tested color changes made through the documented stylesheet settings, all included HTML diagrams display the new component outline and fill colors while artifact selection, parent/child navigation, and ADR navigation still work.
- **SC-006**: In 100% of tested invalid or unsupported artifact cases, the author receives an actionable error naming the affected artifact and no package is reported as a successful complete export.
- **SC-007**: At least 90% of representative readers can open the intended container diagram from a Software System, find a child relationship's ADR, and return to the owning system within 2 minutes without instructions; the same journey can be completed using only a keyboard.
- **SC-008**: In 100% of duplicate-name, renamed-owner, grouped-system, external-occurrence, and moved-package tests, every parent/child and ADR reference opens the exact intended included diagram or artifact, and no child or ADR is duplicated or overwritten.
- **SC-009**: In 100% of child-load failure, broken-ownership, broken-source, and invalid-child-content tests, export produces an actionable error naming the affected diagram and artifact, no successful partial package, and no save or restoration side effect.
- **SC-010**: In 100% of retained-draft, saved-child, and edit-during-export tests, the package preserves the captured parent/child diagram and ADR state and consistent owner/source details, while the application editing state remains unchanged by export.
- **SC-011**: In 100% of compatibility tests for no-child contexts, trashed-child contexts, empty children, and directly exported containers, the package contains exactly the eligible diagrams and their complete content and ADRs, with no navigation to excluded diagrams.
- **SC-012**: The offline acceptance journeys for diagram rendering, parent/child and external-source navigation, exact ADR selection and browsing, keyboard access, stylesheet customization, and directory relocation MUST pass in all four required desktop browsers. Validation MUST use the current stable release of each browser on a supported desktop operating system and record the browser version and operating system used for each result.

## Assumptions

- Selecting a System context for HTML ZIP export automatically includes all active container diagrams owned by its Software Systems; no separate child selection is required. Trashed children, unrelated parent diagrams, deeper Component/Code diagrams, and arbitrary multi-diagram selection remain outside scope.
- The existing container ownership, source occurrence, owner-name, and lifecycle behavior defined in [Spec 009](../009-c4-container-diagrams/spec.md) is a dependency. This update extends HTML ZIP export beyond that feature's original single-diagram export boundary; it does not alter container creation, editing, or recovery rules.
- Directly selecting a container exports that child alone. Navigable external Software System occurrences reuse already included children from the selected parent and do not cause recursive discovery outside the parent scope.
- A child with no containers is valid when its ownership and boundary are valid; it is included with clear empty states. A system without a child needs no child creation or restoration to export successfully.
- Current state means all retained diagram and ADR drafts available in the current editing session, with saved content retrieved during export for other included diagrams. Owner and external source display details come from the captured parent so a parent draft rename does not yield conflicting titles in the package.
- Export is a read-only snapshot of the current editing state. Readers can browse the package, while editing diagram structure or ADR content remains in the application.
- Existing ADR associations to components and relationships are available to the exporter; the feature does not introduce a new linking workflow.
- A ZIP package is extracted before its HTML entry page is opened. Files use relative paths so the extracted directory can be moved as a unit.
- Required desktop browser compatibility targets the stable Chrome, Edge, Firefox, and Safari releases available when acceptance validation is performed. Mobile browsers, preview releases, and older browser-version guarantees are outside this feature's acceptance scope.
- Each exported HTML diagram and its standalone SVG share the same diagram content. The stylesheet settings control colors across included HTML views; SVG editor users may restyle standalone diagrams in their editor. Standalone SVG editor support does not imply interactive cross-diagram navigation within an SVG editor.
- The existing supported diagram vocabulary determines which component and group visuals can be exported. Unsupported content is reported as an error rather than omitted.
- Existing separate Mermaid and standalone SVG export actions and CLI scope are not expanded by this specification update. The multi-diagram contract applies to the interactive HTML ZIP workflow.
