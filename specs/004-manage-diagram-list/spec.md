# Feature Specification: Manage Diagram List

**Feature Branch**: `004-manage-diagram-list`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "The ‘Your Artifact Diagram’ panel should be able to filter, sort, and delete the diagrams that were created. The filter should be able to filter by the diagram name and date created. Sort by name and date created."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find diagrams by name or creation date (Priority: P1)

An architecture author can narrow the diagrams shown in the Your Artifact Diagram panel by entering part of a diagram name and/or selecting an inclusive creation-date range, so that a large collection is easier to scan.

**Why this priority**: Finding an existing diagram is the primary purpose of managing the diagram list and directly reduces the time spent scanning unrelated work.

**Independent Test**: Populate the panel with diagrams whose names and creation dates differ, apply each filter independently and together, and verify that only matching diagrams remain visible.

**Acceptance Scenarios**:

1. **Given** the panel contains diagrams named “Payments”, “Payments API”, and “Inventory”, **When** the author enters “payments” in the name filter, **Then** the panel shows the first two diagrams and excludes “Inventory”, regardless of capitalization.
2. **Given** the panel contains diagrams created on several calendar dates, **When** the author selects a start and end date, **Then** the panel shows only diagrams created on or between those dates, including diagrams created on either boundary date.
3. **Given** both a name filter and a creation-date range are active, **When** the author views the panel, **Then** only diagrams matching both filters are shown.
4. **Given** active filters produce no matches, **When** the panel finishes applying the filters, **Then** it shows a clear no-matches message and provides a way to clear the filters.
5. **Given** one or more filters are active, **When** the author clears them, **Then** the complete active diagram list is shown again.

---

### User Story 2 - Sort diagrams for review (Priority: P1)

An architecture author can sort the visible diagrams by name or creation date in ascending or descending order, so that the list can be organized for browsing or recent-work review.

**Why this priority**: Sorting complements filtering and lets authors quickly locate alphabetic entries or recently created diagrams without changing the diagrams themselves.

**Independent Test**: Populate the panel with diagrams having different names and creation dates, choose each supported sort field and direction, and verify the displayed order.

**Acceptance Scenarios**:

1. **Given** the panel contains diagrams with different names, **When** the author selects sort by name ascending, **Then** diagrams appear in alphabetical order without regard to capitalization.
2. **Given** the panel contains diagrams with different creation dates, **When** the author selects sort by creation date descending, **Then** the newest-created diagram appears first and the oldest-created diagram appears last.
3. **Given** the author changes the sort field or direction while filters are active, **When** the list updates, **Then** the same filtered diagrams remain visible in the newly selected order.
4. **Given** two diagrams have the same sort value, **When** the author views the sorted list, **Then** their relative order is deterministic and does not change between refreshes unless their data changes.
5. **Given** the author selects a diagram from a filtered or sorted list, **When** the diagram opens, **Then** the selected diagram is the one represented by its stable identity, not merely its current list position or name.

---

### User Story 3 - Delete a diagram safely (Priority: P1)

An architecture author can delete a diagram directly from the panel after reviewing a confirmation message, so that obsolete diagrams no longer clutter the active list while the project’s recoverable-data safeguards remain intact.

**Why this priority**: Deletion is a core management action, but it must protect architecture knowledge because a diagram can contain components, relationships, groups, ADRs, and their references.

**Independent Test**: Create an active diagram with representative architecture content, delete it from the panel, confirm the action, and verify that it leaves the active list while remaining recoverable through the existing trash workflow.

**Acceptance Scenarios**:

1. **Given** an active diagram is listed in the panel, **When** the author chooses Delete, **Then** a confirmation dialog names the diagram and explains that deletion removes it from the active list and moves it to recoverable trash.
2. **Given** the delete confirmation is open, **When** the author cancels it, **Then** the diagram remains active and visible with no artifact data changed.
3. **Given** the author confirms deletion, **When** the deletion succeeds, **Then** the diagram disappears from the active list, a clear success message is shown, and the diagram remains available through the existing recovery workflow.
4. **Given** deletion fails, **When** the panel receives the failure, **Then** the diagram remains visible and the author receives an actionable error message.
5. **Given** the diagram being deleted is currently open and has unsaved changes, **When** the author starts deletion, **Then** the author must resolve the unsaved changes before deletion proceeds; canceling that resolution leaves the diagram and its changes intact.
6. **Given** a deleted diagram contains components, relationships, system groups, ADRs, or links, **When** the author restores it, **Then** those artifacts, stable identities, and references are preserved.

### Edge Cases

- The name filter is empty or contains only whitespace; the panel treats it as cleared rather than hiding all diagrams.
- The name filter matches a substring in the middle of a name and is case-insensitive; leading and trailing filter whitespace does not affect the result.
- The author provides only a start date or only an end date; the panel applies the corresponding open-ended date filter.
- The author provides an end date earlier than the start date; the panel rejects or clearly identifies the invalid range and does not silently return misleading results.
- A diagram is created near a date boundary; date filtering uses the displayed calendar date consistently, and inclusive boundary behavior is preserved.
- Two or more diagrams have identical names, identical creation dates, or both; all remain independently selectable, sortable, and deletable.
- All active diagrams are filtered out, or the active list is empty; the panel distinguishes an empty collection from a filter with no matches and provides an appropriate next action.
- A list refresh occurs while a deletion is in progress; the panel does not re-add a successfully deleted diagram or remove an unrelated diagram.
- A deletion request fails because the diagram is unavailable; the panel reports the failure and leaves the remaining list consistent with the latest known active data.
- The author deletes the last active diagram; the panel shows the empty state and retains the option to create a new diagram.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Your Artifact Diagram panel MUST display each active diagram with its human-readable name and creation date.
- **FR-002**: The panel MUST provide a name filter that matches active diagrams by a case-insensitive substring of the diagram name after trimming filter whitespace.
- **FR-003**: The panel MUST provide creation-date filtering with optional start and end dates; when both are supplied, the range MUST be inclusive of both calendar-date boundaries.
- **FR-004**: Name and creation-date filters MUST be combinable, and a diagram MUST be shown only when it matches every active filter.
- **FR-005**: The panel MUST provide a clear action that removes all active filters and restores the complete active diagram list.
- **FR-006**: The panel MUST provide sorting by diagram name and by creation date, with ascending and descending directions for each sort field.
- **FR-007**: Sorting MUST be applied to the diagrams currently shown after filtering, and diagrams with equal sort values MUST use a deterministic secondary order.
- **FR-008**: The panel MUST preserve stable diagram identity when an author opens, filters, sorts, or deletes a diagram; duplicate names MUST remain distinguishable and independently actionable.
- **FR-009**: Each active diagram entry MUST provide a clearly labeled delete action that is keyboard accessible and distinguishable from the action used to open the diagram.
- **FR-010**: Before deleting a diagram, the system MUST require explicit confirmation that identifies the target diagram and explains the recoverable deletion behavior.
- **FR-011**: After confirmed deletion, the system MUST remove the diagram from the active panel and make it available through the existing recovery workflow without deleting its contained architecture artifacts, stable identities, or references.
- **FR-012**: If deletion fails, the system MUST keep the affected diagram in the active panel and show an actionable error without changing unrelated entries.
- **FR-013**: If the target diagram has unsaved changes, the system MUST require the author to resolve those changes before deletion proceeds and MUST preserve the changes when the author cancels.
- **FR-014**: The panel MUST distinguish loading, load failure, empty active-list, no-filter-match, deletion-in-progress, deletion-success, and deletion-failure states with readable status feedback.
- **FR-015**: Filtering, sorting, confirmation, deletion, and recovery-related feedback MUST support keyboard navigation, readable labels, clear focus behavior, and sufficient contrast.
- **FR-016**: Creation dates used by the panel MUST remain the diagram’s original creation dates and MUST NOT be replaced by last-saved dates when diagrams are edited.

### Key Entities

- **Diagram Summary**: The stable identity, human-readable name, active/trashed status, and original creation date used to display, filter, sort, open, and delete a diagram from the panel.
- **Diagram List View**: The active diagram collection as currently constrained by the optional name filter, optional creation-date range, and selected sort field and direction.
- **Deletion Confirmation**: The explicit user decision associated with one stable diagram identity before it is moved out of the active list.
- **Recoverable Diagram**: A deleted diagram whose components, relationships, system groups, ADRs, links, names, creation date, and stable identities remain available to the existing recovery workflow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authors can locate a diagram using a name filter, a creation-date filter, or both in under 30 seconds for a panel containing up to 100 active diagrams.
- **SC-002**: For a validation set of at least 100 diagrams, 100% of filtered results match all active criteria and 100% of excluded results fail at least one active criterion.
- **SC-003**: For a validation set containing duplicate names and creation dates, 100% of sort operations produce the requested name/date order and retain a deterministic order for ties.
- **SC-004**: At least 90% of authors can delete an obsolete diagram from the panel on their first attempt without deleting an unintended diagram, and every deletion requires an explicit confirmation.
- **SC-005**: After a successful deletion and restore, 100% of validated diagram contents, stable identities, original creation date, and internal references remain intact.
- **SC-006**: In 100% of empty, no-match, load-failure, and deletion-failure validation scenarios, the panel provides a clear state message and an actionable next step.
- **SC-007**: Authors can use all filter, sort, open, confirm, cancel, and delete controls using only a keyboard, with visible focus and readable feedback.

## Assumptions

- The panel shows active diagrams only; diagrams moved to trash are managed through the existing recovery workflow rather than the active list.
- “Delete” means a recoverable deletion that moves the diagram to trash. Permanent irreversible deletion is outside this feature’s scope.
- A creation-date filter uses the author’s displayed calendar dates; start and end dates are inclusive, and either boundary may be omitted.
- The default list order is newest creation date first so that recently created work is immediately visible; the author can change it to any supported field and direction.
- Name matching is case-insensitive substring matching, while a name filter containing only whitespace is treated as cleared.
- Ties are resolved consistently using diagram name and then stable diagram identity, without changing the diagrams’ underlying data.
- Filter and sort choices apply while the panel is open; retaining those choices across sessions is outside this feature’s scope.
- The feature is for the existing single-user workflow and does not introduce permissions, sharing, or multi-user conflict handling.
- Deleting an entire diagram does not rewrite the stable identities or references of its contained artifacts; restoration returns the diagram as a coherent artifact.
- The existing diagram creation, loading, save, trash, and restore workflows remain available and are dependencies of this feature.
