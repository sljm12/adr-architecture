# Quickstart Validation: Software Architecture Diagrams

## Prerequisites

- Node.js and package manager installed.
- PostgreSQL running with the project schema/migrations applied.
- A Mermaid-compatible previewer available for the export smoke test.

## Validation commands

From the repository root, run the project scripts after the application scaffold is created:

```text
<package-manager> install
<package-manager> run db:migrate
<package-manager> run test
<package-manager> run test:e2e
```

The REST boundary is defined in [contracts/openapi.yaml](./contracts/openapi.yaml), and entity
invariants are defined in [data-model.md](./data-model.md).

## Acceptance scenarios

1. Create a diagram, add five uniquely identified components and five relationships, rename and
   reposition one component, wait for the saved status, reopen, and verify all names, endpoints,
   labels, directions, positions, and IDs are preserved.
2. Create both directed and undirected relationships and verify the Mermaid output preserves both
   forms and renders in a compatible previewer.
3. Enter punctuation, non-Latin text, duplicate names, and Mermaid-reserved characters; verify
   distinguishability, safe escaping, or an actionable entity-specific validation error.
4. Remove a connected component, verify the dependent-relationship warning, cancel once, then
   confirm and verify the component and all dependent relationships disappear together.
5. Make an edit, undo it, redo it, switch diagrams, and verify history is scoped to the active session.
6. Move a diagram to trash, verify it leaves the active list, restore it, and verify its content and
   IDs are unchanged.
7. Trigger export while autosave is pending and verify the current valid draft is exported or a clear
   reason is shown; invalid/empty diagrams must not download a misleading file.
8. Simulate save failure and recovery; verify the draft remains visible, failed status is announced,
   and retry reaches saved status.
9. Complete create/edit/delete/export flows using keyboard navigation and verify labels, focus order,
   contrast, and success/error announcements.

