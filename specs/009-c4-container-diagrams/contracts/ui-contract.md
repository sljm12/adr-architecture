# UI Contract: C4 Container Diagrams

**Source of truth**: DESIGN.md and [spec.md](../spec.md)

**API**: [openapi.yaml](./openapi.yaml)

**Updated**: 2026-10-01 for FR-007, FR-011, FR-023 and FR-024.

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

- Heading: Container diagram · current Software System name; diagram name remains editable.
- Show the child's own name separately from the owner name. Loading, ordinary edits and saving never replace it with "Parent Diagram" or a source display name.
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

Save captures the current child document and calls the existing PUT with the child's ID. Preserve its own name, `kind: container`, parent/owner IDs and boundary through store commands, history, adapter conversion, serialization and summary registration. Use persisted scope after a list reopen or refresh; navigation origin and display names cannot reassign ownership. No new save endpoint is required.

Before accepting a save response into the editor or list, verify that its ID, normalized own name, kind and parent/owner IDs match the request. Retain the draft and show an actionable failure on mismatch or save failure; retry uses the same child. Preserve the existing revision guard for edits made during a pending save and block navigation while saving. A successful save updates one child summary and leaves the parent's architecture content intact.

Build library groups from the full summary set, keyed by parent UUID. Apply the existing name/date filters to each diagram's own fields, then retain a contextual parent heading for every matching child. A heading for a nonmatching parent does not count as a matching diagram. A matching parent does not cause its nonmatching children to be counted or displayed as matches. Sort groups by the existing comparator using parent summaries, and matching child siblings by that comparator with UUID tie breakers. A missing parent summary uses the child's resolved parent name/ID for the contextual heading and an actionable unavailable-parent state, never promotes the child to a top-level diagram.

Use nested native lists and headings, with each child open/delete action independently keyboard-accessible. Its accessible name identifies its own name, container level, owner and parent. Keep current selection, last-saved feedback, no-results behavior and list counts. Parent navigation goes through the existing guarded load intent using the child's canonical parent ID. Trash entries retain parent identification; a child whose active parent is absent from the trash list still retains that context.

## Layout, pointer and keyboard behavior

Domain container-layout helpers compute boundary fitting and external displacement. Controlled React Flow nodes convert only domain geometry; exclude the synthesized boundary when converting nodes back.

Both pointer drag/resize and completed keyboard movement call the same validated domain command. Keyboard position changes cannot remain solely in React Flow local state. Group a pointer gesture into one history step; keyboard moves use one step per completed key action. Boundary expansion and all displaced external occurrences join that snapshot.

Direct external movement/resize into the required boundary clearance is rejected and restored to its previous valid geometry with a readable message. Invalid connections, movements and forms do not dirty the diagram or alter undo/redo.

## Recovery and dependency feedback

All library, workspace and RecoveryControls trash actions use the same named confirmation based on trash-impact, showing the full affected diagram set. If the author is currently editing any affected child or ADR, apply the dirty-work guard before trashing the parent. Keep the current work if confirmation or dirty resolution is canceled.

After 204 success or restore, refresh/reconcile the full active and trash lists. If the current editor belongs to the affected set, exit editing and reset ADR context only after the operation succeeds. A stale confirmed set returns TRASH_IMPACT_CHANGED, refreshes the preview and requires a fresh confirmation.

Container/occurrence/relationship removal uses existing confirmation and blocker rules. Diagram blockers identify dependent children/occurrences and distinguish them from ADR and local relationship/group blockers.

## Accessibility and visual system

Use DESIGN.md typography, whitespace, neutral hairlines, Action Blue (#0066cc) pill actions and visible focus; do not introduce decorative shadows or a new accent. Use readable type/scope text rather than color-only cues. Keep native buttons for Create/Open/Restore and keyboard navigation.

Retain React Flow node/edge focus and keyboard accessibility; Enter/Space selection remains selection. A node containing an interactive ADR badge must not become a nested button. Give the boundary an accessible group description and preserve focus on errors/canceled operations. Announce async progress and validation through the existing live-feedback pattern.

## Required UI validation

Both entry points, external-source navigation, duplicate attempts, grouped owners, Person/group rejection, dirty diagram/ADR Save/Discard/Cancel, creation/load/save failure, keyboard movement persistence, atomic details editing, boundary displacement/undo, source rename with independent layout, duplicate labels, current-child parent deletion, exact cascade restore, and color-independent scope identification.

For SC-009, verify both internal type choices, subtype edit/save/reopen and undo/redo, stale parent form selections, store-level rejection, and separate external inclusion. For SC-010, verify repeated saves, save-before-navigation, refresh/list reopen, child/parent/owner rename, duplicate names across parents, failed-save retry, malformed responses, grouped library results and child-only filter matches. Assert child ID/name/kind/scope retention, a single summary under the correct parent, and unchanged parent content.
