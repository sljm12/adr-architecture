# Feature Specification: CLI Diagram Deletion

**Feature Branch**: `main` (no branch creation hook configured)

**Created**: 2026-10-11

**Updated**: 2026-10-13

**Status**: Draft

**Input**: User description: "For the cli feature I would like to add a feature to be able to delete Diagrams and their children using their Name or their uuid. I should be able to specify if i want to move it to Trash or delete it permanently. For matching the name it should be an exact match."

**Update**: "Now the cli can only delete if the name has one and only one matching name. Add a flag to delete all with the same name. Also add a feature to clear the trash."

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

An architecture author uses help and clear diagnostics to select the intended roots, understand the deletion mode, and distinguish success, cancellation, and failure from command results.

**Why this priority**: Exact targeting and clear outcomes make destructive commands usable both interactively and in scripts.

**Independent Test**: Exercise duplicate names, near matches, invalid selectors, missing or conflicting modes, cancellation, changed impact, and unavailable service. Verify actionable feedback and no unintended data changes.

**Acceptance Scenarios**:

1. **Given** two eligible diagrams have the identical name, **When** the author selects that name without `--all-matches`, **Then** the command refuses to choose a root, reports each matching name, UUID, and status, and instructs the author to select a UUID or explicitly use `--all-matches` to target every eligible exact-name match.
2. **Given** only "Payments API" exists, **When** the author selects the name "Payments", **Then** the command reports no exact match and changes nothing.
3. **Given** no deletion mode or both modes are supplied, or the selector is missing, invalid, or conflicting, **When** the command runs, **Then** it reports invalid usage without changing any diagram.
4. **Given** a confirmation preview has been shown, **When** any selected root identity, displayed name or status, affected diagram set, or affected diagram's saved contents changes before deletion, **Then** either deletion mode refuses the stale confirmation without deleting anything and requires a fresh preview and confirmation, including when only a component, relationship, group, ADR, link, or metadata changes.
5. **Given** the system is unavailable or rejects deletion, **When** the command runs, **Then** it reports the failure with a next action and does not claim success; an interrupted response with an uncertain outcome tells the author to verify the saved state before retrying.
6. **Given** the author uses a script without interactive input, **When** explicit confirmation is absent, **Then** deletion does not proceed; an explicitly supplied non-interactive confirmation can authorize the resolved operation.
7. **Given** deletion succeeds, **When** the command finishes, **Then** its result identifies every selected root by name and UUID, the chosen mode, and the affected diagrams, and returns a success exit status.

---

### User Story 4 - Delete every exact-name match (Priority: P1)

An architecture author supplies `--all-matches` with an exact name to move every eligible matching diagram hierarchy to Trash or permanently delete them in one confirmed operation.

**Why this priority**: Authors can remove duplicate-named work without running a separate command for each UUID, while keeping single-target deletion safe by default.

**Independent Test**: Create multiple diagrams named "Payments", case and partial-name variants, and overlapping matching parent/child hierarchies. Run each deletion mode with `--all-matches`; verify the preview, unique affected set, mode eligibility, confirmation, and preservation of unrelated diagrams.

**Acceptance Scenarios**:

1. **Given** several active diagrams named "Payments" and near matches named "payments" or "Payments API", **When** the author selects "Payments" with `--all-matches` and confirms Trash, **Then** every active exact-name match and its active descendants move to Trash together, and near matches outside those hierarchies remain unchanged.
2. **Given** active and trashed diagrams share the exact name, **When** the author confirms permanent deletion with `--all-matches`, **Then** all matching roots of either status and all their descendants are permanently removed; Trash mode selects only active matching roots.
3. **Given** both a parent and its descendant match the name, **When** deletion is previewed and confirmed, **Then** both matching identities are reported as selected, each affected diagram is listed and processed once, and Trash preserves coherent recovery provenance.
4. **Given** zero or one eligible exact-name match, **When** the flag is supplied, **Then** zero matches fail without changes and one match follows the existing single-root behavior.
5. **Given** the flag is supplied without a name or with a UUID selector, **When** the command runs, **Then** it reports invalid usage without mutation.
6. **Given** a multi-root preview has been shown, **When** an eligible matching root is added, removed, renamed, or changes eligibility, or any affected saved state changes before execution, **Then** the entire operation rejects stale confirmation and requires a fresh preview and confirmation, including for scripted execution.
7. **Given** any selected hierarchy is invalid, has an external dependency that would break, or fails during deletion, **When** the multi-root operation runs, **Then** no selected hierarchy is partially changed and actionable diagnostics identify the problem.

---

### User Story 5 - Clear Trash permanently (Priority: P1)

An architecture author clears all saved diagrams currently in Trash with one explicitly confirmed action, freeing retained work that no longer needs recovery.

**Why this priority**: Trash can be emptied without finding and permanently deleting each retained diagram individually.

**Independent Test**: Populate Trash with independent batches and nested diagrams alongside active diagrams. Confirm clearing Trash and verify all trashed diagrams and owned artifacts are absent, recovery is unavailable for them, and active diagrams remain unchanged. Repeat with empty Trash, cancellation, stale state, and a blocking dependency.

**Acceptance Scenarios**:

1. **Given** Trash contains diagrams from multiple recovery batches, **When** the author previews clearing Trash, **Then** the command lists every affected diagram by name, UUID, and status, reports the total, and warns that all their contained artifacts, ADRs, and recovery data will be removed irreversibly.
2. **Given** the author explicitly confirms that preview, **When** clearing succeeds, **Then** all reviewed trashed diagrams and their owned artifacts are permanently removed in one operation, cannot be restored, and active diagrams and their contents remain unchanged.
3. **Given** Trash is empty, **When** the author clears it, **Then** the command reports that Trash is already empty with a success exit status, makes no changes, and requires no confirmation.
4. **Given** Trash is nonempty, **When** the author cancels or supplies no explicit non-interactive confirmation, **Then** nothing is removed and the command reports a non-success outcome.
5. **Given** a preview has been shown, **When** a diagram enters or leaves Trash or any affected saved data changes before execution, **Then** clearing rejects stale confirmation without changes and requires a fresh preview and confirmation.
6. **Given** clearing would break a dependency from an active diagram or would require deleting an active descendant, or any removal fails, **When** clearing is attempted, **Then** the entire operation fails without changes and identifies the blocker and a next action.
7. **Given** the author supplies a name, UUID, `--all-matches`, or a deletion-mode option with the clear-Trash action, **When** the command runs, **Then** it reports invalid usage without mutation because this action always targets all Trash and is always permanent.

### Edge Cases

- Names differ only by capitalization, leading or trailing spaces, punctuation, or Unicode characters; matching compares the complete saved name without case folding, trimming, substring matching, or wildcard interpretation.
- A name looks like a UUID; explicit name selection treats it as a name rather than guessing the selector type.
- An empty or whitespace-only name, malformed UUID, extra root selector, or conflicting deletion modes is rejected without mutation.
- Duplicate exact names exist across active diagrams and Trash; permanent deletion searches both and remains ambiguous without `--all-matches`, while Trash searches active diagrams only.
- Multiple matching roots overlap through ancestry; the affected union contains each UUID once. Matching roots contained beneath another selected root do not create a second Trash batch for the same subtree.
- The matching root set changes during confirmation, even if previously selected hierarchies are unchanged; `--all-matches` requires fresh confirmation rather than silently ignoring or adding matches.
- Empty Trash is a successful no-op. A diagram entering or leaving nonempty Trash after preview invalidates clear-Trash confirmation.
- Trash contains an active descendant or references from outside the removal set; clearing must not delete active data or leave broken references and instead fails without mutation.
- A diagram has no children, or the selected root is a leaf; the operation affects just that diagram and its contents.
- A root is already trashed; Trash reports that it is not active without changing its recovery batch, while permanent deletion remains available.
- A hierarchy contains both active and previously trashed descendants; Trash preserves earlier batches, while permanent deletion includes both statuses.
- The root is renamed, moved to Trash, restored, or removed, or a descendant is added or removed while confirmation is pending; stale confirmation cannot authorize a different target or set.
- Saved components, relationships, groups, ADRs, links, or metadata change in any affected diagram after preview, even if names, statuses, and the hierarchy stay the same; both modes reject stale confirmation and require a new preview and confirmation, including for non-interactive execution.
- Saved hierarchy references are missing or cyclic, or external dependencies would be broken; the command refuses deletion with actionable diagnostics.
- A failure occurs while changing one of several hierarchies or clearing Trash; no partial changes across the entire invocation are committed.
- An open browser contains unsaved edits; the CLI operates on saved data only and does not capture those edits or allow a later save to silently resurrect deleted artifacts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Diagram deletion MUST select exactly one root by an explicit saved name or stable UUID by default. Only an explicit `--all-matches` flag with name selection MAY select multiple roots. Missing, multiple, conflicting, empty, whitespace-only, or malformed selectors MUST fail without mutation. Clear Trash is a separate action requiring no root selector.
- **FR-002**: Name selection MUST match the complete saved diagram name exactly, including case and whitespace, with no trimming, normalization, partial matching, or wildcard expansion. A name resembling a UUID MUST remain selectable as a name.
- **FR-003**: Without `--all-matches`, a name MUST resolve to exactly one eligible diagram. Zero matches MUST produce a no-match error; multiple matches MUST produce an ambiguity error listing the matching names, UUIDs, and statuses and explaining UUID selection or `--all-matches`. The command MUST NOT pick the first match or implicitly select all matches.
- **FR-004**: For selector-based diagram deletion, the author MUST explicitly choose either Trash or permanent deletion. Neither mode MUST be inferred by default, and supplying both MUST be rejected before mutation. The separate clear-Trash action is explicitly permanent and accepts neither mode option.
- **FR-005**: Trash selection MUST consider active diagrams only. Permanent deletion selection MUST consider both active and trashed diagrams. UUID selection MUST obey the same status eligibility rules.
- **FR-006**: Selector-based deletion scope MUST follow saved parent-child identities recursively, including children and grandchildren, rather than name similarity. Selecting a child MUST affect its subtree only; ancestors, siblings, and its owning component outside the union of selected subtrees MUST be preserved.
- **FR-007**: Trash MUST move the selected active root and all active descendants to recoverable Trash as one coherent operation, preserving all contained artifacts, ADRs, stable UUIDs, metadata, and references. Previously trashed descendants MUST retain their existing recovery provenance, consistent with the existing recovery workflow.
- **FR-008**: Permanent deletion MUST remove the selected root and every descendant, including previously trashed descendants, together with each removed diagram's components, relationships, groups, ADRs, links, and recovery metadata. None of that removed content MUST remain available through active views or Trash recovery.
- **FR-009**: Before mutation, the CLI MUST present the action and mode, every selected root name and UUID where applicable, and the unique affected diagram names, UUIDs, statuses, and total count. Confirmation MUST explain the effect on contained artifacts and ADRs and distinguish recoverable Trash from irreversible permanent deletion, including clearing Trash.
- **FR-010**: Both deletion modes, single-root or multi-root, and nonempty Trash clearing MUST require explicit confirmation. Interactive refusal or cancellation MUST change nothing. Non-interactive execution MUST require an explicit confirmation option and otherwise fail without mutation rather than waiting indefinitely or treating absent input as consent. Empty Trash clearing is a no-op exempt from confirmation.
- **FR-011**: Confirmation MUST be bound to the action, resolved root UUID set where applicable, mode, displayed names and statuses, affected diagram set, and saved state of every affected diagram and its contents, including components, relationships, groups, ADRs, links, and metadata. Any change after preview and before mutation MUST reject stale confirmation without deletion and require a fresh preview and confirmation, including for non-interactive execution. For `--all-matches`, the entire eligible exact-name match set MUST still equal the previewed set; for clearing Trash, the entire Trash membership MUST still equal the previewed set. Resolution MUST NOT silently substitute, add, or omit identities.
- **FR-012**: Each invocation MUST succeed as a whole or leave the saved state unchanged, including all selected hierarchies or all Trash entries. Invalid hierarchy references or dependencies outside the complete affected set that would become broken MUST block deletion with diagnostics identifying the affected artifacts and a next action. References entirely within the removed set MUST NOT be treated as external blockers. Unrelated data MUST remain unchanged.
- **FR-013**: The command MUST report confirmed mutation success only after the operation is committed, identifying the action, selected root names and UUIDs where applicable, mode, unique affected diagrams, and total count. It MUST provide a success exit status on success, including empty Trash, and a non-success exit status for invalid usage, cancellation, or failure, with diagnostics on standard error. Uncertain outcomes caused by interrupted responses MUST instruct the author to verify saved state before retrying.
- **FR-014**: Built-in help MUST explain name versus UUID selection, exact matching, default duplicate-name refusal, `--all-matches` and its name-only restriction, both deletion modes, recursive and overlapping scope, clear-Trash permanent scope, confirmation for interactive and scripted use, and common failures.
- **FR-015**: Deletion MUST operate on saved state in the existing configured single-user system. Existing list, name-filter, export, and recovery behavior for retained diagrams MUST remain unchanged; this feature MUST NOT introduce accounts, permissions, workspaces, standalone component deletion, arbitrary multi-name or multi-UUID deletion, or a CLI restoration workflow.
- **FR-016**: Validation MUST cover both selectors and modes, exact and ambiguous names, active and trashed descendants, cancellation, stale confirmation (including saved content changes with unchanged names, statuses, and hierarchy in interactive and non-interactive execution), hierarchy and dependency errors, failure atomicity, Trash restoration integrity, permanent removal, and preservation of unrelated artifacts.
- **FR-017**: With `--all-matches` and one exact name, deletion MUST select every eligible matching root using FR-002 and FR-005, accept one match, and reject zero matches. The flag MUST be rejected without a name or with UUID selection and MUST NOT replace mode choice or confirmation.
- **FR-018**: Multi-root deletion MUST apply each mode's recursive scope to the union of selected hierarchies, list and process each affected UUID once, and preserve existing Trash provenance. Overlapping roots MUST form one coherent recovery batch per outermost selected subtree; disjoint selected subtrees MUST remain independently recoverable through the existing recovery workflow.
- **FR-019**: The CLI MUST provide a separate clear-Trash action that permanently removes every saved trashed diagram, its owned artifacts and ADRs, links, and recovery metadata across all batches. It MUST NOT remove active diagrams or their owned contents. Active descendants requiring removal or external references that would break MUST block the entire operation; no active diagram may be silently included.
- **FR-020**: Clear Trash MUST reject root selectors, `--all-matches`, and deletion-mode options. Empty Trash MUST return a successful already-empty result with zero affected diagrams, no mutation, and no confirmation prompt. Nonempty Trash MUST use the preview, confirmation, stale-state, atomicity, and outcome safeguards in FR-009 through FR-013.
- **FR-021**: Validation MUST additionally cover flag misuse, zero/one/multiple eligible matches, matching roots across statuses and overlapping hierarchies, changing match sets, recovery of disjoint batches, cross-root dependencies, rollback across roots, empty/nonempty Trash, changing Trash membership, active-data protection, clear-Trash rollback, and permanent loss of recovery after clearing.

### Key Entities

- **Diagram Selector**: An explicit saved name or stable UUID identifying one eligible root by default; `--all-matches` explicitly expands name selection to every eligible exact-name match.
- **Diagram Hierarchy**: A selected root and its recursively owned descendant diagrams, connected through stable parent-child references.
- **Contained Architecture Artifacts**: Components, relationships, groups, ADRs, links, and metadata owned by each affected diagram.
- **Deletion Impact and Confirmation**: The action, selected mode, resolved roots or Trash membership, unique reviewed diagram set and saved contents, and explicit author decision authorizing that state and scope.
- **Trash Collection**: All saved trashed diagrams across recovery batches; clearing permanently removes this collection while preserving active data.
- **Recoverable Trash Batch**: Diagrams moved together to Trash, retaining stable identities and recovery provenance without absorbing independently trashed descendants.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of validation cases with exact names, case variants, whitespace variants, partial names, UUID-like names, and duplicates, the command selects exactly one intended root by default, every eligible exact-name match only with `--all-matches`, or refuses safely; it never deletes an unintended root.
- **SC-002**: In 100% of successful Trash-and-restore cases containing children and grandchildren, all affected diagram contents, UUIDs, and references are retained, and previously trashed descendants keep their prior recovery behavior.
- **SC-003**: In 100% of successful permanent-deletion cases, the selected root, all descendants of either status, and their contained artifacts are absent from active views and Trash, with unrelated artifacts unchanged.
- **SC-004**: In 100% of tested invalid-input, ambiguity, cancellation, absent-confirmation, stale-confirmation (including saved content changes with unchanged names, statuses, and hierarchy), invalid-hierarchy, dependency-conflict, and rejected-operation cases, no unintended or partial saved changes occur and the command reports a non-success outcome with a next action.
- **SC-005**: At least 90% of first-time authors can use built-in help to select the intended diagram, choose a mode, and complete a confirmed deletion within two minutes without separate instructions.
- **SC-006**: In 100% of successful multi-root validation cases, every eligible exact-name match is selected, each affected diagram is processed once, unrelated artifacts remain unchanged, and recoverable deletions retain correct restoration behavior.
- **SC-007**: In 100% of successful nonempty clear-Trash cases, zero reviewed trashed diagrams or owned artifacts remain recoverable and all active artifacts remain unchanged; empty Trash clearing succeeds with zero changes.
- **SC-008**: In 100% of tested multi-root and clear-Trash cancellation, stale-state, dependency-conflict, and injected-failure cases, the entire saved state remains unchanged and feedback identifies the next action.

## Assumptions

- "Children" means recursively owned child diagrams at every supported level, plus the contents owned by each removed diagram; it does not mean diagrams with similar names or diagrams merely referenced by a relationship.
- Exact name matching is case-sensitive and whitespace-sensitive. Duplicate names are allowed; the default requires UUID disambiguation, while `--all-matches` explicitly selects all eligible exact-name matches.
- Selector-based deletion requires an explicit mode; clear Trash is explicitly permanent. Confirmation is separate from choosing a selector, mode, or action, including for scripts.
- Permanent deletion can start from an active or trashed root and includes independently trashed descendants. Trash retains the existing active-descendant and recovery-batch rules.
- The existing configured connection, stable UUIDs, hierarchy ownership, Trash, and restoration workflows are dependencies. Permanent removal extends deletion capability while retaining their integrity safeguards.
- CLI deletion affects persisted data only. Authors must save any browser edits they want retained before running it; unsaved edits are not included in recovery.
- "Clear Trash" means permanent removal of all saved trashed diagrams, rather than restoration or deletion of active diagrams. It requires explicit confirmation when nonempty and shares permanent deletion's integrity safeguards.
- `--all-matches` is the name-selection flag; choosing it does not authorize mutation without separate confirmation. The precise clear-Trash command spelling will be recorded in the command contract during planning.
- No new graphical interface, arbitrary multi-name or multi-UUID deletion, restore command, backup feature, authentication, or collaboration capability is included. Existing list filtering continues to use its current matching rules.
