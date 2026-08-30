# Implementation Plan: Architecture Decision Records

**Branch**: `002-adr-component-tagging` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-adr-component-tagging/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Add first-class ADR artifacts with required decision content, lifecycle status, stable UUID identity,
optional links to components in the active diagram, and safe repair/blocking behavior for destructive
operations. Implement a shared domain model and Zod schemas, Fastify REST persistence through Drizzle,
and React/Zustand views that keep unsaved edits recoverable and expose clear validation/status feedback.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (strict), browser-compatible frontend and Node.js API runtime

**Primary Dependencies**: React + Vite, `@xyflow/react`, Zustand, Zod, Fastify, Drizzle ORM,
PostgreSQL, Vitest, Playwright

**Storage**: PostgreSQL; ADRs and links persisted in `adrs` and `adr_component_links`, with existing
diagram/component records used for ownership and referential validation

**Testing**: Vitest for domain/schema/API/persistence boundaries; Playwright for create, link, save,
reopen, failure-retry, lifecycle, and deletion-blocking workflows

**Target Platform**: Modern desktop browser plus containerized TypeScript API and managed PostgreSQL

**Project Type**: Browser-based single-user web application with REST backend

**Performance Goals**: Preserve responsive editing and status feedback within the existing diagram UI;
normal ADR list/detail and save actions should complete without blocking the editor

**Constraints**: Backend is the persistence authority; no authentication, collaboration, or offline
storage migration in this release. Invalid/missing references and failed saves must never be silently
discarded.

**Scale/Scope**: One active diagram per single user in the first release; zero-to-many ADR/component
links; four statuses; no import/export or bulk editing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

PASS. The design treats ADRs and component links as structured, stable-ID artifacts; preserves
superseded/rejected records; blocks destructive operations that would orphan references; validates at
the shared API/database boundary; and includes keyboard/accessibility, failure-state, and end-to-end
coverage. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/002-adr-component-tagging/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/
├── web/
│   ├── src/features/adrs/
│   ├── src/features/diagrams/
│   ├── src/state/
│   └── tests/e2e/
└── api/
    ├── src/modules/adrs/
    ├── src/modules/diagrams/
    ├── src/db/
    └── tests/
packages/
└── domain/
    ├── src/artifacts/
    ├── src/validation/
    └── tests/
```

**Structure Decision**: Use a small web monorepo boundary: shared domain/validation package, a React
web app for visual/editor state, and a Fastify API for persistence. ADR business rules remain in the
domain/API modules and the React Flow adapter remains presentation-only. This supports future users
without introducing authentication or collaboration now.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | The three boundaries above are sufficient for the requested feature. |
