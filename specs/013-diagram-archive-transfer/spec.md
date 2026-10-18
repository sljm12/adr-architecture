# Feature Specification: Lossless Diagram Export and Import

**Feature Branch**: `013-diagram-archive-transfer`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Create a new branch, new specification. The user shall be able to export a file that will have all the information necessary to import the same file back into the system. It shall preserve all the information that is stored in the database. Check if UUID is the best key to be transport over. If UUID is the best format, then while importing the digram into a database with the same UUIDs inform the user if he would want to override the information."

## Clarifications

### Session 2026-10-18

- Q: Should export cover one diagram hierarchy, the entire saved collection, or offer both choices? → A: Selected diagram's complete hierarchy and required dependencies, including their Trash records.
- Q: Should recovery undo the entire import, including diagrams it newly added? → A: Restore overwritten contents and keep added diagrams; block recovery if their dependencies would break.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export and restore complete architecture data (Priority: P1)

An architecture author exports a saved diagram into one portable file and imports that file into an empty installation, retaining all saved information and the ability to edit, navigate, and recover the diagrams normally.

**Why this priority**: A transfer is useful only if the file can reconstruct the original architecture knowledge without missing decisions, references, or metadata.

**Independent Test**: Export a populated hierarchy with general, container, and component diagrams, active and trashed diagrams, groups, relationships, every ADR lifecycle state, replacement decisions, and both kinds of ADR links. Import into an empty installation, compare every persisted value and reference, then navigate, edit, and restore representative imported diagrams.

**Acceptance Scenarios**:

1. **Given** a saved diagram hierarchy with representative architecture data, **When** the author exports it, **Then** one downloadable file contains every persisted record and value in the declared scope, including identities, timestamps, links, layout, and recovery metadata.
2. **Given** that file and an empty installation, **When** the author imports it, **Then** all included diagrams and artifacts are reconstructed with their original identities, values, relationships, and active or trashed states; the original installation is not needed.
3. **Given** the selected diagram is a child or depends on saved artifacts outside its subtree, **When** export is prepared, **Then** the author sees the complete included diagram list, including required ancestor hierarchies and dependencies, and the exported file has no unresolved saved references.
4. **Given** imported data has not subsequently changed, **When** it is exported again, **Then** its persisted artifact values equal the original export, regardless of file ordering or export-specific metadata.
5. **Given** the selected diagram has unsaved browser edits, **When** export is requested, **Then** the author is told that export uses saved data and can save before retrying or explicitly continue with the saved version.

---

### User Story 2 - Review and approve replacement of matching identities (Priority: P1)

An architecture author imports an earlier export into an installation that already contains some of the same UUIDs, reviews what will change, and explicitly chooses whether to override the matching saved information.

**Why this priority**: Reimporting into the original installation is expected, and automatic replacement could destroy newer architecture work.

**Independent Test**: Modify an exported hierarchy in the destination, including adding and removing owned artifacts, and import the earlier file. Verify the conflict preview, cancellation, confirmed replacement, recovery of overwritten contents while retaining newly added diagrams, dependency blocking, and preservation of unrelated data.

**Acceptance Scenarios**:

1. **Given** any incoming diagram or artifact identity already exists, **When** the file is reviewed, **Then** the author sees the matching diagrams and artifacts by name where available, type, and UUID, the counts of additions, replacements, removals, and unchanged records, and an explicit choice to override or cancel before anything is saved.
2. **Given** the author cancels, dismisses the review, or supplies no confirmation, **When** the import ends, **Then** no saved information changes, including nonconflicting records in the same file.
3. **Given** a reviewed import contains new and matching diagrams, **When** the author explicitly confirms override, **Then** new diagrams are added and matching diagrams' owned contents become exactly the file's saved snapshot, including removal of destination-only owned records shown in the preview.
4. **Given** incoming records exactly match saved records, **When** import is reviewed, **Then** matching UUIDs are still disclosed and confirmation is required, but unchanged records are identified and successful reimport creates no duplicates or artificial timestamp changes.
5. **Given** a destination-only diagram depends on an artifact that replacement would remove or invalidate, **When** import is reviewed, **Then** the entire import is blocked with the affected identities and a next action; the dependent diagram is not silently deleted or modified.
6. **Given** a replacement has completed and recovery would preserve valid references, **When** the author imports the recovery file and confirms its reviewed changes, **Then** overwritten diagrams regain their prior saved contents, including records removed by replacement, while diagrams newly added by the original import remain unchanged.
7. **Given** a diagram newly added by the original import depends on contents that recovery would remove or invalidate, **When** the author attempts recovery, **Then** the entire recovery is blocked without changes and identifies the dependency and a corrective action; the newly added diagram is not automatically deleted.

---

### User Story 3 - Reject unsafe files and stale decisions (Priority: P2)

An architecture author receives actionable feedback for an invalid file, changed destination, or interrupted operation and can retry without leaving partially imported architecture data.

**Why this priority**: Import accepts external data and may replace valuable saved information; failures must be understandable and preserve integrity.

**Independent Test**: Review files with malformed content, unsupported versions or fields, duplicate identities, missing references, invalid ownership, and invalid values. Change the file or saved destination after review and inject a save failure. Verify clear feedback and zero partial changes.

**Acceptance Scenarios**:

1. **Given** a file is malformed, unsupported, incomplete, or invalid, **When** import is attempted, **Then** the author receives the failing record or field and a corrective action, and nothing is saved or silently discarded.
2. **Given** an import preview has been shown, **When** the file, identity collision set, or any saved data affecting the reviewed outcome changes before confirmation is applied, **Then** the operation refuses that review and requires a fresh preview and confirmation.
3. **Given** a failure occurs while saving some of the imported data, **When** the operation ends, **Then** the entire destination remains as it was before import and the author is told that import failed.
4. **Given** import succeeds, **When** completion is displayed, **Then** the result identifies the included diagrams and counts of added, replaced, removed, and unchanged records, and the saved results remain available after reload.
5. **Given** the connection is interrupted before the final outcome is known, **When** feedback is displayed, **Then** the outcome is described as uncertain with instructions to inspect saved data before retrying; success is not assumed.
6. **Given** the author uses only a keyboard, **When** they export, select a file, review conflicts, confirm, or cancel, **Then** controls, impact information, errors, and results are accessible with readable labels and clear focus.

### Edge Cases

- A diagram has no components, relationships, groups, or ADRs; it still exports and imports successfully.
- A selected child requires its ancestors, an external participant's canonical source, or a Trash recovery root; the export includes complete required hierarchies and reports the expanded scope.
- Active and independently trashed descendants belong to different recovery batches; import preserves those distinct recovery relationships.
- Two diagrams have the same name but different UUIDs; neither name equality nor similar layout causes replacement.
- A component, relationship, group, ADR, or link collides even when its incoming diagram UUID does not; the conflict cannot bypass review.
- The same artifact UUID exists under a different destination owner; import blocks rather than moving it implicitly, even if override was requested.
- Link and membership identities consist of their existing endpoint UUIDs; repeated pairs inside the file are rejected, and existing pairs participate in conflict review.
- A file repeats the same UUID with different letter casing; identity comparison treats these as the same UUID.
- Long text, Unicode, empty strings, null values, fractional layout values, full stored timestamp precision, and large revision counters must survive without trimming, default substitution, or rounding.
- Hierarchy cycles, duplicate ownership, dangling endpoints, invalid group membership, invalid ADR replacements, and impossible recovery references are rejected before saving.
- Replacement would break a retained child diagram, external participant, ADR link, or recovery batch; the entire import is blocked until that dependency is resolved.
- Recovery would remove a component required by a diagram added during the original import; recovery is blocked even if no edits occurred after that import.
- Export overlaps with another save; the file reflects one coherent saved state rather than a mixture of old and new records.
- An export fails validation or download preparation; it does not produce a file claimed to be a complete successful export.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The browser application MUST let an author export a saved active or trashed diagram to one file and import that file into the same or another compatible installation.
- **FR-002**: Export scope MUST include the selected diagram's entire top-level hierarchy, including all descendants regardless of Trash status. Required references outside that hierarchy MUST recursively bring in their complete owning hierarchies, including recovery roots, until every saved reference resolves within the file. Each record MUST appear once. The author MUST see and approve the included diagram names, UUIDs, statuses, and scope expansion before downloading.
- **FR-003**: The file MUST preserve every persisted application record and field in that scope. The preservation inventory below is mandatory; existing viewing and presentation exports MUST NOT be assumed to contain enough information for this workflow.
- **FR-004**: Export MUST capture one coherent saved state and MUST validate its completeness and reference integrity. Missing, unsupported, or inconsistent stored information MUST cause an actionable export failure rather than partial output or silent normalization. Unsaved edits MUST be handled as described in User Story 1, scenario 5.
- **FR-005**: Each file MUST identify its format version, export time, selected diagram, and included diagram scope. Import MUST accept supported versions and reject unsupported versions or fields without silently stripping data. Export-specific metadata MUST be distinguishable from original persisted timestamps and values.
- **FR-006**: Import and export MUST retain existing UUID values for diagrams, components, relationships, groups, ADRs, and all references, without remapping or generating replacement identities. UUID equality MUST ignore hexadecimal letter casing. Existing link and membership identity MUST remain the pair of endpoint UUIDs; no new independent identity is required for these records.
- **FR-007**: Before any mutation, import MUST validate the entire file's structure, field values, unique identities, required data, ownership, hierarchy, relationship endpoints, group membership, ADR lifecycle and replacement references, source references, and Trash recovery consistency. The result MUST be valid both independently and together with retained destination data. Duplicate definitions, including identical duplicates, MUST be rejected rather than resolved by file order.
- **FR-008**: Import MUST compare identities for every included artifact type and link or membership pair against the destination, including trashed records. Names MUST NOT act as identity keys. A collision under an incompatible destination owner MUST block import with an explanation rather than imply permission to relocate data.
- **FR-009**: Before import, the author MUST receive a preview identifying included diagrams, conflicting artifact types and UUIDs, available names, statuses, and additions, replacements, removals, and unchanged records. If any identity already exists, the system MUST explicitly ask whether to override saved information. The default and dismissal outcome MUST be cancellation without mutation; confirmation applies to the whole reviewed file rather than a partial selection of records.
- **FR-010**: A confirmed override MUST treat each included diagram's saved contents as an authoritative snapshot: retain its incoming identities and field values, replace differing owned records, add missing records, and remove destination-only components, relationships, groups, ADRs, links, and memberships owned by that included diagram. Unchanged records MUST remain unchanged. Diagram identities absent from the file and their contents MUST be retained; their dependencies MUST be checked under FR-011.
- **FR-011**: Import MUST preserve destination data outside the reviewed scope. A retained diagram or artifact that would become invalid due to replacement, removal, hierarchy or status changes, or ownership conflicts MUST block the entire operation with the dependent identities and a next action. Import MUST NOT expand its mutation scope or delete destination-only child diagrams implicitly.
- **FR-012**: Review and confirmation MUST be bound to the exact file and all destination information affecting the proposed result, including collision sets, owned content, and dependencies. Changes before saving MUST require a fresh preview and confirmation. Import MUST also invalidate earlier pending confirmations for operations on data it changes, even when imported timestamps or revision values are older or identical.
- **FR-013**: Import MUST complete as one operation: all reviewed changes become durable together or none do. Cancellation, invalid data, dependency conflicts, stale confirmation, or save failure MUST leave destination data unchanged. Reimport MUST never create duplicate artifacts or links.
- **FR-014**: Before replacing or removing existing data, the system MUST provide a downloadable recovery file containing the prior saved contents of every destination diagram being changed, with enough dependencies to restore them. Override MUST require acknowledgement that this file was saved. Recovery through the same import workflow MUST obey the same preview, confirmation, validation, and dependency protections. Recovery MUST restore overwritten contents while retaining diagrams newly added by the original import and MUST block the entire operation without changes if their dependencies would become invalid. The preview MUST explain that recovery restores overwritten contents and retains newly added diagrams; those diagrams MUST NOT be automatically deleted.
- **FR-015**: Export and import MUST preserve saved values exactly, including original creation, update, deletion, membership, and link timestamps at their stored precision; null and empty values; all text; numeric layout; and revision counters without precision loss. Import time MUST NOT replace original artifact timestamps or reset saved metadata. File ordering and UUID letter casing MAY differ without changing identity or meaning.
- **FR-016**: The workflow MUST give clear in-progress, success, cancellation, failure, and uncertain-outcome feedback. Success MUST follow durable completion and identify affected diagrams and record counts. Failures MUST identify the relevant record or field when known and a next action. Import MUST not discard open unsaved edits without the existing save or discard decision, and open views MUST reflect the resulting saved data after completion.
- **FR-017**: File selection, scope review, conflict review, recovery acknowledgement, confirmation, cancellation, and result feedback MUST support keyboard use, readable labels, clear focus, and accessible contrast consistent with the existing application.
- **FR-018**: Acceptance validation MUST cover every preservation-inventory field, a complete round trip into an empty installation, confirmed override, exact reimport, recovery, incompatible ownership, retained dependencies, invalid files and versions, stale confirmations, failure atomicity, unsaved edits, and normal navigation, editing, and Trash recovery after import. Field coverage MUST include information absent from ordinary diagram and ADR views.

### Preservation Inventory

| Saved information | Information that must survive export and import |
| --- | --- |
| Diagrams | UUID, name, kind, active or trashed state, creation and update timestamps, trashed timestamp, parent diagram, owning component, scope boundary coordinates and dimensions, recovery batch and root identities, and saved deletion revision counter. |
| Components | UUID, owning diagram, name, description, classification, role, container subtype, technology, canonical source component identity, position, dimensions, and creation and update timestamps. |
| Relationships | UUID, owning diagram, source and target component identities, direction, label, protocol, and creation and update timestamps. |
| System groups | UUID, owning diagram, name, boundary coordinates and dimensions, creation and update timestamps, and complete membership. |
| Group memberships | Group and component identities and the membership's own creation timestamp. |
| ADRs | UUID, owning diagram, title, context, decision, consequences, alternatives or constraints, lifecycle status, replacement ADR identity, and creation and update timestamps. |
| ADR component links | ADR and component identities and the link's own creation timestamp. |
| ADR relationship links | ADR and relationship identities and the link's own creation timestamp. |

### Identity Decision

Retain the existing UUIDs as the portable identity keys. This fits the project's stable-reference requirement and lets the same file identify the same artifacts across installations without a translation table. Names are editable and nonunique, while locally assigned sequential keys require coordination or remapping during transfer. Replacing existing UUIDs with another identifier scheme offers no required user benefit here.

[RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html#section-4) defines the standard hexadecimal UUID text representation; its guidance on [opacity](https://www.rfc-editor.org/rfc/rfc9562.html#section-6.12) supports treating identities as values rather than deriving business meaning from them. Export MUST use the standard hyphenated text form, and import MUST preserve the original identity and existing UUID version. This feature does not change how newly created artifacts receive identities. UUIDs make conflicts detectable; they do not authorize replacement, which remains subject to FR-008 through FR-014.

### Key Entities

- **Portable Diagram File**: A versioned, self-contained snapshot of the selected hierarchy and required supporting hierarchies, with all stored artifacts, references, field values, and an explicit scope.
- **Saved Architecture Graph**: Diagrams, components, relationships, groups, ADRs, and their ownership, source, replacement, membership, and decision links identified by stable UUIDs or existing endpoint pairs.
- **Recovery Provenance**: Active or trashed state, deletion time, batch and root identities, and saved revision information needed to preserve existing recovery behavior.
- **Import Preview and Confirmation**: The exact file, relevant destination state, complete effect, conflict identities, and explicit author decision covering that reviewed result.
- **Recovery File**: A portable snapshot of the prior destination data needed to recover changes made by an override.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of representative round-trip cases, every persisted record and field in the declared scope survives export, import into an empty installation, and re-export with equal values and zero unresolved references.
- **SC-002**: In 100% of collision cases, including collisions below the diagram level and exact reimports, the author sees the matching identities and an override decision before mutation; cancellation produces zero saved changes.
- **SC-003**: In 100% of approved override cases, included diagrams match the file snapshot, destination-only diagrams remain unchanged and valid, and reimport creates zero duplicate records or links.
- **SC-004**: In 100% of invalid-file, unsupported-content, incompatible-ownership, stale-review, dependency-conflict, and injected-save-failure cases, no partial saved changes occur and feedback provides a corrective action.
- **SC-005**: In 100% of tested override-and-recovery cases where retained diagrams remain valid, the saved recovery file restores overwritten diagrams' prior values and references, including records removed by override, while newly added diagrams remain unchanged. In 100% of recovery cases that would break retained diagrams' dependencies, recovery is blocked with zero saved changes and an actionable dependency report, including when no intervening edits occurred.
- **SC-006**: At least 90% of first-time authors can export a saved hierarchy and import it into an empty installation within three minutes without external instructions; all steps can be completed using a keyboard.

## Assumptions

- The confirmed scope is a selected saved diagram with its complete top-level hierarchy and required dependency hierarchies, including their Trash records. "All information stored in the database" means every persisted application value for that declared scope. Exporting the entire collection in one action is outside this feature.
- Selecting a child includes its complete top-level hierarchy so the file can restore independently with valid ownership. Scope expansion is disclosed before export; filtering descendants or choosing individual record subsets is outside this feature.
- The initial interface is the browser application. A new CLI command is outside this specification; existing export capabilities continue to serve their current purposes.
- Import is an explicit snapshot transfer. Record-by-record conflict resolution, cloning with new UUIDs, continuous synchronization, authentication, permissions, collaboration, and revision browsing are outside scope.
- Persistence refers to application artifacts and their metadata, including Trash and revision counters. Database deployment settings, migration bookkeeping, credentials, and browser-only selection, viewport, and undo history are not architecture artifact data and are outside scope.
- Compatible installations support the declared file version and artifact rules. Compatibility handling may translate representations only when every saved value and reference remains preserved; otherwise import fails explicitly.
- Existing hierarchy, source-reference, group, ADR lifecycle, and Trash invariants remain dependencies. Existing save, unsaved-change, and accessible interaction patterns should be reused.
- Recovery restores overwritten diagrams' pre-import contents and retains newly added diagrams. Dependencies created by the original import or subsequent edits can block recovery; newly added diagrams can be removed separately through existing deletion workflows when needed.
- The portable file is a fidelity-preserving data artifact. Its specific encoding, packaging, size limits, and performance budgets will be defined during planning, without relaxing the preservation or failure guarantees above.
