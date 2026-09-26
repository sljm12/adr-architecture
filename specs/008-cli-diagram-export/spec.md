# Feature Specification: CLI Diagram Export

**Feature Branch**: `008-cli-diagram-export`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Create a new specification to build a Command Line tool. The command line tool will allow me to be able to query what diagrams are in the system and also export out the packaged zip file."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find diagrams from the command line (Priority: P1)

An architecture author uses a command line tool to see which active diagrams are available in the system and narrow the results by diagram name. The results show enough information, including each diagram's stable ID, to distinguish diagrams with duplicate names and choose the intended one for export.

**Why this priority**: Authors need to discover and identify a diagram before they can export it or use it in an automated workflow.

**Independent Test**: Populate the system with active diagrams that have distinct and duplicate names, list them from the command line, and verify that all are shown with stable IDs; then filter by name and verify the matching results.

**Acceptance Scenarios**:

1. **Given** the system contains multiple active diagrams, **When** the author requests the diagram list, **Then** every active diagram is shown with its stable ID, name, creation date, and last-updated date when available.
2. **Given** the system contains diagrams with duplicate names, **When** the author lists or filters diagrams, **Then** each result remains distinguishable by its stable ID.
3. **Given** the author supplies a name filter, **When** the results are returned, **Then** only diagrams whose names contain that text without regard to capitalization are shown.
4. **Given** the system has no active diagrams or a filter has no matches, **When** the author requests the list, **Then** the tool reports the appropriate empty state and exits successfully.
5. **Given** the system cannot be reached, **When** the author requests diagrams, **Then** the tool reports that it could not retrieve results and gives an actionable next step.
6. **Given** the author requests structured output, **When** the diagram list is returned, **Then** the result can be parsed by a script and includes the same stable IDs and diagram details as the readable output.

---

### User Story 2 - Export a diagram package (Priority: P1)

An architecture author selects a diagram by its stable ID and saves its packaged ZIP file to a local destination. The ZIP follows the same package format and content rules as the application's existing diagram export so the author can extract and browse it independently.

**Why this priority**: A portable package is the core deliverable requested for use outside the application and can be selected safely after discovering diagrams in the first scenario.

**Independent Test**: Create and save a valid diagram with components, relationships, ADRs, and links; export it by stable ID; extract the resulting ZIP and verify the package contents and offline browsing behavior match the application's existing package export for that saved diagram.

**Acceptance Scenarios**:

1. **Given** a valid active diagram, **When** the author exports it using its stable ID and a destination, **Then** a ZIP package is written at that destination and the tool reports the saved file path.
2. **Given** a diagram has components, relationships, groups, ADRs, and artifact links, **When** its package is exported, **Then** all supported content and stable references required by the existing package are preserved.
3. **Given** two diagrams share the same name, **When** the author exports one by stable ID, **Then** the package contains only the diagram identified by that ID.
4. **Given** the requested ID does not identify an active diagram, **When** the author requests an export, **Then** the tool reports that the diagram could not be found and does not report a successful export.
5. **Given** the destination already contains a file or cannot be written, **When** the author requests an export, **Then** the tool explains the destination problem and does not silently overwrite an existing file or report an incomplete package as successful.
6. **Given** the saved diagram contains invalid or unsupported content that prevents a complete package, **When** the author requests an export, **Then** the tool reports an actionable error identifying the affected content and does not present an incomplete package as complete.
7. **Given** the author exports a saved diagram, **When** the package is created, **Then** the exported content reflects the persisted state and the system's diagram and ADR data remain unchanged.

---

### User Story 3 - Learn and automate the basic workflow (Priority: P2)

An author new to the tool reads its built-in help to learn how to list, filter, and export diagrams. An author using scripts can select structured output and detect whether a command succeeded, so the same read-only workflow can be repeated reliably.

**Why this priority**: Clear help and predictable command results make the two core operations usable without hidden setup knowledge and useful in repeatable workflows.

**Independent Test**: Start with a user who has not used the tool, follow only its built-in help to list and export a diagram, then run a successful and a failing query or export in a script and verify that the outcomes are distinguishable.

**Acceptance Scenarios**:

1. **Given** an author opens the tool's help, **When** they review it, **Then** it explains listing, name filtering, stable-ID export, destination selection, system configuration, and common errors.
2. **Given** a script runs a list or export operation, **When** the operation succeeds or fails, **Then** the tool returns a process result that lets the script distinguish success from failure.
3. **Given** the author uses the existing single-user system, **When** they list or export diagrams, **Then** the workflow requires no new account, permission, or workspace setup.

### Edge Cases

- The diagram list is empty, or a valid name filter matches no active diagrams.
- A name filter is empty or contains only whitespace; the tool treats it as no filter.
- Multiple diagrams have the same name; every result remains addressable by stable ID.
- The author requests an export for an unknown, deleted, or unavailable diagram ID.
- The configured system is unreachable or returns an error while listing or exporting.
- The destination folder does not exist, is not writable, has insufficient space, or already contains a file with the requested name.
- A package cannot be completed because the diagram or its ADR references fail validation; no partial package is reported as successful.
- The diagram has no ADRs or no components; the package follows the existing export's defined empty-state behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The command line tool MUST list all active diagrams available in the configured system.
- **FR-002**: Each listed diagram MUST show its stable ID and human-readable name; creation and last-updated dates MUST be shown when available.
- **FR-003**: The tool MUST allow authors to filter the diagram list by a case-insensitive substring of the diagram name. An empty or whitespace-only filter MUST be treated as no filter.
- **FR-004**: The tool MUST provide both a readable default result and a structured output option suitable for scripts, with stable IDs retained in either form.
- **FR-005**: The tool MUST export one active diagram selected by stable ID as a ZIP package to a local destination selected by the author.
- **FR-006**: A CLI-generated package MUST follow the same content, validation, and offline-browsing contract as the existing application ZIP export for the same saved diagram.
- **FR-007**: Export MUST preserve diagram artifacts, ADR content, and their stable references required by the package contract; invalid or unsupported content MUST produce an actionable error rather than silent omission.
- **FR-008**: Export MUST use the diagram's currently persisted state and MUST NOT modify or save diagram data as a side effect.
- **FR-009**: The tool MUST report successful export with the destination path and MUST clearly report retrieval, validation, or local file errors. Its result MUST let scripts distinguish success from failure.
- **FR-010**: The tool MUST NOT silently overwrite an existing destination file or present a partial package as a successful complete export.
- **FR-011**: The tool MUST include concise help that explains how to list and filter diagrams, export by stable ID, select an output destination, configure the target system, and understand common failures.
- **FR-012**: The feature MUST remain read-only with respect to system diagrams and ADRs; creating, editing, deleting, importing, and restoring diagrams are outside this feature.
- **FR-013**: The feature MUST use the existing single-user system context and MUST NOT introduce accounts, permissions, workspaces, or collaboration workflows.

### Key Entities *(include if feature involves data)*

- **Diagram Summary**: A view of an active diagram's stable ID, name, and available creation or update dates, used to discover and identify an export target.
- **Diagram Package**: A ZIP snapshot of one saved diagram, its ADRs, links, and the files needed to browse the export according to the existing package contract.
- **Export Destination**: The local file path selected by the author for the generated ZIP package.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a system containing up to 100 active diagrams, authors can list the collection and identify a target diagram by name and stable ID in under 30 seconds.
- **SC-002**: In validation cases with varied names, duplicate names, and empty results, 100% of list and filter results contain exactly the matching active diagrams, each distinguishable by stable ID.
- **SC-003**: In 100% of successful exports, the ZIP opens after extraction and contains the same supported content and browsing behavior as the application's package export for the same saved diagram.
- **SC-004**: In 100% of tested missing-diagram, unreachable-system, invalid-content, and unwritable-destination cases, the tool reports a clear failure and never reports a complete export that was not produced.
- **SC-005**: At least 90% of first-time users can list diagrams and export a selected diagram by following the built-in help, without separate instructions, within five minutes.

## Assumptions

- The target is the existing single-user ADR Diagram system, and no new authentication or permission model is needed for the first release.
- The system is available over a configured connection when listing or exporting; offline access to the live system is not required.
- The list includes active diagrams only. Diagrams in recoverable trash are not queryable or exportable through this feature.
- A package contains one selected diagram and uses the existing application export contract defined by the interactive HTML package feature.
- The CLI exports the saved state available from the system. Unsaved changes in an open browser session are not included.
- The requested feature is limited to discovering diagrams and exporting packages; diagram and ADR mutations remain in the application.
