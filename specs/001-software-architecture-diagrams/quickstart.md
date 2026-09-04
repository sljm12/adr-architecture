# Quickstart Validation: Software Architecture Diagrams

## Prerequisites

- Node.js and package manager installed.
- PostgreSQL running with the project schema/migrations applied.
- A Mermaid-compatible previewer available for the export smoke test.

## Validation commands

From the repository root, install dependencies and run the application checks:

```text
npm install
npm run build
npm test
npm run test:e2e
```

For a PostgreSQL deployment, set `DATABASE_URL`, apply `backend/drizzle/0001_initial.sql` with the
configured PostgreSQL migration runner, and then start the API. The API refuses to start when
`DATABASE_URL` is missing and always uses PostgreSQL persistence; browser and contract tests that
exercise production persistence require a reachable configured database.

Example startup commands:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/adr_diagram npm run dev --prefix backend
```

On PowerShell:

```powershell
$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/adr_diagram'
npm run dev --prefix backend
```

After applying the migration, run the persistence contract tests with the same configured URL:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/adr_diagram npm test -- --run backend/tests/contract/diagrams.test.ts backend/tests/persistence/diagram-repository.test.ts
```

The REST boundary is defined in [contracts/openapi.yaml](./contracts/openapi.yaml), and entity
invariants are defined in [data-model.md](./data-model.md).

## Acceptance scenarios

1. Create a diagram, add five uniquely identified components and five relationships, rename and
   reposition one component, explicitly save, restart the database-backed API, reopen the diagram,
   and verify all names, endpoints, labels, directions, positions, and IDs are preserved.
2. Create both directed and undirected relationships and verify the Mermaid output preserves both
   forms and renders in a compatible previewer.
3. Enter punctuation, non-Latin text, duplicate names, and Mermaid-reserved characters; verify
   distinguishability, safe escaping, or an actionable entity-specific validation error.
4. Remove a connected component, verify the dependent-relationship warning, cancel once, then
   confirm and verify the component and all dependent relationships disappear together.
5. With no non-deleted saved diagrams, open the saved-document view and verify its understandable
   empty state includes a way to create a diagram. Then save two diagrams with duplicate or distinct
   names, open the view, and verify each entry is distinguishable by its name and last-saved
   information. Load each entry and verify the selected document's components, relationships,
   labels, layout, and IDs appear in the editor.
6. Make an edit, undo it, redo it, switch diagrams, and verify history is scoped to the active session.
   With unsaved edits, attempt a switch and verify save, discard, and cancel each preserve the
   appropriate outcome; a failed or cancelled load must leave the original active document intact.
7. Move a diagram to trash, verify it leaves the active list, restore it, and verify its content and
   IDs are unchanged.
8. Trigger export with unsaved changes and verify the current valid draft is exported or a clear
   reason is shown; invalid/empty diagrams must not download a misleading file.
9. Simulate save failure and recovery; verify the draft remains visible, failed status is announced,
   and retry reaches saved status.
10. Complete create/edit/delete/load/export flows using keyboard navigation and verify labels, focus order,
   contrast, and success/error announcements.

## Validation results

Validated on 2026-09-02 from branch `feature/001-phase-6`; the saved-diagram viewing and guarded
loading scenarios added on 2026-09-04 require validation after implementation:

| Check | Result |
|---|---|
| Build | PASS — shared, backend, and frontend TypeScript/Vite builds completed. |
| Unit, contract, persistence, adapter, export, accessibility, and compatibility tests | PASS — 32 tests. |
| Browser workflows | PASS — 7 tests covering create, export, recovery, save failure/recovery, and five-component/five-relationship performance. |
| Acceptance scenarios 1–4 and 7–9 | PASS — covered by the recorded browser workflows plus domain, export, recovery, compatibility, and accessibility checks. |
| Acceptance scenarios 5, 6, and 10 | PENDING — require saved-diagram list, guarded loading, and accessibility workflow coverage. |

