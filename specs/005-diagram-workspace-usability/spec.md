# Feature Specification: Diagram Workspace Usability

**Feature Branch**: `005-diagram-workspace-usability`
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Keep the editor focused

An architecture author can open a diagram and see the canvas, title, save state, and primary actions without page scrolling or clipped controls. Library and Details panels can be opened and closed independently, while an active form remains intact when Details is closed.

**Acceptance scenarios**

1. Given a saved diagram is open at desktop width, when the author views the editor, then the page has no vertical scrollbar and the canvas fills the remaining viewport.
2. Given Details is closed, when the author selects a component or chooses Add component, then Details opens and receives focus without losing the selection or draft.
3. Given an Add component, relationship, group, or ADR form is open, when the author closes Details, then reopening it preserves the form values and validation state.
4. Given a narrow viewport, when the author opens a panel, then the panel is keyboard reachable, fits the viewport, and does not make toolbar actions inaccessible.

### User Story 2 - Scan and manage saved diagrams

An architecture author can quickly find diagrams, inspect the current diagram, delete safely, and recover trashed diagrams from the library without the filter controls obscuring the list.

**Acceptance scenarios**

1. Given the library is open, then search, the current diagram, and compact saved rows are visible before advanced controls.
2. When the author opens Filters and sort, then the existing name/date filtering and name/date sorting behavior remains available and accessible.
3. When the author selects a saved row, then its stable diagram ID opens; when they delete it, existing confirmation and unsaved-change protections remain in force.
4. When the author uses the library recovery entry point, then the existing trash and restore workflow remains available even when Details is closed.

### User Story 3 - Read and select the diagram

An architecture author can distinguish selected and unselected nodes, follow relationships, and understand group boundaries without changing artifact positions or references.

**Acceptance scenarios**

1. Given no item is selected, then components use neutral borders and handles are not visually dominant.
2. When a component, group, or relationship is selected or focused, then it has a clear non-color selection cue and accessible name.
3. Given parallel or reciprocal relationships share endpoints, then their curves, arrows, labels, and hit areas remain distinguishable.
4. Given a system group contains members, then its title/member-count header remains readable and is not covered by child nodes.

### User Story 4 - Surface linked decisions

An architecture author can see how many saved decisions affect each component and open the existing linked-ADR details from the diagram.

**Acceptance scenarios**

1. Given a diagram with linked ADRs, then each component with one or more links displays an accessible count badge.
2. When the author activates a badge with mouse or keyboard, then that component is selected, Details opens, and its Linked ADRs section is shown.
3. Given no linked ADRs, then no misleading zero badge is displayed.
4. Given count loading fails, then editing remains usable and a retry message is shown; unavailable data is not treated as zero.
5. Given an ADR save partially fails or succeeds, then counts and an open linked-summary refresh independently of the unsaved ADR draft.

## Functional Requirements

- **FR-001**: The workspace MUST fit the editor to the viewport and prevent page-level scrolling during ordinary editing.
- **FR-002**: The workspace MUST expose independent, keyboard-accessible library and Details panel controls and preserve active form state when panels close.
- **FR-003**: The library MUST keep filtering, sorting, stable-ID selection, confirmation, deletion, and recovery behavior intact.
- **FR-004**: Unselected canvas items MUST use neutral styling; selected/focused items MUST expose a visible non-color cue.
- **FR-005**: Relationship rendering MUST preserve deterministic routing and improve contrast, arrows, labels, and selection hit areas.
- **FR-006**: Group headers MUST reserve readable space for the name and member count without changing persisted positions.
- **FR-007**: `GET /api/diagrams/:diagramId/component-adr-counts` MUST return sparse positive component counts, count all ADR statuses, return an empty list when no links exist, and return 404 for missing or trashed diagrams.
- **FR-008**: Count loading MUST be diagram-scoped, stale-response-safe, independently retryable, and must not modify ADR drafts or diagram history.
- **FR-009**: Persisted ADR/link changes, ADR deletion, restoration, and component-set changes MUST invalidate counts and selected ADR summaries.
- **FR-010**: Badge activation MUST select the component, open Details, and focus the existing Linked ADR section.

## Success Criteria

- **SC-001**: At 1920x1080, 1366x768, and 1024x768 the default editor has no page scrollbar and no toolbar or filter field is clipped.
- **SC-002**: At 390x844 all primary editor actions remain reachable with keyboard navigation and panels fit within the viewport.
- **SC-003**: A diagram with 50 components makes at most one count request when opened, regardless of component count.
- **SC-004**: Selecting or activating any component, relationship, group, or ADR badge reaches its corresponding Details content in one interaction.
- **SC-005**: Existing diagram, grouping, ADR, export, deletion/recovery, and accessibility test suites continue to pass.

## Assumptions

- Existing REST, React Flow, Zustand, and stable UUID boundaries remain in place.
- Count badges include draft, accepted, superseded, and rejected persisted ADRs.
- Badge failures are non-blocking and do not prevent diagram editing.
- No schema migration is required; counts are derived from existing ADR component links.
