# Data Model: Software Architecture Diagrams

## Diagram (`diagrams`)

- `id: UUID` — primary key, generated once and immutable.
- `name: string` — required, trimmed, non-blank, human-readable.
- `status: active | trashed` — server-managed lifecycle state; ordinary lists return active records.
- `createdAt: timestamp`, `updatedAt: timestamp` — server-managed.
- `trashedAt: timestamp | null` — set when moved to trash and cleared on restore.

## Component (`components`)

- `id: UUID` — primary key, immutable across rename and repositioning.
- `diagramId: UUID` — required foreign key to the owning diagram.
- `name: string` — required, trimmed, non-blank; duplicate names are allowed.
- `description: string | null` — optional.
- `type: string | null` — optional architecture classification.
- `position: { x: number, y: number }` — required finite visual coordinates.
- `createdAt: timestamp`, `updatedAt: timestamp` — server-managed.

## Relationship (`relationships`)

- `id: UUID` — primary key, immutable.
- `diagramId: UUID` — required foreign key to the owning diagram.
- `sourceComponentId: UUID`, `targetComponentId: UUID` — required component foreign keys in the same diagram.
- `direction: directed | undirected` — required per relationship.
- `label: string | null` — optional, trimmed when present.
- `createdAt: timestamp`, `updatedAt: timestamp` — server-managed.

The service rejects missing, cross-diagram, or self-referential endpoints in the first release and
returns an actionable validation error.

## Layout and artifact document

The API exposes a diagram document containing diagram metadata, components, relationships, and their
positions. A complete document replacement is validated and written transactionally to the database
before a save is reported as successful. React Flow node/edge IDs are derived from these UUIDs and
are never persisted as the source of truth.

## Saved Diagram Summary

The saved-diagram view uses a summary derived from each active `Diagram`, rather than a separate
persisted entity. It contains `id`, `name`, `status`, and `updatedAt`, where `updatedAt` represents
the most recent successful persistence of the active document. The UI uses `id` as the selection
value, displays the name and last-saved time, and never treats the name as a unique key. An empty
summary collection represents that no non-deleted saved documents exist. Full components,
relationships, and layout are obtained only when the selected `id` is loaded.

## Invariants and lifecycle rules

1. Every artifact ID is a UUID and remains stable through ordinary edits.
2. Every component and relationship belongs to exactly one diagram.
3. Every relationship endpoint belongs to its relationship's diagram; no broken endpoint is persisted.
4. Component deletion requires confirmation in the UI and transactionally deletes all dependent relationships.
5. Diagram deletion moves the diagram to `trashed`; restore returns it to `active` without changing artifact IDs.
6. Trashed diagrams are excluded from active editing and normal lists but remain recoverable.
7. An explicit save reports success only after the complete validated document is committed to the
   database; a save failure leaves the local draft intact and sets an observable failed/unsaved state.
8. Mermaid export accepts only a fully validated document and produces no file when validation fails.
9. A failed or cancelled request to load another diagram leaves the active document and local
   history unchanged.
10. A successful load replaces the active document with the selected saved document and resets the
    local undo/redo history to that document.

## Future compatibility

ADR records and `adr_component_links` can reference `components.id` directly. Names, positions, and
React Flow representation can change without invalidating those references.
