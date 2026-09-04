# Research: Software Architecture Diagrams

## Decision: Domain artifacts are authoritative; React Flow is a visual adapter

**Rationale:** Components, relationships, and layout need stable UUIDs independent of screen
positions or editor-library identifiers. The editor can derive React Flow nodes and edges from the
validated domain document, then map user changes back into domain commands.

**Alternatives considered:** Persisting raw React Flow state was rejected because library-specific
IDs and edge shape details would couple the artifact format to the UI and make future import/export
or ADR links fragile.

## Decision: Use a shared validated document boundary with Zod

**Rationale:** The same schemas can validate client commands, API requests, persisted records, and
export input. Validation errors can retain field/entity context so the UI can identify the affected
component or relationship.

**Alternatives considered:** Frontend-only validation was rejected because it cannot protect the
backend from malformed clients or corrupted serialized artifacts.

## Decision: Autosave a debounced complete document through an idempotent replacement endpoint

**Rationale:** A single-document save payload keeps component, relationship, and layout updates
consistent and supports the clarified automatic-save requirement. Debouncing avoids a request for
every keystroke; the latest local draft remains visible while status reports saving, saved, or failed.
The server preserves IDs and updates timestamps transactionally.

**Alternatives considered:** Explicit Save was rejected by the clarification. Independent row-level
requests were rejected because partial saves could leave relationships or layout out of sync.

## Decision: Trash diagrams with a recoverable soft-delete state

**Rationale:** Deleting a diagram changes its lifecycle state rather than destroying its artifact.
Normal list queries exclude trashed diagrams, while a restore-capable trash query can recover the same
diagram and all its stable references.

**Alternatives considered:** Immediate hard deletion was rejected because the feature explicitly
requires recovery and the constitution requires a recoverable path for destructive operations.

## Decision: Remove dependent relationships transactionally after confirmed component deletion

**Rationale:** The UI warns with the dependent relationship count, while the backend rechecks the
dependency set and deletes the component plus its relationships in one transaction. This guarantees
that no relationship can remain with a missing endpoint.

**Alternatives considered:** Leaving broken relationships for manual repair was rejected because
broken references must not remain; silently deleting without confirmation was rejected by the
constitution.

## Decision: Mermaid flowchart export with explicit direction and escaping

**Rationale:** A flowchart is sufficient for common software components and relationships. Directed
relationships use an arrow edge and undirected relationships use a non-arrow edge; labels and node
text are escaped according to the exporter grammar. The exporter validates every artifact before
creating a download and reports the specific entity when safe representation is impossible.

**Alternatives considered:** Exporting raw labels verbatim was rejected because Mermaid-reserved
syntax could produce invalid or misleading files. Supporting a broader Mermaid grammar in the first
release was rejected to keep validation and error behavior predictable.

## Decision: REST API with transactional PostgreSQL persistence

**Rationale:** Fastify provides a small HTTP boundary, OpenAPI makes the user-facing contract
reviewable, and PostgreSQL/Drizzle provide foreign keys, uniqueness, timestamps, and transactional
document replacement. The schema is organized around diagrams, components, relationships, and layout
data so future ADR links can reference component UUIDs without migration of identities.

**Alternatives considered:** Browser-only storage was rejected because backend persistence is a
product constraint. A document-only JSON blob was rejected because endpoint integrity and future ADR
link queries require relational constraints.

## Decision: Session undo/redo is local history over domain commands

**Rationale:** The active editor can undo and redo changes immediately without introducing advanced
server revision history. Autosave persists the resulting current document; history is reset or scoped
when switching diagrams.

**Alternatives considered:** A server revision table was deferred because advanced revision history is
out of scope for the first release.

## Decision: Browse saved diagrams through active summaries and load by stable ID

**Rationale:** The existing active-diagram collection can provide a lightweight saved-diagram view
without duplicating full documents. Each summary includes the immutable diagram ID, name, lifecycle
state, and most-recent save time, allowing duplicate names to remain distinguishable. Selecting a
summary retrieves the complete document by ID, so the editor loads the exact saved artifact and its
component identities, relationships, labels, and layout.

**Alternatives considered:** Loading by diagram name was rejected because names may be duplicated
or renamed. Returning every full document in the saved-diagram view was rejected because it makes
the list heavier than needed and risks using stale content as the active document.

## Decision: Guard diagram switching with save, discard, or cancel

**Rationale:** The editor records whether its active document has changes not confirmed by a
successful save. Before loading a different saved diagram, it offers save (complete the save, then
load only on success), discard (load without retaining the local changes), or cancel (leave the
active diagram untouched). A loading failure leaves the current document and its local history in
place; a successful load resets history to the newly loaded document.

**Alternatives considered:** Switching immediately and relying on autosave was rejected because a
pending or failed save can lose edits. Keeping undo history across diagrams was rejected because it
would make a local command history affect a different artifact.

