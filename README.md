# ADR Diagram

ADR Diagram is a browser-based editor for structured software architecture diagrams. Components
and relationships have stable UUIDs, changes autosave through the REST API, and validated diagrams
can be downloaded as Mermaid files.

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
