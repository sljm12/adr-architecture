---
description: "Tasks for interactive HTML package export"
---

# Tasks: Export Interactive HTML Package

**Input**: Design documents from `specs/007-export-interactive-html/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts](contracts/), and [quickstart.md](quickstart.md)

**Tests**: Included because the project constitution requires automated coverage for schema, persistence, linking, rendering, and export boundaries. Write the story checks first, confirm they fail for the missing behavior, then implement and rerun them.

**Organization**: Tasks are grouped by user story. `[P]` marks work in distinct files that can proceed concurrently after the stated prerequisites. Paths are relative to the repository root.

## Phase 1: Setup

**Purpose**: Add only the archive dependency needed by the planned browser ZIP adapter.

- [X] T001 Add JSZip as a production dependency in `package.json` and `package-lock.json`; retain the existing build and test scripts.

---

## Phase 2: Foundational prerequisites

**Purpose**: Make diagram geometry durable and provide one complete ADR read so every story can use a validated current-state snapshot.

- [X] T002 [P] Add failing tests for legacy component-size defaults, invalid sizes, stable IDs, and group enclosure in `shared/tests/compatibility.test.ts` and `shared/tests/c4-system-groups.test.ts`.
- [X] T003 [P] Add failing migration and save/reopen tests for component width and height in `backend/tests/persistence/diagram-repository.test.ts` and `backend/tests/compatibility.test.ts`.
- [X] T004 [P] Add failing contract and repository tests for the full-ADR list, all lifecycle states and links, empty results, and missing/inactive diagrams in `backend/tests/contract/adrs.test.ts` and `backend/tests/persistence/adr-repository.test.ts`.
- [X] T005 Implement normalized positive finite component `size` with 180 x 72 legacy defaults in `shared/src/domain/types.ts`, `shared/src/validation/schemas.ts`, `shared/src/domain/invariants.ts`, and `shared/src/domain/group-layout.ts`; preserve component UUIDs and existing document compatibility.
- [X] T006 [P] Add the additive component width/height migration and Drizzle mapping in `backend/drizzle/0004_component_dimensions.sql` and `backend/src/persistence/schema.ts`, using defaults for existing rows.
- [X] T007 Update component read/write mapping and validation to round-trip normalized sizes in `backend/src/persistence/diagram-repository.ts` and `backend/src/services/diagram-service.ts`, matching `contracts/component-layout.md`.
- [X] T008 Update component creation, resize, undo/redo, save, and group fitting to use domain sizes in `frontend/src/state/diagram-store.ts`, `frontend/src/components/DiagramCanvas.tsx`, and `frontend/src/adapters/react-flow/diagram-adapter.ts`; cover visible resize persistence in `frontend/tests/diagram-editing.test.tsx`.
- [X] T009 Add a bounded-query `listFull(diagramId)` that returns complete ADRs and link IDs in `backend/src/persistence/adr-repository.ts`, and expose it through `backend/src/services/adr-service.ts` without changing the summary-list method.
- [X] T010 Implement `GET /diagrams/:diagramId/adrs/full` with UUID validation and 404 handling in `backend/src/api/adr-routes.ts`; keep `specs/007-export-interactive-html/contracts/openapi.yaml` and `backend/tests/contract/openapi.test.ts` aligned.
- [X] T011 [P] Add the validated full-ADR response client method in `frontend/src/api/adr-client.ts`, using the shared ADR schema and surfacing request failures.

**Checkpoint**: Existing diagrams normalize dimensions, resizing survives save/reopen, and one read returns all full ADRs. T002-T004 pass; no export files are generated yet.

---

## Phase 3: User Story 1 — Export and explore an architecture package (P1) 🎯 MVP

**Goal**: Download the current diagram and ADRs as a ZIP whose offline HTML diagram lets readers select components and relationships and open exactly their directly linked ADRs.

**Independent Test**: Export a diagram with one component-only ADR, one relationship-only ADR, multiple links, and an unlinked artifact; extract the ZIP and open `index.html` from disk to verify each selection and full ADR navigation.

### Tests for User Story 1

- [X] T012 [P] [US1] Add failing snapshot tests for saved/unsaved/failed-save ADR overlays, a new package-local ADR ID, invalid drafts, ownership, duplicate IDs, missing endpoints, link targets, replacement targets, and atomic errors in `shared/tests/html-export-validation.test.ts`.
- [X] T013 [P] [US1] Add failing SVG tests for group bounds, resized components, type cues, labels, directed and parallel relationship paths, duplicate names, and XML escaping in `shared/tests/svg-export.test.ts`.
- [X] T014 [P] [US1] Add failing frontend tests for current-state capture, saving-state block, ZIP success/error feedback, and absence of save side effects in `frontend/tests/html-export-button.test.tsx`.
- [X] T015 [P] [US1] Add a failing download and extracted `file://` navigation scenario for component and relationship selections in `e2e/tests/html-package-export.spec.ts`.

### Implementation for User Story 1

- [X] T016 [US1] Implement pure draft overlay and complete export-snapshot validation with artifact-kind, UUID, field, and remedy errors in `shared/src/export/html-snapshot.ts`; never infer relationship ADRs from endpoint links.
- [X] T017 [US1] Implement domain-based component bounds, group bounds, stable relationship routing, arrowhead coordinates, and view-box calculation in `shared/src/export/svg-layout.ts`; do not import React Flow state.
- [X] T018 [US1] Render escaped primitive vector shapes, text, groups, labels, paths, and UUID-based link targets from validated geometry in `shared/src/export/svg-export.ts`.
- [X] T019 [P] [US1] Render `index.html` with inline SVG, keyboard-accessible text links, per-artifact detail sections, exact direct ADR title/status lists, and explicit empty states in `shared/src/export/diagram-page.ts`.
- [X] T020 [P] [US1] Render a minimal `adrs.html` with full escaped ADR detail sections addressable by UUID in `shared/src/export/adr-page.ts`, so US1 links can open full decisions before the all-ADR catalog is added.
- [X] T021 [US1] Build the initial fixed-path file map (`index.html`, `adrs.html`, `diagram.svg`, `styles.css`) from one validated snapshot in `shared/src/export/html-package.ts`, add baseline `:target` and focus styling in `shared/src/export/styles.ts`, and export the entry point from `shared/src/index.ts`; fail before producing any partial package.
- [X] T022 [US1] Fetch full ADRs once, merge the frozen editor draft, add the completed file map to JSZip, and download the Blob with a safe filename in `frontend/src/api/export-client.ts`.
- [X] T023 [US1] Add a separate HTML package action and clear progress, success, and artifact-specific error states in `frontend/src/components/ExportButton.tsx` and `frontend/src/styles.css`; permit valid unsaved states while retaining Mermaid's saved-state rule and following `DESIGN.md`.
- [X] T024 [US1] Run and make green the US1 checks in `shared/tests/html-export-validation.test.ts`, `shared/tests/svg-export.test.ts`, `frontend/tests/html-export-button.test.tsx`, and `e2e/tests/html-package-export.spec.ts`.

**Checkpoint**: US1 is a usable offline interactive export. Component and relationship selections show only direct ADRs, and every shown ADR opens in full.

---

## Phase 4: User Story 2 — Browse every ADR in the export (P1)

**Goal**: Give readers a dedicated all-ADR page covering linked and unlinked decisions in every lifecycle state, with references back to the exact diagram artifacts.

**Independent Test**: Render or export a snapshot with draft, accepted, superseded, rejected, and unlinked ADRs; verify the catalog shows each exactly once, full fields and dates are readable, and linked references locate diagram artifacts.

### Tests for User Story 2

- [ ] T025 [P] [US2] Add failing catalog tests for every status, zero ADRs, unlinked records, full content, timestamps, replacement ADRs, duplicate titles, and component/relationship back-links in `shared/tests/adr-page-export.test.ts`.
- [ ] T026 [P] [US2] Add a failing offline browser scenario that opens the catalog, reaches an unlinked ADR, and follows both component and relationship references back in `e2e/tests/html-package-adrs.spec.ts`.

### Implementation for User Story 2

- [ ] T027 [US2] Extend `shared/src/export/adr-page.ts` with the complete all-ADR list, status labels, full context/decision/consequence/alternative fields, dates, replacement references, and UUID-disambiguated diagram links.
- [ ] T028 [US2] Connect `index.html` to the dedicated catalog and preserve relative cross-page anchors in `shared/src/export/diagram-page.ts` and `shared/src/export/html-package.ts`, including the no-ADR state.
- [ ] T029 [US2] Run and make green the US2 checks in `shared/tests/adr-page-export.test.ts` and `e2e/tests/html-package-adrs.spec.ts` without regressing the US1 tests.

**Checkpoint**: The catalog works from the extracted ZIP even when no ADR has a diagram link.

---

## Phase 5: User Story 3 — Reuse and restyle exported artifacts (P2)

**Goal**: Supply an editable standalone SVG, readable per-ADR Markdown files, and documented CSS component colors while keeping the HTML interactions intact.

**Independent Test**: Open the extracted SVG and Markdown in standard tools, edit the documented outline and fill variables, reload the HTML page, and verify all ADR links still resolve.

### Tests for User Story 3

- [ ] T030 [P] [US3] Add failing manifest, standalone SVG, Markdown escaping/content, UUID filename, and CSS color-token tests in `shared/tests/html-package-portability.test.ts`.
- [ ] T031 [P] [US3] Add a failing extracted-package scenario for `diagram.svg`, Markdown files, CSS recoloring, relocation, and intact keyboard navigation in `e2e/tests/html-package-portability.spec.ts`.

### Implementation for User Story 3

- [ ] T032 [P] [US3] Generate one safe Markdown file per ADR with decision fields, status, dates, replacement and artifact UUID references, and explicit unlinked state in `shared/src/export/adr-markdown.ts`.
- [ ] T033 [P] [US3] Complete standalone `diagram.svg` generation with editable vector primitives, explicit view box, full labels/grouping, and embedded default styling in `shared/src/export/svg-export.ts`.
- [ ] T034 [P] [US3] Define documented `--component-outline` and `--component-fill` variables, readable default colors, focus styles, and `:target` detail visibility in `shared/src/export/styles.ts`, consistent with `DESIGN.md`.
- [ ] T035 [US3] Emit the final `contracts/package-format.md` manifest from `shared/src/export/html-package.ts`, including `diagram.svg`, `styles.css`, and `adrs/<uuid>.md` for every ADR; keep paths relative and authored names out of paths.
- [ ] T036 [US3] Run and make green the US3 checks in `shared/tests/html-package-portability.test.ts` and `e2e/tests/html-package-portability.spec.ts` without regressing US1 or US2.

**Checkpoint**: All requested files are reusable independently and CSS color changes leave navigation intact.

---

## Phase 6: Polish and cross-cutting verification

**Purpose**: Confirm completeness, accessibility, scale, documentation, and compatibility across the full feature.

- [ ] T037 [P] Add a 100-component, 200-relationship, 100-ADR export scenario with package completeness and timing assertions in `shared/tests/html-package-scale.test.ts` and `e2e/tests/html-package-export.spec.ts`.
- [ ] T038 [P] Document HTML ZIP use, offline extraction, CSS variables, and component-size migration in `README.md` and `backend/.env.example`, referring to `specs/007-export-interactive-html/contracts/package-format.md`.
- [ ] T039 Verify unsafe text, broken-link errors, keyboard focus, visible status feedback, empty diagrams, and no silent omission against `specs/007-export-interactive-html/quickstart.md`; close gaps in `shared/tests/html-export-validation.test.ts` and `e2e/tests/html-package-export.spec.ts`.
- [ ] T040 Run `npm run build`, `npm test`, and `npm run test:e2e` from `package.json`, complete `specs/007-export-interactive-html/quickstart.md`, and record any remaining validation limits in `specs/007-export-interactive-html/quickstart.md`.

---

## Dependencies and execution order

### Phase dependencies

- Setup T001 precedes the ZIP adapter T022. Foundational T002-T011 establishes durable sizes and a full-ADR read before any story's export integration.
- US1 needs the foundation and supplies the initial package renderer and download path. US2 catalog rendering can be developed after the foundation in its own file, but T028 integration waits for US1 T021. US3 Markdown and styling can be developed after the foundation; T035 manifest integration waits for US1 T021 and US2 T028.
- Polish T037-T040 follows all three story checkpoints. T037 and T038 may proceed together; T039 and T040 follow their results.

### Dependency graph

```text
T001 Setup ────────────────────────────────────────────────┐
T002-T011 Foundation ──► US1 T012-T024 ──► US2 T025-T029 ─┼─► Polish T037-T040
                         │                 └─► US3 T030-T036 ┘
                         └───────────────────► US3 preparation
```

### Within each story

- Write the named automated checks first and observe the missing behavior. Implement models and pure renderers before package integration, and package integration before UI or end-to-end completion.
- `[P]` means distinct file work with no incomplete-task dependency at that point. Tasks that edit `html-package.ts`, `adr-page.ts`, or `svg-export.ts` across story phases remain ordered by the dependencies above.

## Parallel execution examples

- **Foundation**: T002, T003, and T004 can be written together in separate test files; after those checks, T005 domain normalization and T006 migration/schema work touch separate files.
- **US1**: T012, T013, T014, and T015 can be drafted together after the foundation. After T018, T019 diagram-page work and T020 ADR-detail work can proceed in separate files.
- **US2**: T025 catalog unit checks and T026 offline browser checks can be drafted together. T027 then builds the page, followed by T028 integration.
- **US3**: T030 package-file checks and T031 browser checks can be drafted together; T032 Markdown, T033 standalone SVG, and T034 stylesheet work touch separate files before T035 integrates them.

## Implementation strategy

1. Complete Setup and Foundation, confirming component-size compatibility and the aggregate ADR read.
2. Deliver US1 as the MVP: an offline ZIP with a selectable diagram and directly linked full ADRs. Run its independent check before extending the package.
3. Add US2's complete ADR catalog, then US3's reusable SVG, Markdown, and color customization. Validate each checkpoint independently and rerun earlier story checks.
4. Finish the scale, safety, accessibility, documentation, and full quickstart checks in Phase 6.
