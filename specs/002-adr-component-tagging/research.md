# Research: ADR Component Tagging

## Decision: Shared domain artifact with stable UUID references

**Rationale:** ADRs and component links must survive renames and visual repositioning. The domain
model will contain UUIDs and component IDs; display names and React Flow positions remain adapters.

**Alternatives considered:** Storing React Flow node IDs or component names in ADR records was rejected
because either can change during UI edits and would break references.

## Decision: PostgreSQL relational persistence with explicit link table

**Rationale:** `adrs` and `adr_component_links` provide clear ownership, uniqueness, and foreign-key
checks. A link table naturally supports zero, one, or many components and makes blocking/deletion
queries explicit.

**Alternatives considered:** Embedding component IDs as a JSON array was rejected because cross-diagram
validation, referential integrity, and deletion blocking would be weaker.

## Decision: Shared Zod schemas at API and artifact boundaries

**Rationale:** The frontend can validate forms before requests, while the API remains authoritative.
The same schemas also validate persisted/serialized artifact data and produce actionable field errors.

**Alternatives considered:** UI-only validation was rejected because it cannot protect persistence or
future clients.

## Decision: Transactional deletion and replacement-reference guards

**Rationale:** Component deletion must report affected ADRs and stop until links are explicitly removed;
ADR deletion must similarly stop when it is a replacement target. These checks belong in the API service
and database transaction, not only in confirmation dialogs.

**Alternatives considered:** Cascading deletes were rejected because they silently discard architectural
knowledge and violate the constitution.

## Decision: Optimistic local draft with explicit save state

**Rationale:** The editor retains the user's draft when the API is unavailable, marks it unsaved, and
offers retry. A successful response replaces server-managed timestamps/status metadata while preserving
the stable ADR UUID.

**Alternatives considered:** Clearing or rolling back the form on failure was rejected because it loses
user work.

## Decision: REST contract scoped to ADRs, links, and blocking diagnostics

**Rationale:** The initial UI needs list/detail CRUD, status updates, link/unlink, and actionable
deletion diagnostics. The contract is documented separately in OpenAPI YAML to keep API boundaries
reviewable and implementation-independent.

**Alternatives considered:** GraphQL and real-time APIs were rejected as unnecessary first-release
complexity.
