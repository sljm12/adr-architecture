# Implementation Plan: Software Architecture Diagrams

**Branch**: `001-software-architecture-diagrams` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-software-architecture-diagrams/spec.md`

## Summary

Deliver a browser-based, single-user architecture diagram editor that persists structured
diagrams through a Fastify REST API backed by PostgreSQL. The frontend uses React Flow only as a
visual adapter over a domain model managed with Zustand and explicit undo/redo history. Validated
domain artifacts are exported through a Mermaid adapter that rejects unsupported content with
actionable errors. Users can also browse active saved diagrams, select one to load, and safely
switch without losing unsaved edits.

## Technical Context

**Language/Version**: TypeScript, with the repository's current Node.js LTS runtime

**Primary Dependencies**: React + Vite, `@xyflow/react`, Zustand, Zod, Fastify, Drizzle ORM,
PostgreSQL, OpenAPI, Vitest, Playwright

**Storage**: PostgreSQL through Drizzle; diagrams, components, relationships, and layout metadata
are persisted as structured records with UUIDs and timestamps

**Testing**: Vitest for domain, Zod validation, persistence, loading and Mermaid export; Playwright
for create/edit/save/list/load/delete/undo/redo/export user journeys; API contract checks against
OpenAPI

**Target Platform**: Modern desktop browser for the React frontend; containerized Node.js API;
managed PostgreSQL

**Project Type**: Web application with a static frontend and backend REST service

**Performance Goals**: Interactive editing at approximately 60 fps for ordinary diagrams;
save/reopen/export feedback visible within 3 seconds for representative diagrams; support at
least the five-component/five-relationship success-criteria scenario without special handling

**Constraints**: Single active diagram and single user in the first release; backend persistence
is required; the active-diagram switch must offer save, discard, or cancel when unsaved edits are
present; no authentication, permissions, collaboration, offline storage, Mermaid import, saved-
diagram search/sorting/sharing, or advanced revision history unless separately specified; invalid
or unsupported content must never be silently discarded

**Scale/Scope**: Initial release covers diagram CRUD, an active saved-diagram list, guarded diagram
loading, component and relationship editing, layout persistence, session undo/redo, Mermaid export,
validation/error feedback, and accessible core workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Linked, versioned artifact — PASS**: diagrams, components, relationships, and future ADR
  references use stable UUIDs; persisted `createdAt`/`updatedAt` timestamps and session history
  provide initial change traceability, while richer revisions remain a future compatible table.
- **II. Decisions first-class — PASS / N/A for this feature**: ADR creation is explicitly a
  related feature; this feature preserves component identities and does not model ADR lifecycle
  incompletely.
- **III. Data protection — PASS**: component deletion requires confirmation, dependent
  relationships are handled explicitly, and save/export validation failures are surfaced.
- **IV. Artifact-boundary quality — PASS**: the plan includes domain, schema, persistence,
  contract, export, rendering, reference-integrity, and end-to-end coverage.
- **V. Simplicity and accessibility — PASS**: the design keeps React Flow behind an adapter,
  avoids first-release collaboration/auth complexity, and includes keyboard navigation, labels,
  status feedback, and contrast checks.
- **Delivery gates — PASS**: affected artifacts, reference implications, API contracts, migration
  expectations, and validation scenarios are defined in the Phase 0/1 artifacts below.

### Post-design re-check: saved-diagram workflow

**PASS**: The saved-diagram summary uses the diagram's stable UUID rather than a name; loading
retrieves the complete saved document through the existing contract; save, discard, and cancel
protect in-progress work; failed or cancelled loads preserve the active artifact; and planned
contract, state, and end-to-end coverage will verify these behaviors. The design adds no new
permissions, collaboration, or persistence format.

## Project Structure

### Documentation (this feature)

```text
specs/001-software-architecture-diagrams/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                 # created later by $speckit-tasks
```

### Source Code (repository root)

```text
shared/
├── src/domain/              # framework-independent entities and invariants
├── src/validation/          # Zod schemas for artifacts and API payloads
└── tests/                    # domain and validation tests

backend/
├── src/api/                  # Fastify routes and OpenAPI boundary
├── src/persistence/          # Drizzle schema, repositories, migrations
├── src/services/             # diagram and export orchestration
└── tests/                    # API, persistence, and contract tests

frontend/
├── src/components/           # accessible editor and diagram-management UI
├── src/state/                # Zustand document state and undo/redo history
├── src/adapters/react-flow/  # domain ↔ React Flow conversion only
├── src/adapters/mermaid/     # validated domain → Mermaid export only
├── src/api/                  # REST client and result/error handling
└── tests/                    # adapter and UI-focused tests

e2e/
└── tests/                    # Playwright user workflows
```

**Structure Decision**: Use a small three-boundary web application: shared domain/validation,
Fastify/PostgreSQL backend, and React/Vite frontend, with Playwright tests at the repository
boundary. The domain is authoritative; React Flow nodes/edges are derived visual state and raw
editor state is never sent directly to persistence or Mermaid export. The frontend obtains saved
diagram summaries from the list endpoint, loads only the selected document by its stable ID, and
resets local history only after a successful replacement of the active document.

## Complexity Tracking

No constitution violations require justification. The shared package and adapter boundaries are
the minimum structure needed to keep stable artifact identities independent of React Flow and to
share runtime validation between the REST API and browser.
