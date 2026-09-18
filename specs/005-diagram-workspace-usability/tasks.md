# Tasks: Diagram Workspace Usability

## Phase 1: Setup

- [X] T001 Create feature branch and Spec Kit artifacts under `specs/005-diagram-workspace-usability/`.
- [X] T002 Point `.specify/feature.json` at the active workspace-usability feature.

## Phase 2: Foundational contracts and state

- [X] T003 [P] Add `ComponentAdrCount`, response schemas, and exports in `shared/src/domain/types.ts`, `shared/src/validation/schemas.ts`, and `shared/src/index.ts`.
- [X] T004 [P] Extend `AdrRepositoryLike`, in-memory repository, and PostgreSQL repository with grouped component-count queries in `backend/src/persistence/adr-repository.ts`.
- [X] T005 Add service and route handling for `GET /diagrams/:diagramId/component-adr-counts`, including active-diagram validation and 404 behavior in `backend/src/services/adr-service.ts` and `backend/src/api/adr-routes.ts`.
- [X] T006 Add frontend API client and independent diagram-scoped ADR count cache with stale-request protection, retry, and invalidation in `frontend/src/api/adr-client.ts` and `frontend/src/state/adr-store.ts`.

## Phase 3: Focused workspace shell (US1)

- [X] T007 [US1] Refactor panel visibility and focus behavior in `frontend/src/components/DiagramWorkspace.tsx` and `frontend/src/components/WorkspaceInspector.tsx`; keep active form state when Details closes and start saved diagrams with Details collapsed.
- [X] T008 [US1] Consolidate the sub-navigation/command-bar layout and action hierarchy in `frontend/src/components/DiagramToolbar.tsx` and `frontend/src/components/ExportButton.tsx`.
- [X] T009 [US1] Implement viewport-fit layout, independent panel scrolling, drawers, responsive breakpoints, focus states, and icon styling in `frontend/src/styles.css`.
- [X] T010 [US1] Add UI tests for panel toggles, form preservation, responsive labels, and export feedback in `frontend/tests/accessibility.test.tsx`, `frontend/tests/save-controls.test.tsx`, and a new `frontend/tests/workspace-shell.test.tsx`.

## Phase 4: Library management (US2)

- [X] T011 [US2] Flatten and reorganize saved diagram controls, filter disclosure, current-row state, and recovery entry point in `frontend/src/components/SavedDiagramList.tsx` and `frontend/src/components/DiagramWorkspace.tsx`.
- [X] T012 [US2] Update library styling for compact rows, full-width advanced fields, footer recovery, drawers, and responsive states in `frontend/src/components/saved-diagram-list.css` and `frontend/src/components/recovery.css`.
- [X] T013 [US2] Extend accessibility and browser tests for panel layout, filter disclosure/retention, deletion safeguards, and recovery access in `frontend/tests/accessibility.test.tsx` and `e2e/tests/diagram-list-management.spec.ts`.

## Phase 5: Canvas readability (US3)

- [X] T014 [US3] Update component selection/handle visibility and ADR badge-ready node metadata in `frontend/src/components/ComponentNode.tsx` and `frontend/src/components/DiagramCanvas.tsx`.
- [X] T015 [US3] Improve deterministic curve styling, selected edge state, label backing, and hit areas in `frontend/src/components/RelationshipEdge.tsx`, `frontend/src/adapters/react-flow/diagram-adapter.ts`, and `frontend/src/styles.css`.
- [X] T016 [US3] Reserve and style a readable group header without changing group layout data in `frontend/src/components/SystemGroupNode.tsx` and `frontend/src/styles.css`.
- [X] T017 [US3] Add/adjust adapter, routing, group-header, and selection accessibility tests in `frontend/tests/react-flow-adapter.test.ts`, `frontend/tests/system-group-ui.test.tsx`, and `frontend/tests/accessibility.test.tsx`.

## Phase 6: ADR count badges (US4)

- [X] T018 [US4] Add backend repository/service/route unit and contract tests for grouped counts, all statuses, diagram isolation, empty results, and missing/trashed diagrams in `backend/tests/persistence/adr-repository.test.ts`, `backend/tests/adr-service.test.ts`, and `backend/tests/contract/adr-routes.test.ts`.
- [X] T019 [US4] Render positive count badges with accessible keyboard activation and a stable callback in `frontend/src/components/ComponentNode.tsx` and `frontend/src/components/DiagramCanvas.tsx`.
- [X] T020 [US4] Wire badge activation to selection, Details opening, Linked ADR focus, independent count retry/error UI, and selected-summary refresh in `frontend/src/components/DiagramWorkspace.tsx`, `frontend/src/components/WorkspaceInspector.tsx`, `frontend/src/components/ComponentAdrSummary.tsx`, and `frontend/src/state/adr-store.ts`.
- [X] T021 [US4] Add count cache, partial-save invalidation, deletion/restoration refresh, and one-request-per-diagram tests in `frontend/tests/adr-store.test.ts`, `frontend/tests/component-adr-summary.test.tsx`, and `e2e/tests/adr-component-tagging.spec.ts`.

## Phase 7: Polish and verification

- [X] T022 [P] Update `DESIGN.md` with workspace shell, panel, canvas selection, and ADR badge guidance consistent with existing tokens.
- [X] T023 Run focused Vitest suites for shared validation, repositories, stores, adapters, accessibility, grouping, save/export, and ADR workflows; fix regressions.
- [X] T024 Run Playwright workflows at desktop/tablet/mobile viewport sizes and capture the supplied-diagram fixture; fix overflow, focus, clipping, and group-header issues.
- [X] T025 Run the full build and test commands, review the diff for unrelated changes, and mark all completed tasks in this file.

## Dependencies

T003-T006 precede T019-T021. T007-T009 precede T010 and T011-T017. T011-T013 and T014-T017 are independent after the shell work. T022-T025 follow feature implementation.

## MVP

The MVP is T003-T017: focused shell, usable library, and readable canvas. ADR badges (T018-T021) complete the full feature and must land before release because they expose the product's ADR linkage capability.
