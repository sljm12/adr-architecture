# ADR Diagram

ADR Diagram is a browser-based editor for structured software architecture diagrams. Components,
relationships, ADR links, and system groups have stable UUIDs, changes can be explicitly saved
through the REST API, and validated diagrams can be downloaded as Mermaid files.

## Developed features

- Create and name architecture diagrams in a browser-based editor.
- Add, move, and remove software architecture components with stable UUIDs.
- Create C4 System Context components as Person or Software System artifacts, while keeping older
  unclassified components readable.
- Connect components with labeled directed or undirected relationships.
- Group two or more Software Systems inside a labeled, movable boundary without rearranging their
  existing positions.
- Review, rename, remove membership from, or confirm ungrouping of a system group while preserving
  component, relationship, and ADR identities.
- Browse saved diagrams and load a selected diagram back into the editor.
- Preserve diagram names, C4 types, component positions, group membership/layout, relationship
  endpoints, labels, and metadata in PostgreSQL.
- Show clear saved, unsaved, saving, and failed-save states.
- Undo and redo diagram edits during the active editing session.
- Check component dependencies before deletion and prevent removal when relationships still exist.
- Move diagrams to recoverable trash and restore them later.
- Export validated diagrams as downloadable Mermaid files.
- Escape supported Mermaid-reserved characters and report actionable export validation errors.
- Provide keyboard-accessible controls, readable labels, and accessible status feedback.

## Setup

Prerequisites: Node.js (current LTS), npm, and PostgreSQL when using the database deployment.

```text
npm install
npm run build
npm run dev
```

The frontend is available at `http://localhost:5173`; the Fastify API runs at
`http://localhost:3000`. Set `DATABASE_URL` in `backend/.env` for a PostgreSQL deployment. Apply
the additive migrations in order with your PostgreSQL migration runner:

```text
psql "$DATABASE_URL" -f backend/drizzle/0001_initial.sql
psql "$DATABASE_URL" -f backend/drizzle/0002_adrs.sql
psql "$DATABASE_URL" -f backend/drizzle/0003_system_groups.sql
```

Migration `0003_system_groups.sql` adds `system_groups` and normalized
`system_group_members` rows. It does not cascade group deletion into components, relationships, or
ADR links.

## Tests

```text
npm test
npm run test:e2e
```

`npm test` runs domain, validation, persistence, API contract, adapter, compatibility, and export
tests. `npm run test:e2e` starts the frontend and API together and runs the browser workflows.

## Mermaid preview

Create a diagram with at least one component and relationship, choose **Export Mermaid**, and open
the downloaded `.mmd` file in a Mermaid-compatible previewer such as Mermaid Live. Export validates
the complete domain document first; invalid content produces an actionable message and no file.
Person and Software System nodes use distinct Mermaid shapes, and each system group is emitted as a
labeled `subgraph`. Mermaid preserves group meaning and membership, but not exact canvas positions.

## C4 system groups

New components use the C4 System Context vocabulary:

- **Person** represents a user, actor, role, or persona interacting with systems.
- **Software System** represents a system shown in the system-context view and is eligible for
  grouping.

Groups contain at least two Software Systems. A component belongs to at most one non-nested group,
and group names are unique after trimming and ignoring capitalization. Creating a group fits a
labeled boundary around the existing member positions; moving or resizing a member automatically
expands, repositions, or shrinks the boundary without changing membership. Moving the boundary
translates all members by the same delta.

Plain clicks select one component for editing. Hold **Shift** while clicking to build a temporary
grouping selection; incompatible Person/Software System selections are rejected with an explanation
and no partial mutation. Ungrouping and membership removal preserve the stable component,
relationship, and ADR references.

Documents created before C4 types or groups remain readable: omitted groups load as `groups: []`,
and a null component type is shown as **Unclassified** until it is classified.

## Project boundaries

The shared domain model is authoritative. React Flow is only a visual adapter, and Mermaid export
consumes validated domain data. This keeps component UUIDs stable for relationships, ADR component
links, and group membership; renaming or repositioning an artifact never rewrites those references.
