# UI Contract: C4 Container Diagrams

**Source of truth**: DESIGN.md and [spec.md](../spec.md)

**API**: [openapi.yaml](./openapi.yaml)

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

A plain click selects and opens details. Existing Shift grouping remains unchanged for general diagrams. Container diagrams have Add container and Include external participant commands and no SystemGroup command.

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
- Parent navigation: native keyboard-accessible link/button named with the parent diagram and owning system.
- Boundary: a quiet dashed enclosure with a 44-unit header and readable Software System label. It is a visual adapter node only, rendered behind components, without handles, dragging, deletion or ADR targeting.
- Container form: name, responsibilities, technology. Validate all three before one atomic store update. Show Container type, wrap metadata, and grow node dimensions when necessary so details are not silently clipped; resulting boundary fitting belongs to the same edit.
- External picker: current parent Person/Software System elements, excluding owner; distinguish duplicate names by stable IDs. Already-included choices are visibly disabled with an explanation.
- External inspector: source name, description and type are read-only; offer navigation to edit the source parent. Its local position and size remain editable.
- Relationship form: directed only, required interaction description, optional protocol. Reject unsupported endpoints before adding a partial edge. A rejected connection opens actionable feedback instead of persisting an invalid relationship.
- ADR controls retain lifecycle, counts, picker and linked-detail behavior for local component/relationship IDs. No parent decision inheritance is displayed.
- Library/trash entries show diagram name, kind, source system and parent name with stable IDs available to distinguish duplicate labels.

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
