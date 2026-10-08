# UI Contract: Component Diagrams

**Spec**: [../spec.md](../spec.md) | **Model**: [../data-model.md](../data-model.md)

## Entry and navigation

Plain click selects. Double-click Application/Datastore enters its Component child. Selected/viewed eligible owners expose Create/Open/Restore component diagram with native keyboard activation. Supporting containers resolve the same source-owned child. Software Systems retain Container entry; internal Components have no deeper entry.

Retain modifier/multiselection suppression, availability and entry loading/error states, owner-keyed request deduplication and stale-response navigation guards. First creation saves parent successfully. All transitions handle retained diagram/ADR work through Save/Discard/Cancel; failure/cancel preserves current view/drafts. Retry after creation/load failure reopens the same child. Trashed children offer named recovery, never replacement.

Heading identifies Component level, current container, Software System and parent Container. Read-only title explains owner naming. Return opens immediate parent and selects owner; further return reaches Context. Focus destination heading on successful navigation.

## Forms, canvas and sources

Internal form has Component-only type, name, responsibilities and technology. Container forms retain exactly Application/Datastore; Context keeps its current types. Reset form state on level change. Invalid submission retains inputs and identifies corrective fields.

Reuse absolute domain geometry, fitted boundary, keyboard movement/resize and history. Internal Components stay enclosed; supporting occurrences stay outside. Boundary fitting plus displaced occurrences is one edit. Synthetic boundary has no endpoint/ADR identity.

Supporting picker shows eligible immediate sources with type/subtype/name and excludes owner/duplicate canonical sources. Details are source-derived/read-only; Edit source navigates to authoritative source diagram with dirty-work protection. Local geometry/interactions do not modify ancestors.

Directed relationships require two different local endpoints, one internal, and a nonblank interaction; optional protocol stays readable. Unsupported types/endpoints/placement fail without partial artifacts.

## Hierarchy, save and naming

List is Context → Container → Component by stable UUID. Filtered descendants retain ancestor context headings without promotion to root or counting headings as matches. Labels distinguish matching names.

Derive child titles from retained owner drafts before filter/sort; undo/redo/discard restores preview. Save/list responses reconcile captured metadata without replacing newer edits; failures preserve drafts/error. Child response must match UUID/kind/parent/owner/name before saved status. No latest-entry reassignment, generic Parent Diagram classification or ancestor replacement.

## ADRs and protected edits

Keep exact local ADR creation/link/count/review/lifecycle behavior. No canonical-source or ancestor ADR inheritance.

Owner/source dependencies cover active and trashed children, whole-document omission, direct delete and history. Removing a Container Person/System occurrence used by Component children is blocked even if Context still has the source; show every affected child/occurrence and removal steps. No retarget or cascade. A blocked history operation preserves cursor/document. Application↔Datastore remains eligible. Existing relationship/ADR safeguards and confirmations apply.

## Recovery and feedback

Preview every affected active descendant, confirm exact IDs/batch, and re-preview changed impact. Restore required ancestor batch first; independently trashed children need their own confirmation afterward. Explain requestedDiagramIncluded=false and offer the next restore after ancestors are active. Differentiate committed recovery from failed post-recovery loading so reload retry does not repeat mutation.

Cancel restores initiating focus and retains drafts/states. Errors identify remedy; success describes the actual restored set.

## Design and acceptance

Follow DESIGN.md workspace extensions: neutral nodes, Action Blue focus/selection, dashed boundaries, reserved 44px boundary header, existing pills/ADR badges and readable textual scope/type/role. No new visual system. Core workflows use native keyboard actions, visible focus and established target sizes.

State/UI/E2E checks cover pointer and keyboard entry, three-level forms/list/save, dirty work/retries, rename races, source navigation, exact ADRs, history blockers and exact recovery.
