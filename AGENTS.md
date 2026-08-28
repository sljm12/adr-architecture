# Agent Instructions

## Project Context

This repository contains the ADR Diagram project: a tool for creating software architecture
diagrams and recording Architecture Decision Records (ADRs) linked to diagram components.

## Technology Stack

The first release is a browser-based, single-user application. Offline use and real-time
collaboration are not required, but persistence MUST use a backend so the product can evolve
to support multiple users without a storage migration.

- Frontend: React with TypeScript, built with Vite.
- Diagram editor: React Flow (`@xyflow/react`) for interactive nodes, edges, positioning, and
  custom diagram elements.
- Frontend state: Zustand, with an explicit undo/redo history for diagram and ADR edits.
- Validation: Zod for shared runtime validation of API payloads and artifact data.
- Backend: TypeScript with Fastify.
- API: REST initially, with an OpenAPI contract/documentation boundary.
- Database: PostgreSQL, accessed through Drizzle ORM.
- Testing: Vitest for domain, validation, persistence, and Mermaid export logic; Playwright for
  end-to-end user workflows.
- Deployment: Static hosting for the frontend, a containerized API, and managed PostgreSQL.

The stack SHOULD remain deliberately small for the first release. Authentication, permissions,
workspaces, real-time collaboration, and advanced revision history are future capabilities and
MUST NOT be introduced unless a feature explicitly requires them.

## Architecture Boundaries

The domain model MUST be independent of React Flow. React Flow state is a visual adapter, not the
source of truth. Keep these concerns separate:

- Domain artifacts: diagrams, components, relationships, ADRs, and component links.
- Visual adapter: conversion between domain artifacts and React Flow nodes and edges.
- Export adapter: conversion from the validated domain model to Mermaid syntax.
- Persistence/API: serialization, validation, and storage of domain artifacts.

All diagrams, components, relationships, ADRs, and component links MUST use stable UUIDs.
Relationships MUST reference component IDs, and ADR links MUST reference component IDs rather
than names or screen positions. Renaming or repositioning a component MUST NOT invalidate its
references.

The initial database model SHOULD be organized around `diagrams`, `components`, `relationships`,
`adrs`, and `adr_component_links`, with creation and update timestamps. A future
`diagram_revisions` table may provide richer history without changing artifact identities.

Mermaid export MUST consume validated domain data rather than raw editor state. Unsupported or
invalid Mermaid content MUST produce an actionable validation error and MUST NOT silently omit
artifacts.

## General Workflow

- Inspect existing files and project conventions before making changes.
- Preserve unrelated user changes in the working tree.
- Prefer small, focused changes that satisfy the requested behavior.
- Validate changes with the most relevant available checks before reporting completion.
- Keep user-facing requirements technology-agnostic unless implementation details are explicitly
  requested.

## Documentation Lookup

Use the Context7 CLI to fetch current documentation whenever a task asks about a library,
framework, SDK, API, CLI tool, or cloud service.

1. Resolve the library first:
   `npx ctx7@latest library <name> "<full question>"`
2. Fetch documentation using the selected library ID:
   `npx ctx7@latest docs <libraryId> "<full question>"`

Do not use Context7 for refactoring, standalone scripts, business-logic debugging, code review,
or general programming concepts. Do not include secrets in documentation queries. If Context7
reports quota exhaustion, tell the user and suggest authentication or an API key rather than
silently relying on stale documentation.

## Spec Kit

- Feature specifications live under `specs/`.
- Use the repository's Spec Kit skills for specification, planning, task generation, analysis,
  and implementation workflows.
- Read the applicable skill instructions before using a Spec Kit workflow.
- Keep `.specify/feature.json` pointing at the active feature directory.
- Preserve stable identifiers and reference integrity for diagrams, components, relationships, and
  ADRs.
- Specifications must include testable requirements, user scenarios, measurable success criteria,
  edge cases, assumptions, and validation checklists.

## Editing and Safety

- Use `apply_patch` for local file edits.
- Do not use destructive commands such as `git reset --hard` or `git checkout --` unless the user
  explicitly requests them.
- Before destructive operations, resolve and verify exact targets and prefer recoverable actions.
- Do not overwrite unrelated work.
- When referencing changed local files in a response, provide clickable absolute file links when
  possible.

## Quality Expectations

- Architecture artifacts must remain structured, versionable, and cross-referential.
- Destructive actions require clear confirmation and should preserve recoverability where feasible.
- User-visible workflows should provide clear success and failure feedback.
- Core workflows should support keyboard navigation, readable labels, and accessible contrast.
- Changes affecting artifact schemas, persistence, linking, rendering, import, or export should
  include appropriate validation or automated test coverage.
