# Implementation Plan: Diagram Workspace Usability

**Branch**: `005-diagram-workspace-usability` | **Spec**: `specs/005-diagram-workspace-usability/spec.md`

## Summary

Compress the editor chrome, make the library and Details panel independently collapsible, improve canvas selection/routing/group headers, and add a diagram-wide ADR component-count endpoint with non-blocking badges.

## Technical Context

**Language/Version**: TypeScript, React 19, Node.js
**Primary Dependencies**: Vite, `@xyflow/react`, Zustand, Fastify, Drizzle, Zod, Vitest, Playwright
**Storage**: Existing PostgreSQL and in-memory ADR repositories
**Testing**: Vitest and Playwright
**Target Platform**: Browser desktop and mobile widths
**Project Type**: React frontend with Fastify REST API
**Constraints**: Preserve stable UUIDs, explicit save/undo, existing API compatibility, and accessible 44px targets
**Scale/Scope**: Existing single-user diagram editor; no auth, collaboration, or migration

## Constitution Check

- Stable identities and ADR links are preserved: PASS.
- No domain coupling to React Flow: PASS; count data is an independent adapter/API concern.
- Destructive actions remain confirmed and recoverable: PASS.
- Rendering/API changes receive automated coverage: PASS.
- Simplicity and accessibility are explicit acceptance criteria: PASS.

## Project Structure

Frontend UI and adapters live under `frontend/src/components`, `frontend/src/adapters`, and `frontend/src/state`; API/service/repository changes live under `backend/src`; shared response types and schemas live under `shared/src`; tests remain in `frontend/tests`, `backend/tests`, and `e2e/tests`.

## Implementation Decisions

- Keep the existing curved relationship algorithm and improve its lanes/visual treatment; do not add obstacle avoidance.
- Use a sparse `ComponentAdrCount` response and one grouped repository query instead of extending ADR list summaries or issuing one request per node.
- Keep count cache/loading/error state separate from the ADR draft store; stale responses are ignored by request generation.
- Open saved diagrams with the library visible and Details collapsed; selecting an item or invoking an edit action opens Details.
