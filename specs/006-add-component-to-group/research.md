# Research

## Decision: Reuse the complete-document save boundary

The existing diagram document already stores group membership as stable component IDs, and the
existing PUT /api/diagrams/{diagramId} path validates and replaces groups and membership rows in one
transaction. The feature will send the updated document through that path.

**Rationale**: This preserves the current API shape, atomic save behavior, stable IDs, and
backwards-compatible empty-group default without introducing a second mutation protocol.

**Alternatives considered**: A dedicated add-member endpoint would duplicate validation and
persistence behavior for a single editor action; direct membership writes would bypass the existing
complete-document save and history semantics.

## Decision: Add one guarded store action with existing bounded history

The frontend will add a focused addGroupMember action next to createGroup and removeGroupMember.
Validation runs before update, and a successful addition is one history entry that can be undone and
redone.

**Rationale**: The current Zustand store already owns group edits and uses BoundedHistory for
document changes. Reusing it keeps save status, retry behavior, and undo/redo consistent.

**Alternatives considered**: Mutating the selected group directly from the inspector would bypass
history; adding a separate membership store would split the document source of truth.

## Decision: Model group-plus-component selection as transient compound UI state

The existing selection model distinguishes a group from a temporary list of components used to
create a new group. The new workflow will add a compound selection carrying the selected group ID
and candidate component ID. Normal Shift-selection will enter this state only when a group is
already selected and the group form is not active.

**Rationale**: This preserves plain component selection and the existing group-creation workflow
while making the target group explicit. It also lets the inspector show a reviewable confirmation
before mutation.

**Alternatives considered**: Treating the group as one item in the existing component ID list would
mix group and component types and make duplicate/conflicting feedback ambiguous. Opening a new
modal flow would add UI complexity and break the existing group-details interaction.

## Decision: Fit the existing group boundary around unchanged absolute positions

After validation, the store will append the component ID and call the existing group-layout helper
with all current member positions. The candidate component is not moved; only the group position and
size may change to retain the established padding.

**Rationale**: This matches the existing group-creation and member-movement behavior, preserves
relationships and ADR links, and handles candidates outside any current group edge.

**Alternatives considered**: Clamping or auto-arranging the candidate would change user-authored
positions. Keeping the old boundary would violate the invariant that every rendered member is
enclosed.

## Decision: Use immediate, human-readable preflight errors and retain server-side validation

The UI will report same-group duplicates as a no-op and identify the current group for a
cross-group conflict. The shared/domain invariant and server save validation remain the final
guard for stale or invalid documents.

**Rationale**: The requested behavior is a user-visible explanation, while the server must still
reject malformed or stale complete documents.

**Alternatives considered**: Silently disabling the action hides the reason. Relying only on a
server 422 would provide late feedback and would not explain the candidate state before submission.

## Decision: Verify behavior at shared, state, API, rendering, and end-to-end boundaries

Add focused Vitest coverage for validation, group-store history, adapter conversion, and UI
accessibility contracts, plus contract/persistence coverage and a Playwright workflow for valid,
duplicate, conflicting, cancellation, and save/reopen paths.

**Rationale**: The constitution requires automated coverage for edited and persisted architecture
artifacts, stable references, validation failures, and representative rendering.

**Alternatives considered**: A single end-to-end test would not isolate invariant failures, history
regressions, or persistence immutability.
