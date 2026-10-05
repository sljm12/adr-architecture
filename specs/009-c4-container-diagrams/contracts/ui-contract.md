# UI Contract: C4 Container Diagrams

**Source of truth**: DESIGN.md and [spec.md](../spec.md)

**API**: [openapi.yaml](./openapi.yaml)

**Updated**: 2026-10-02 for clarified FR-015/FR-017, retaining the subtype/save/list design.

## Entry points and state

| Selected artifact / canonical child | Inspector action | Double-click behavior |
| --- | --- | --- |
| Software System / none | Create container diagram | Create and load canonical child |
| Software System / active | Open container diagram | Load same child |
| Software System / trashed | Restore container diagram | Present named restore confirmation |
| External Software System occurrence | Same state of its source system | Resolve source, then same behavior |
| Person, legacy unclassified, Container or SystemGroup | No container-diagram action | Keep existing behavior |
| Availability loading / operation pending | Disabled action and readable progress | Ignore duplicate activation |

Availability is transient server state, not part of undo history or the architecture document. A failed lookup shows retry. A successful create followed by a failed load leaves the current editor intact; retry resolves the existing child. Ownership is determined by IDs, not selection index or name.

A plain click selects and opens details. Existing Shift grouping remains unchanged for general diagrams. Container diagrams have Add component and Include external participant commands and no SystemGroup command. Add component opens an internal container form with exactly Application and Datastore choices; it never creates a new Person or Software System in the child.

## Navigation coordinator

All entry points, the source-parent link and library navigation use one coordinator in the existing workspace/store boundary.

1. Capture the intended source identity/navigation intent and block activation while a save or switch is pending.
2. Inspect both diagram and ADR dirty/failed states. Use the existing Save, Discard, Cancel dialog before leaving.
3. Save must complete for both dirty objects before navigation. A failed save leaves the current diagram/ADR and pending intent available for retry.
4. Discard of an unsaved owner must not create an orphan child: reload saved parent and recheck the selected source. If that component never existed in saved data, explain that it must be saved before creation and remain in the current view.
5. For a wholly unsaved parent or source with no persisted ID association, create-child requires Save or Cancel. Do not invent a persisted owner from a discarded draft.
6. Call atomic create-or-open or confirmed restore, then load the resolved child. Commit the switch only when valid data is available and the original document/ADR revision still matches the guarded state. Edits made while loading must be guarded again rather than overwritten by a stale response.
7. On success, reset diagram session history, selection and stale inspector mode, reset/load the child ADR context and counts, refresh list summaries, and move focus to the diagram heading.
8. Source-parent navigation highlights the owning system after loading. Opening through an external occurrence still uses the canonical source parent; it does not create a second nested child.

Cross-diagram undo is not introduced. Browser refresh does not add a router requirement: saved children reopen through the owner or library, preserving current application conventions.

## Editing surfaces

- Heading: Container diagram · current Software System name; diagram name is read-only and follows its owner.
- Show the current owner name as the child title. Resolve by UUID; never assign a generic "Parent Diagram" title.
- Parent navigation: native keyboard-accessible link/button named with the parent diagram and owning system.
- Boundary: a quiet dashed enclosure with a 44-unit header and readable Software System label. It is a visual adapter node only, rendered behind components, without handles, dragging, deletion or ADR targeting.
- Container form: type (Application or Datastore), name, responsibilities, technology. Store the choice in `containerType`; `role` and the underlying C4 `type` remain container. Validate all fields before one atomic store update. The edit form has the same two choices and retains the selected value after reopening. Show Application or Datastore on the node, wrap metadata, and grow node dimensions when necessary so details are not silently clipped; resulting boundary fitting belongs to the same edit.
- Derive creation/edit controls from the current document kind and selected role. Reset draft form state on a diagram switch or role change so a parent Person/Software System selection cannot carry into child creation. External source fields remain read-only; their type selector is not the internal container selector. Reject unsupported commands in the store as well as the form, without dirtying the diagram or history.
- Default a new internal component to Application and let the author choose Datastore. Migration assigns Application to existing generic internal containers as an explicit compatibility default, preserving their original C4 type, details and IDs; authors can change that choice to Datastore. Missing or unsupported subtype on a new write receives a field-level correction message rather than an inferred category or a third selectable type.
- External picker: current parent Person/Software System elements, excluding owner; distinguish duplicate names by stable IDs. Already-included choices are visibly disabled with an explanation.
- External inspector: source name, description and type are read-only; offer navigation to edit the source parent. Its local position and size remain editable.
- Relationship form: directed only, required interaction description, optional protocol. Reject unsupported endpoints before adding a partial edge. A rejected connection opens actionable feedback instead of persisting an invalid relationship.
- ADR controls retain lifecycle, counts, picker and linked-detail behavior for local component/relationship IDs. No parent decision inheritance is displayed.
- Library/trash entries show diagram name, kind, source system and parent name with stable IDs available to distinguish duplicate labels. Active container entries are children beneath the parent identified by `scope.parentDiagramId`, never peer top-level parent rows.

## Save identity and library hierarchy

Save captures the current child document and calls the existing PUT with the child's ID. Preserve its owner-derived name, `kind: container`, parent/owner IDs and boundary through store commands, history, adapter conversion, serialization and summary registration. Use persisted scope after a list reopen or refresh; navigation origin and display names cannot reassign ownership. No new save endpoint is required.

Before accepting a save response, verify ID, kind and parent/owner IDs match the request. For a child, require response.name equals response.scope.softwareSystemName; general names must match the normalized request. Failures retain draft/history/retry intent. Preserve newer edits while registering captured saves, and block navigation during saving.

Build library groups from the full summary set, keyed by parent UUID. Apply the existing name/date filters to each diagram's own fields, then retain a contextual parent heading for every matching child. A heading for a nonmatching parent does not count as a matching diagram. A matching parent does not cause its nonmatching children to be counted or displayed as matches. Sort groups by the existing comparator using parent summaries, and matching child siblings by that comparator with UUID tie breakers. A missing parent summary uses the child's resolved parent name/ID for the contextual heading and an actionable unavailable-parent state, never promotes the child to a top-level diagram.

Use nested native lists and headings, with each child open/delete action independently keyboard-accessible. Its accessible name identifies its owner-derived name, container level, owner and parent. Keep current selection, last-saved feedback, no-results behavior and list counts. Parent navigation goes through the existing guarded load intent using the child's canonical parent ID. Trash entries retain parent identification; a child whose active parent is absent from the trash list still retains that context.

## Layout, pointer and keyboard behavior

Domain container-layout helpers compute boundary fitting and external displacement. Controlled React Flow nodes convert only domain geometry; exclude the synthesized boundary when converting nodes back.

Both pointer drag/resize and completed keyboard movement call the same validated domain command. Keyboard position changes cannot remain solely in React Flow local state. Group a pointer gesture into one history step; keyboard moves use one step per completed key action. Boundary expansion and all displaced external occurrences join that snapshot.

Direct external movement/resize into the required boundary clearance is rejected and restored to its previous valid geometry with a readable message. Invalid connections, movements and forms do not dirty the diagram or alter undo/redo.

## Recovery and dependency feedback

All library, workspace and RecoveryControls trash actions use the same named confirmation based on trash-impact, showing the full affected diagram set. If the author is currently editing any affected child or ADR, apply the dirty-work guard before trashing the parent. Keep the current work if confirmation or dirty resolution is canceled.

After 204 success or restore, refresh/reconcile the full active and trash lists. If the current editor belongs to the affected set, exit editing and reset ADR context only after the operation succeeds. A stale confirmed set returns TRASH_IMPACT_CHANGED, refreshes the preview and requires a fresh confirmation.

Every restore entry point, including trash-list child actions, uses GET restore-impact before a named confirmation. If the requested child's parent is trashed, explain that restoring it requires restoring the parent and the children affected by that parent's trash operation. Show the canonical root and exact affected diagram names, then submit the confirmed ID set and batch identity to the root restore route. Cancellation changes no trash states and preserves focus/current work. RESTORE_IMPACT_CHANGED refreshes the preview and requires fresh confirmation; PARENT_INACTIVE redirects the offer to the parent root rather than silently restoring it.

If requestedDiagramIncluded is false, explain that this child was independently trashed earlier and will remain trashed when the parent batch is restored. After the parent is active, offer a separate named child restoration; do not include it automatically. Refresh the full active/trash lists after each successful operation and load the originally requested child only after it is active and the existing dirty-work/navigation guards succeed. A failed subsequent load reports that recovery succeeded and offers loading retry without repeating restoration.

Container/occurrence/relationship removal uses existing confirmation and blocker rules. Diagram blockers identify dependent children/occurrences and distinguish them from ADR and local relationship/group blockers.

When a parent source is changed to a type other than Person or Software System, show DIAGRAM_DEPENDENCY blockers for all active and recoverable occurrences with child name/status and occurrence identity. Explain that the author must open or restore the child and explicitly remove those occurrences after resolving relationship/ADR blockers. The blocked save preserves its draft for correction and does not silently remove occurrences or links. Valid Person/Software System changes keep source projection behavior; a Software System owning a child retains its stricter owner protection.

## Accessibility and visual system

Use DESIGN.md typography, whitespace, neutral hairlines, Action Blue (#0066cc) pill actions and visible focus; do not introduce decorative shadows or a new accent. Use readable type/scope text rather than color-only cues. Keep native buttons for Create/Open/Restore and keyboard navigation.

Retain React Flow node/edge focus and keyboard accessibility; Enter/Space selection remains selection. A node containing an interactive ADR badge must not become a nested button. Give the boundary an accessible group description and preserve focus on errors/canceled operations. Announce async progress and validation through the existing live-feedback pattern.

## Required UI validation

Both entry points, external-source navigation, duplicate attempts, grouped owners, Person/group rejection, dirty diagram/ADR Save/Discard/Cancel, creation/load/save failure, keyboard movement persistence, atomic details editing, boundary displacement/undo, source rename with independent layout, duplicate labels, current-child parent deletion, exact cascade restore, and color-independent scope identification.

For SC-009, verify both internal type choices, subtype edit/save/reopen and undo/redo, stale parent form selections, store-level rejection, and separate external inclusion. For SC-010, verify repeated saves, save-before-navigation, refresh/list reopen, child/parent/owner rename, duplicate names across parents, failed-save retry, malformed responses, grouped library results and child-only filter matches. Assert child ID/name/kind/scope retention, a single summary under the correct parent, and unchanged parent content.

For clarified FR-015/FR-017, verify unsupported source type changes with active and recoverable occurrences preserve all saved artifacts and identify occurrence blockers. Verify child-initiated parent restoration, named batch confirmation, cancellation, stale batch retry, earlier-independent-child exclusion and separate restore, dirty-work protection, list refresh and keyboard focus.

## Rename preview (2026-10-05)

Container titles always follow the current owning Software System, including legacy/custom titles, resolved by stable parent/owner UUIDs. General diagram names remain editable. No schema migration or read-time writes/timestamp changes. Make child title read-only with accessible help. Preview parent draft names in a pure sidebar projection before filtering/sorting; undo/redo/discard and failed saves retain the appropriate view without changing saved summaries. Successful saves reconcile active/trash child labels from the captured response and preserve later drafts; older list responses cannot overwrite that reconciliation.
