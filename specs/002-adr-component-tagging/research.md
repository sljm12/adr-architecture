# Research: ADR Component and Relationship Tagging

## Decision: Extend the existing three-boundary TypeScript application

**Rationale:** The repository already separates framework-independent shared artifacts, a Fastify
REST/PostgreSQL backend, and a React/Vite frontend. ADRs fit those boundaries without introducing
authentication, collaboration, a new app, or a second persistence model. The package manifests and
AGENTS.md establish React/Vite, `@xyflow/react`, Zustand, Zod, Fastify, Drizzle/PostgreSQL, Vitest,
and Playwright as the compatible stack.

**Alternatives considered:** A new monorepo package layout or a frontend-only ADR store was rejected.
The former conflicts with the current repository structure; the latter would violate the backend
persistence requirement and make future multi-user evolution require a storage migration.

## Decision: Keep ADRs independent of React Flow

**Rationale:** ADRs, component links, and relationship links will use stable UUIDs from the shared
domain. Component/relationship names, React Flow IDs, endpoints, and screen positions remain
presentation or editable artifact data. Ordinary edits therefore cannot break a link.

**Alternatives considered:** Storing component or relationship names, labels, endpoints, node IDs,
or positions in ADR records was rejected because each can change during ordinary editor operations.

## Decision: Use separate relational ADR link tables

**Rationale:** PostgreSQL through Drizzle matches the existing persistence layer. An `adrs` table plus
`adr_component_links` and `adr_relationship_links` composite-key tables supports zero, one, or many
links of either artifact type, mixed link sets, efficient summaries, and explicit dependency queries.
Separate tables preserve direct foreign-key integrity to each parent artifact without a polymorphic
reference. Service checks enforce same-diagram ownership and return actionable conflicts.

**Alternatives considered:** Embedding IDs as JSON arrays or using one polymorphic link table was
rejected because those approaches weaken referential integrity, cross-diagram validation, and
component/relationship-deletion diagnostics. Cascading deletes were rejected because they silently
discard architectural knowledge.

## Decision: Validate at shared, API, and persistence boundaries

**Rationale:** Shared Zod schemas provide consistent field errors for the frontend and backend. The
Fastify service remains authoritative for diagram ownership, replacement references, and dependency
checks. Repository transactions keep ADR/link mutations atomic, while PostgreSQL foreign keys provide
the final integrity backstop.

**Alternatives considered:** UI-only validation and database-only error handling were rejected. UI-
only validation cannot protect other clients; database-only errors do not provide useful field-level
feedback or predictable conflict details.

## Decision: Guard superseding and destructive operations explicitly

**Rationale:** Any status may transition to another supported status, but `superseded` requires a
different replacement ADR in the same diagram. An ADR referenced as a replacement cannot be deleted.
A component or relationship with ADR links cannot be deleted. Component deletion also checks
relationships that would be removed as dependents. All checks return the affected IDs/titles so
users can repair or explicitly remove references before retrying.

**Alternatives considered:** Allowing dangling replacement/link records or automatic nulling/cascade
cleanup was rejected because it violates the constitution and hides history changes.

## Decision: Retain local drafts across failed saves

**Rationale:** The existing Zustand store already models explicit save states and protects a newer
local edit from a stale response. ADR state will follow the same pattern: draft edits are history-
tracked, a failed request keeps the draft and exposes retry, and only a successful response commits
server-managed timestamps/status.

**Alternatives considered:** Rolling back or clearing the editor after a network failure was rejected
because it loses user work and falsely suggests a completed save.

## Decision: Use REST routes documented in OpenAPI

**Rationale:** The current API is Fastify REST with OpenAPI documents under the feature specs. Separate
ADR list/detail/link routes keep the contract reviewable and allow the existing diagram endpoints to
remain stable. GraphQL and real-time transport add no value for the single-user first release.

**Alternatives considered:** GraphQL, websocket synchronization, and embedding ADRs in the complete
diagram PUT payload were rejected as unnecessary coupling and scope expansion.

## Decision: Reuse the current workspace UI and DESIGN.md system

**Rationale:** The ADR list, editor, status feedback, confirmation dialogs, and link picker can be
integrated into the current workspace shell. Existing 44px controls, focus outlines, typography,
Action Blue interaction color, and accessible status messaging provide the visual and interaction
baseline.

**Alternatives considered:** A separate ADR application or a new visual language was rejected because
it fragments navigation and increases first-release complexity.

## Decision: Provide component- and relationship-scoped ADR summary read models

**Rationale:** The requirements make the relationship navigable in both directions for both artifact
types. Component and relationship views need focused lists of linked ADR IDs, titles, statuses, and
update times, while the existing ADR detail response already supports opening the selected record.
Separate scoped read endpoints can derive each summary from its link table and `adrs`, preserving one
source of truth for links and returning an empty list for a valid artifact with no linked ADRs.

**Alternatives considered:** Loading every ADR for the diagram and filtering in the browser was
rejected because it over-fetches data and makes artifact ownership/error handling less explicit.
Duplicating ADR summaries inside component or relationship records was rejected because it would
create stale, second-copy metadata and complicate link updates.
