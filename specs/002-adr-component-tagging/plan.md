# Implementation Plan: Architecture Decision Records

**Branch**: `002-adr-component-tagging` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-adr-component-tagging/spec.md`

## Summary

Add first-class ADR artifacts to the existing diagram workspace. ADR content and lifecycle state
will live in the framework-independent shared domain, while component tags will reference existing
component UUIDs through an explicit link table. The Fastify API and PostgreSQL/Drizzle persistence
will validate ownership and dependency rules transactionally. The React/Vite frontend will add an
ADR list/detail workflow backed by a Zustand store with explicit undo/redo and a recoverable
unsaved/failed save state.

## Technical Context

**Language/Version**: TypeScript strict mode; React 19.1, Node.js API runtime, Vite 7, TypeScript 5.8

**Primary Dependencies**: React + Vite, `@xyflow/react` 12.8, Zustand 5, Zod 3.25, Fastify 5.4,
Drizzle ORM 0.44, PostgreSQL via `pg` 8.16, Vitest 3.2, and Playwright 1.54, matching the
repository package manifests and AGENTS.md technology stack.

**Storage**: PostgreSQL through Drizzle. Add `adrs`, `adr_component_links`, and an ADR status enum;
reuse `diagrams` and `components` as ownership/reference sources. Use an additive migration after
`backend/drizzle/0001_initial.sql`.

**Testing**: Vitest for shared types/schemas/invariants, in-memory and PostgreSQL repository rules,
Fastify contract behavior, and frontend Zustand/client behavior; Playwright for create/edit/link/
save/reopen/status/deletion-blocking/failure-retry and accessibility workflows.

**Target Platform**: Modern desktop browser, static Vite frontend, containerized Fastify API, and
managed PostgreSQL.

**Project Type**: Existing browser-based single-user web application with a REST backend. No
authentication, permissions, workspaces, real-time collaboration, offline storage migration, or
advanced revision history is introduced by this feature.

**Performance Goals**: Keep ADR editing responsive in the existing workspace; list/detail and save
feedback should be visible within the existing three-second representative workflow target. Link
and deletion dependency checks must complete as part of the API request before reporting success.

**Constraints**: The domain model is authoritative and must remain independent of React Flow. All
ADRs and component links use stable UUIDs. Optional component tagging must support zero, one, or many
links. Superseded ADRs require a same-diagram replacement. Invalid links, failed saves, and destructive
dependency conflicts must be surfaced without discarding user edits or silently cascading data loss.

**Scale/Scope**: One active diagram at a time for one user; four ADR statuses; zero-to-many links;
no ADR import/export, templates, bulk editing, or cross-diagram tagging.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Architecture is a linked, versioned artifact — PASS**: ADRs, links, diagrams, and components
  retain stable UUIDs; component rename/reposition does not change link identity; timestamps and the
  existing session history remain compatible with a future revision table.
- **II. Decisions are first-class and explainable — PASS**: required context, decision,
  consequences, alternatives/constraints, lifecycle status, timestamps, replacement references, and
  linked component display/navigation are explicitly modeled.
- **III. User actions protect architectural data — PASS**: ADR deletion requires confirmation and
  is blocked when it is a replacement target; component deletion is blocked when ADR links exist;
  failed saves retain the local draft and expose retry.
- **IV. Quality is verified at the artifact boundary — PASS**: shared validation, API contracts,
  migration/repository checks, link integrity, lifecycle rules, failure states, accessibility, and
  Playwright workflows are included.
- **V. Simplicity and accessibility guide the product — PASS**: the feature extends the existing
  three-boundary structure, uses the current workspace patterns and DESIGN.md tokens, and includes
  keyboard navigation, readable labels, status feedback, focus treatment, and contrast checks.
- **Delivery and quality gates — PASS**: affected artifacts, stable-reference implications,
  migration expectations, user-visible errors, and validation scenarios are documented below.

## Project Structure

### Documentation (this feature)

```text
specs/002-adr-component-tagging/
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
├── src/domain/types.ts          # ADR and component-link domain types
├── src/domain/invariants.ts     # ADR status/replacement/link invariants
├── src/validation/schemas.ts    # shared Zod artifact and API payload schemas
└── tests/                       # domain, validation, and reference-integrity tests

backend/
├── drizzle/0002_adrs.sql       # additive PostgreSQL schema migration
├── src/persistence/schema.ts    # Drizzle ADR tables, enum, and foreign keys
├── src/persistence/adr-repository.ts
├── src/services/adr-service.ts  # validation, replacement, link, and delete guards
├── src/api/adr-routes.ts        # Fastify ADR/list/link contracts
└── tests/                       # repository, API, migration, and contract tests

frontend/
├── src/api/adr-client.ts        # REST client and structured error handling
├── src/state/adr-store.ts       # drafts, explicit history, save/retry state
├── src/components/AdrList.tsx
├── src/components/AdrEditor.tsx
├── src/components/AdrLinkPicker.tsx
├── src/components/AdrStatusBadge.tsx
└── tests/                       # store, client, editor, link, and accessibility tests

e2e/tests/
└── adr-component-tagging.spec.ts
```

**Structure Decision**: Extend the existing `shared/`, `backend/`, `frontend/`, and `e2e/`
boundaries. React Flow remains a visual adapter for diagram components; ADRs and component links
are serialized from shared domain data and are never derived from node positions or display names.
The backend repository/service is authoritative for cross-entity checks, while the frontend store
keeps an editable draft until a successful API response replaces it.

## Implementation Design

1. **Shared domain and validation**: Add `ArchitectureDecisionRecord`, `ComponentReference`, and
   `AdrStatus` types. Add create/update/link schemas with trimmed required text, UUID checks,
   supported statuses, unique component IDs, and the superseded/replacement rule. Keep persisted
   timestamps server-managed and return field-addressable Zod errors through the existing error shape.
2. **Persistence and service rules**: Add the ADR tables and indexes without cascade deletion. The
   repository loads ADRs with component IDs and summaries; the service verifies diagram ownership,
   same-diagram replacement, missing/cross-diagram components, duplicate links, and dependency
   conflicts inside transaction boundaries. Component deletion must query ADR links before deleting.
3. **REST contract**: Add list/create/get/update/delete ADR routes scoped by diagram where ownership
   matters, plus a replace-links route. Return 422 for actionable validation, 404 for missing
   entities, and 409 dependency details including blocking ADR IDs/titles or replacement references.
4. **Frontend workflow**: Add a Decisions surface to the current workspace. The editor supports
   required fields, optional alternatives/constraints, status, replacement selection when needed,
   component search/selection, unlinking, linked-component navigation, confirmation dialogs, and
   visible unlinked/unsaved/error/saved states. Use the existing Apple-style DESIGN.md tokens and
   existing 44px focusable controls.
5. **History and failure handling**: ADR edits, link changes, and status changes are draft updates
   recorded by explicit Zustand history. A failed save leaves the draft and marks it unsaved/failed;
   retry resubmits the unchanged draft. A stale save response must not overwrite newer local edits.

## Post-design Constitution Re-check

**PASS**: The design preserves stable artifact identities and references, stores ADRs and links as
structured PostgreSQL records, rejects invalid/cross-diagram references, prevents destructive
cascades, keeps superseded/rejected decisions discoverable, and verifies user-visible behavior at
shared, persistence, API, frontend, and end-to-end boundaries. It adds no authentication,
collaboration, offline migration, or revision-system complexity outside the specification.

## Complexity Tracking

No constitution violations require justification. The new ADR repository/service and explicit link
table are required to enforce stable references and deletion guards; no broader architectural
subsystem is introduced.
