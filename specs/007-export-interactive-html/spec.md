# Feature Specification: Export Interactive HTML Package

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "The user would want to be able to export a HTML version of the diagram and architecture decision records. The HTML version should be able to click on the components and relationships and show the ADRs that are tied to it. There should also be a page where the user can browse all the ADRs. The CSS for the HTML should be done such that the user can change the line and fill colors of the components. The diagram prefably should be in SVG so that the user can use in SVG editors and the ADRs in markdown. The whole things should be downloadable as a ZIP package."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export and explore an architecture package (Priority: P1)

An architecture author downloads a portable package for the active diagram and opens its HTML entry page to share or review the architecture. The diagram remains understandable without access to the application. Selecting a component or relationship shows the ADRs linked to that exact artifact, including their titles, statuses, and full decision content.

**Why this priority**: Reviewers need to move directly from the architecture to the decisions that explain it.

**Independent Test**: Export a diagram with one component-linked ADR, one relationship-linked ADR, and an unlinked artifact; open the extracted package without the application and verify that the correct ADRs appear for each selection.

**Acceptance Scenarios**:

1. **Given** a valid diagram with named components, labeled relationships, and ADR links, **When** the author exports it and opens the extracted HTML entry page, **Then** the diagram displays its components, relationships, labels, direction, and layout, and the package works without an application connection.
2. **Given** an ADR linked to a component, **When** a reader selects that component, **Then** the page shows that ADR's title and status and lets the reader open its full content.
3. **Given** an ADR linked to a relationship, **When** a reader selects that relationship, **Then** the page shows the ADR linked to that relationship, even when the ADR is not linked to either endpoint component.
4. **Given** multiple ADRs linked to the same artifact, **When** a reader selects it, **Then** each linked ADR appears exactly once and no unrelated ADR appears.
5. **Given** a component or relationship without ADR links, **When** a reader selects it, **Then** the page clearly says that no ADRs are linked.

---

### User Story 2 - Browse every ADR in the export (Priority: P1)

A reader opens the package's dedicated ADR browser page to review all decisions, including decisions with no diagram links. They can move between a decision and its linked components or relationships.

**Why this priority**: A complete decision catalog prevents unlinked, rejected, or superseded decisions from disappearing from review.

**Independent Test**: Export a diagram containing linked and unlinked ADRs in multiple lifecycle states; open the ADR browser and confirm that every ADR and its references are available.

**Acceptance Scenarios**:

1. **Given** a diagram with linked and unlinked ADRs, **When** a reader opens the ADR browser, **Then** every ADR belonging to the diagram appears with its title and status.
2. **Given** an ADR in the browser, **When** a reader opens it, **Then** its context, decision, consequences, alternatives or constraints, status, and available dates are readable.
3. **Given** an ADR linked to components or relationships, **When** a reader views it, **Then** each linked artifact is identified and can be located in the diagram.
4. **Given** an ADR with no links, **When** a reader views it, **Then** its content remains accessible and its unlinked state is clear.

---

### User Story 3 - Reuse and restyle exported artifacts (Priority: P2)

An author uses the exported diagram in an SVG editor, uses the ADR files in a Markdown workflow, and adjusts the diagram's component outline and fill colors in the package stylesheet without redrawing the diagram.

**Why this priority**: Portable, editable artifacts let architecture documentation fit existing review and publishing workflows.

**Independent Test**: Extract the package, open the standalone diagram in an SVG editor, open an ADR file in a Markdown viewer, change the documented component color settings in the stylesheet, and reopen the HTML view.

**Acceptance Scenarios**:

1. **Given** an exported package, **When** the author opens the standalone SVG in an SVG editor, **Then** component shapes, relationships, labels, and grouping visible in the HTML diagram are present as editable vector content.
2. **Given** an exported package, **When** the author opens an ADR Markdown file, **Then** its title, status, decision fields, and links to diagram artifacts are readable without the HTML view.
3. **Given** the package stylesheet, **When** the author changes its documented component outline and fill color settings, **Then** reopening the HTML view shows the chosen colors without changing the diagram's structure or ADR links.

### Edge Cases

- A diagram with no ADRs still exports an ADR browser with a clear empty state; component and relationship selection reports no linked ADRs.
- An empty diagram exports only if it is otherwise valid, and the HTML view explains that it has no components or relationships.
- Duplicate names, empty optional relationship labels, non-Latin text, punctuation, and reserved markup characters remain readable and cannot change the identity of links or execute as page content.
- A relationship-linked ADR appears when that relationship is selected, whether or not its endpoint components have ADR links.
- Renamed or repositioned components and edited relationships retain their links through stable identities in the export.
- A missing endpoint, broken ADR reference, unsupported visual element, or content that cannot be represented safely stops the export with an actionable error identifying the affected artifact; no incomplete package is presented as successful.
- If the author has unsaved edits, the export reflects the current visible diagram and ADR state and does not silently substitute an older saved version.
- If a package is moved to another directory or computer after extraction, its internal navigation and styling continue to work without network access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the author export the active diagram and all ADRs belonging to it as one downloadable ZIP package, with clear success or failure feedback.
- **FR-002**: The package MUST contain an HTML entry page that works after extraction without an application connection or external network resources.
- **FR-003**: The HTML view MUST display every supported component, relationship, group, label, direction, and layout in the active diagram without silently omitting artifacts.
- **FR-004**: Readers MUST be able to select each component and relationship by pointer and keyboard and see only the ADRs directly linked to that artifact, identified by title and status, with a way to read each ADR in full.
- **FR-005**: When a selected component or relationship has no linked ADRs, the HTML view MUST show an explicit empty state.
- **FR-006**: The package MUST provide a dedicated HTML ADR browser page that lists all ADRs belonging to the diagram, including unlinked, draft, accepted, superseded, and rejected ADRs, and lets readers open each one.
- **FR-007**: Each exported ADR view MUST show its available context, decision, consequences, alternatives or constraints, status, dates, and linked component and relationship references; linked references MUST lead readers to the corresponding diagram artifacts.
- **FR-008**: The package MUST include a standalone SVG representation of the diagram that can be opened independently in a standard SVG editor and retains the same supported diagram content as the HTML view.
- **FR-009**: The package MUST include a separate Markdown file for every ADR, retaining its decision fields, status, dates, and stable references to linked components and relationships, including when an ADR has no links.
- **FR-010**: The package MUST include a documented CSS stylesheet with straightforward settings for changing component outline and fill colors in the HTML view; changing those settings MUST NOT break diagram interactions or ADR references.
- **FR-011**: Exported navigation and cross-references MUST use stable artifact identities rather than names or screen positions, so duplicate names and ordinary edits do not confuse links.
- **FR-012**: The export MUST represent the author's current diagram and ADR state at the time of export, including unsaved edits, without changing or saving that state as a side effect.
- **FR-013**: Before download, the system MUST validate diagram, ADR, and link integrity and report any missing, unsupported, or unsafe content with an actionable artifact-specific error instead of silently dropping it.
- **FR-014**: Exported user-authored text MUST be displayed as content, not interpreted as executable page markup or code.
- **FR-015**: The HTML view MUST provide readable labels, visible keyboard focus, and sufficient contrast for its default colors; diagram selection and ADR browsing MUST be usable without a pointer.

### Key Entities *(include if feature involves data)*

- **Export Package**: A portable snapshot of one diagram, its ADRs, and the files and navigation needed to browse them independently.
- **Diagram Artifact**: A component, relationship, or group with stable identity and the names, labels, positions, and connections needed for its exported visual representation.
- **Architecture Decision Record**: A decision with stable identity, lifecycle status, decision content, dates, and zero or more artifact links.
- **Artifact Link**: An association from an ADR to a component or relationship in the same diagram, preserved by stable identity in every exported view and file.
- **Presentation Settings**: Documented stylesheet settings that control component outline and fill colors in the HTML view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests covering diagrams with up to 100 components, 200 relationships, and 100 ADRs, 100% of valid exports produce a ZIP package that opens after extraction without an application or network connection.
- **SC-002**: In 100% of tested exports, every component, relationship, group, and ADR present in the source is represented in the package, and every component or relationship selection shows exactly its directly linked ADRs.
- **SC-003**: At least 90% of representative readers can find an ADR from a selected diagram artifact and find an unlinked ADR from the ADR browser within 2 minutes without instructions.
- **SC-004**: In 100% of tested exports, the standalone diagram and ADR files open in standard tools and preserve the readable content and stable references specified for them.
- **SC-005**: In 100% of tested color changes made through the documented stylesheet settings, the HTML diagram displays the new component outline and fill colors while artifact selection and ADR navigation still work.
- **SC-006**: In 100% of tested invalid or unsupported artifact cases, the author receives an actionable error naming the affected artifact and no package is reported as a successful complete export.

## Assumptions

- The package contains one active diagram and all ADRs belonging to that diagram; exporting multiple diagrams together is outside this feature.
- Export is a read-only snapshot of the current editing state. Readers can browse the package, while editing diagram structure or ADR content remains in the application.
- Existing ADR associations to components and relationships are available to the exporter; the feature does not introduce a new linking workflow.
- A ZIP package is extracted before its HTML entry page is opened. Files use relative paths so the extracted directory can be moved as a unit.
- The exported HTML view and standalone SVG share the same diagram content. The stylesheet settings control colors in the HTML view; SVG editor users may restyle the standalone diagram in their editor.
- The existing supported diagram vocabulary determines which component and group visuals can be exported. Unsupported content is reported as an error rather than omitted.
