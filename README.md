# ADR Diagram

ADR Diagram is a browser-based editor for structured software architecture diagrams. Components
and relationships have stable UUIDs, changes can be explicitly saved through the REST API, and
validated diagrams can be downloaded as Mermaid files.

## Developed features

- Create and name architecture diagrams in a browser-based editor.
- Add, move, and remove software architecture components with stable UUIDs.
- Connect components with labeled directed or undirected relationships.
- Browse saved diagrams and load a selected diagram back into the editor.
- Preserve diagram names, component positions, relationship endpoints, labels, and metadata in PostgreSQL.
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
`http://localhost:3000`. Set `DATABASE_URL` in `backend/.env` for a PostgreSQL deployment. The
initial SQL migration is [backend/drizzle/0001_initial.sql](backend/drizzle/0001_initial.sql) and
can be applied with your PostgreSQL migration runner, for example:

```text
psql "$DATABASE_URL" -f backend/drizzle/0001_initial.sql
```

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

## Project boundaries

The shared domain model is authoritative. React Flow is only a visual adapter, and Mermaid export
consumes validated domain data. This keeps component UUIDs stable for future ADR component links.
# ADR Diagram

## Local database setup

The API uses PostgreSQL. Set `DATABASE_URL` in `backend/.env` (see
`backend/.env.example`), then apply the migrations in order:

```text
backend/drizzle/0001_initial.sql
backend/drizzle/0002_adrs.sql
```

The second migration adds Architecture Decision Records and their component links. It is
additive and preserves existing diagram/component UUIDs.
