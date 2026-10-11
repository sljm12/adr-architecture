# Feature Specification: CLI Diagram Deletion

**Feature Branch**: `main` (no branch creation hook configured)

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "For the cli feature I would like to add a feature to be able to delete Diagrams and their children using their Name or their uuid. I should be able to specify if i want to move it to Trash or delete it permanently. For matching the name it should be an exact match."

## Clarifications

### Session 2026-10-11

- Q: If someone saves changes to a diagram or its contents after the deletion preview appears, should deletion require fresh confirmation even when the names and child diagram list remain unchanged? → A: Reject the stale confirmation if any affected diagram or its contents changed; require a new preview and confirmation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move a named diagram hierarchy to Trash (Priority: P1)

An architecture author selects a saved diagram by its exact name or UUID, reviews its affected children, and moves the hierarchy to Trash so obsolete work leaves the active collection while remaining recoverable.

**Why this priority**: This provides the core deletion workflow with a recoverable outcome and protects linked architecture knowledge.

**Independent Test**: Create a parent diagram with a child and grandchild, representative components, relationships, groups, ADRs, and links. Select the parent by exact name, confirm Trash, and verify the affected hierarchy is recoverable with its contents and identities intact. Repeat using its UUID.

**Acceptance Scenarios**:

1. **Given** active diagrams named "Payments", "Payments API", and "payments", **When** the author selects the exact name "Payments" and chooses Trash, **Then** only "Payments" is selected as the root and its affected descendants are identified before confirmation.
2. **Given** a selected active parent has active children and grandchildren, **When** the author confirms moving it to Trash, **Then** the parent and all active descendants leave the active collection together, retaining contents, UUIDs, and references for the existing recovery workflow.
3. **Given** the author selects the same diagram by UUID, **When** they confirm Trash, **Then** the affected hierarchy and outcome are the same as selection by its unique exact name.
4. **Given** a descendant was independently trashed earlier, **When** its active ancestor is moved to Trash, **Then** the descendant remains trashed with its previous recovery provenance unchanged and is not added to the new recovery batch.
5. **Given** confirmation has not been granted, **When** the author cancels or cannot provide confirmation, **Then** no saved data changes.

---

### User Story 2 - Permanently delete a diagram hierarchy (Priority: P1)

An architecture author explicitly chooses permanent deletion by exact name or UUID, reviews the entire affected hierarchy and irreversible outcome, and confirms removal of work that should no longer remain recoverable.

**Why this priority**: Permanent removal is an explicit part of the requested feature and needs clear scope and data-loss safeguards.

**Independent Test**: Create a hierarchy containing both active and independently trashed descendants with contained artifacts and ADRs. Permanently delete its root and verify the entire selected subtree is absent from active views and Trash, while unrelated diagrams and their contents remain unchanged.

**Acceptance Scenarios**:

1. **Given** an active diagram has active and trashed descendants, **When** the author chooses permanent deletion, **Then** confirmation identifies the root and every descendant by name and UUID and explains that their contained artifacts and ADRs will be removed irreversibly.
2. **Given** the author confirms that affected set, **When** permanent deletion succeeds, **Then** the root, all descendants regardless of status, their contained components, relationships, groups, ADRs, and links are removed and cannot be restored through Trash.
3. **Given** a diagram is already in Trash, **When** the author selects it by unique exact name or UUID and confirms permanent deletion, **Then** it and its descendants are permanently removed without first requiring restoration.
4. **Given** a child diagram is the selected root, **When** it is permanently deleted, **Then** only its subtree is removed; its ancestors, siblings, and the owning component in its parent are preserved.
5. **Given** an artifact outside the selected subtree requires an artifact that would be removed, **When** permanent deletion is attempted, **Then** the operation fails without changes and identifies the dependency that must be resolved.

---

### User Story 3 - Resolve targets and failures safely (Priority: P2)

An architecture author uses help and clear diagnostics to select one intended root, understand the deletion mode, and distinguish success, cancellation, and failure from command results.

**Why this priority**: Exact targeting and clear outcomes make destructive commands usable both interactively and in scripts.

**Independent Test**: Exercise duplicate names, near matches, invalid selectors, missing or conflicting modes, cancellation, changed impact, and unavailable service. Verify actionable feedback and no unintended data changes.

**Acceptance Scenarios**:

1. **Given** two eligible diagrams have the identical name, **When** the author selects that name, **Then** the command refuses to choose a root, reports each matching name, UUID, and status, and instructs the author to select a UUID.
2. **Given** only "Payments API" exists, **When** the author selects the name "Payments", **Then** the command reports no exact match and changes nothing.
3. **Given** no deletion mode or both modes are supplied, or the selector is missing, invalid, or conflicting, **When** the command runs, **Then** it reports invalid usage without changing any diagram.
4. **Given** a confirmation preview has been shown, **When** the root identity, any displayed name or status, the affected diagram set, or any affected diagram's saved contents changes before deletion, **Then** either deletion mode refuses the stale confirmation without deleting anything and requires a fresh preview and confirmation, including when only a component, relationship, group, ADR, link, or metadata changes.
5. **Given** the system is unavailable or rejects deletion, **When** the command runs, **Then** it reports the failure with a next action and does not claim success; an interrupted response with an uncertain outcome tells the author to verify the saved state before retrying.
6. **Given** the author uses a script without interactive input, **When** explicit confirmation is absent, **Then** deletion does not proceed; an explicitly supplied non-interactive confirmation can authorize the resolved operation.
7. **Given** deletion succeeds, **When** the command finishes, **Then** its result identifies the selected root by name and UUID, the chosen mode, and the affected diagrams, and returns a success exit status.

### Edge Cases

- Names differ only by capitalization, leading or trailing spaces, punctuation, or Unicode characters; matching compares the complete saved name without case folding, trimming, substring matching, or wildcard interpretation.
- A name looks like a UUID; explicit name selection treats it as a name rather than guessing the selector type.
- An empty or whitespace-only name, malformed UUID, extra root selector, or conflicting deletion modes is rejected without mutation.
- Duplicate exact names exist across active diagrams and Trash; permanent deletion searches both and remains ambiguous, while Trash searches active diagrams only.
- A diagram has no children, or the selected root is a leaf; the operation affects just that diagram and its contents.
- A root is already trashed; Trash reports that it is not active without changing its recovery batch, while permanent deletion remains available.
- A hierarchy contains both active and previously trashed descendants; Trash preserves earlier batches, while permanent deletion includes both statuses.
- The root is renamed, moved to Trash, restored, or removed, or a descendant is added or removed while confirmation is pending; stale confirmation cannot authorize a different target or set.
- Saved components, relationships, groups, ADRs, links, or metadata change in any affected diagram after preview, even if names, statuses, and the hierarchy stay the same; both modes reject stale confirmation and require a new preview and confirmation, including for non-interactive execution.
- Saved hierarchy references are missing or cyclic, or external dependencies would be broken; the command refuses deletion with actionable diagnostics.
- A failure occurs while changing a hierarchy; no partially trashed or partially permanently deleted hierarchy is committed.
- An open browser contains unsaved edits; the CLI operates on saved data only and does not capture those edits or allow a later save to silently resurrect deleted artifacts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST allow deletion of exactly one root diagram per invocation, selected explicitly by either its name or its stable UUID. Missing, multiple, conflicting, empty, whitespace-only, or malformed selectors MUST fail without mutation.
- **FR-002**: Name selection MUST match the complete saved diagram name exactly, including case and whitespace, with no trimming, normalization, partial matching, or wildcard expansion. A name resembling a UUID MUST remain selectable as a name.
- **FR-003**: A name MUST resolve to exactly one eligible diagram. Zero matches MUST produce a no-match error; multiple matches MUST produce an ambiguity error listing the matching names, UUIDs, and statuses and requiring UUID selection. The command MUST NOT delete all matching roots or pick the first.
- **FR-004**: The author MUST explicitly choose either Trash or permanent deletion. Neither mode MUST be inferred by default, and supplying both MUST be rejected before mutation.
- **FR-005**: Trash selection MUST consider active diagrams only. Permanent deletion selection MUST consider both active and trashed diagrams. UUID selection MUST obey the same status eligibility rules.
- **FR-006**: Deletion scope MUST follow saved parent-child identities recursively, including children and grandchildren, rather than name similarity. Selecting a child MUST affect its subtree only, preserving ancestors, siblings, and its owning component outside that subtree.
- **FR-007**: Trash MUST move the selected active root and all active descendants to recoverable Trash as one coherent operation, preserving all contained artifacts, ADRs, stable UUIDs, metadata, and references. Previously trashed descendants MUST retain their existing recovery provenance, consistent with the existing recovery workflow.
- **FR-008**: Permanent deletion MUST remove the selected root and every descendant, including previously trashed descendants, together with each removed diagram's components, relationships, groups, ADRs, links, and recovery metadata. None of that removed content MUST remain available through active views or Trash recovery.
- **FR-009**: Before mutation, the CLI MUST present the mode, selected root name and UUID, and the affected diagram names, UUIDs, and statuses. Confirmation MUST explain the effect on contained artifacts and ADRs and distinguish recoverable Trash from irreversible permanent deletion.
- **FR-010**: Both modes MUST require explicit confirmation. Interactive refusal or cancellation MUST change nothing. Non-interactive execution MUST require an explicit confirmation option and otherwise fail without mutation rather than waiting indefinitely or treating absent input as consent.
- **FR-011**: Confirmation MUST be bound to the resolved root UUID, mode, displayed names and statuses, affected diagram set, and the saved state of every affected diagram and its contents, including components, relationships, groups, ADRs, links, and metadata. In both modes, any change to these after preview and before mutation MUST reject stale confirmation without deletion and require a fresh preview and confirmation, including for non-interactive execution; name resolution MUST NOT silently switch to a different UUID.
- **FR-012**: Each hierarchy operation MUST succeed as a whole or leave the saved state unchanged. Invalid hierarchy references or dependencies outside the subtree that would become broken MUST block deletion with diagnostics identifying the affected artifacts and a next action. Unrelated data MUST remain unchanged.
- **FR-013**: The command MUST report confirmed success only after the operation is committed, identifying the root name and UUID, deletion mode, and affected diagrams. It MUST provide a success exit status on success and a non-success exit status for invalid usage, cancellation, or failure, with diagnostics on standard error. Uncertain outcomes caused by interrupted responses MUST instruct the author to verify saved state before retrying.
- **FR-014**: Built-in help MUST explain name versus UUID selection, exact matching, duplicate-name handling, both deletion modes, recursive scope, confirmation for interactive and scripted use, and common failures.
- **FR-015**: Deletion MUST operate on saved state in the existing configured single-user system. Existing list, name-filter, export, and recovery behavior MUST remain unchanged; this feature MUST NOT introduce accounts, permissions, workspaces, standalone component deletion, bulk root deletion, or a CLI restoration workflow.
- **FR-016**: Validation MUST cover both selectors and modes, exact and ambiguous names, active and trashed descendants, cancellation, stale confirmation (including saved content changes with unchanged names, statuses, and hierarchy in interactive and non-interactive execution), hierarchy and dependency errors, failure atomicity, Trash restoration integrity, permanent removal, and preservation of unrelated artifacts.

### Key Entities

- **Diagram Selector**: An explicit saved name or stable UUID identifying one eligible root; exact names may require UUID disambiguation.
- **Diagram Hierarchy**: A selected root and its recursively owned descendant diagrams, connected through stable parent-child references.
- **Contained Architecture Artifacts**: Components, relationships, groups, ADRs, links, and metadata owned by each affected diagram.
- **Deletion Impact and Confirmation**: The selected mode, resolved root, reviewed diagram set and saved contents, and explicit author decision authorizing that state and scope.
- **Recoverable Trash Batch**: Diagrams moved together to Trash, retaining stable identities and recovery provenance without absorbing independently trashed descendants.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of validation cases with exact names, case variants, whitespace variants, partial names, UUID-like names, and duplicates, the command selects exactly one intended root or refuses safely; it never deletes an unintended root.
- **SC-002**: In 100% of successful Trash-and-restore cases containing children and grandchildren, all affected diagram contents, UUIDs, and references are retained, and previously trashed descendants keep their prior recovery behavior.
- **SC-003**: In 100% of successful permanent-deletion cases, the selected root, all descendants of either status, and their contained artifacts are absent from active views and Trash, with unrelated artifacts unchanged.
- **SC-004**: In 100% of tested invalid-input, ambiguity, cancellation, absent-confirmation, stale-confirmation (including saved content changes with unchanged names, statuses, and hierarchy), invalid-hierarchy, dependency-conflict, and rejected-operation cases, no unintended or partial saved changes occur and the command reports a non-success outcome with a next action.
- **SC-005**: At least 90% of first-time authors can use built-in help to select the intended diagram, choose a mode, and complete a confirmed deletion within two minutes without separate instructions.

## Assumptions

- "Children" means recursively owned child diagrams at every supported level, plus the contents owned by each removed diagram; it does not mean diagrams with similar names or diagrams merely referenced by a relationship.
- Exact name matching is case-sensitive and whitespace-sensitive. Duplicate names are allowed and must be resolved by UUID rather than bulk deletion.
- Both modes are explicit; confirmation is separate from choosing a selector and mode, including for scripts.
- Permanent deletion can start from an active or trashed root and includes independently trashed descendants. Trash retains the existing active-descendant and recovery-batch rules.
- The existing configured connection, stable UUIDs, hierarchy ownership, Trash, and restoration workflows are dependencies. Permanent removal extends deletion capability while retaining their integrity safeguards.
- CLI deletion affects persisted data only. Authors must save any browser edits they want retained before running it; unsaved edits are not included in recovery.
- No new graphical interface, bulk deletion of multiple roots, restore command, backup feature, authentication, or collaboration capability is included. Existing list filtering continues to use its current matching rules.
