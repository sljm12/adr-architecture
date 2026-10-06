---
description: "Tasks for interactive HTML package export with container diagrams"
---

# Tasks: Export Interactive HTML Package with Container Diagrams

**Input**: Design documents from `specs/007-export-interactive-html/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts](contracts/), and [quickstart.md](quickstart.md)

**Tests**: Included because the project constitution requires automated coverage for schema, persistence, linking, rendering, and export boundaries. Write the story checks first, confirm they fail for the missing behavior, then implement and rerun them.

**Organization**: Tasks are grouped by user story. `[P]` marks work in distinct files that can proceed concurrently after the stated prerequisites. Paths are relative to the repository root.

**Update (2026-10-06)**: T001-T040 and their checkboxes are preserved as the historical single-diagram implementation record. Their checkpoints describe that baseline, not completion of the updated stories. T041-T089 are the parent-and-container extension generated from the current plan, FR-001-FR-025, and SC-001-SC-012. Phases 7-8 are complete, including dedicated PostgreSQL source/race/zero-write validation; continue implementation at Phase 9. Do not reinstall JSZip, redo component dimensions/full-ADR reads, add a migration, or introduce an inactive draft cache. `.specify/feature.json` already selects this feature.

**Remaining scope**: 37 tasks: Setup 0, Foundation 0, US1 15, US2 5, US3 7, Polish 10. Historical counts: Setup 1, Foundation 10, US1 13, US2 5, US3 7, Polish 4; 89 tasks overall, 52 marked complete (40 historical, 3 extension setup and 9 extension foundation). There are 21 extension `[P]` tasks; follow the execution batches below rather than treating all marked tasks as mutually independent.

## Historical single-diagram baseline (Phases 1-6)

The original completion record is retained below. Historical validation limits are recorded in [quickstart.md](quickstart.md); it does not establish extension or four-browser acceptance.

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

- [X] T025 [P] [US2] Add failing catalog tests for every status, zero ADRs, unlinked records, full content, timestamps, replacement ADRs, duplicate titles, and component/relationship back-links in `shared/tests/adr-page-export.test.ts`.
- [X] T026 [P] [US2] Add a failing offline browser scenario that opens the catalog, reaches an unlinked ADR, and follows both component and relationship references back in `e2e/tests/html-package-adrs.spec.ts`.

### Implementation for User Story 2

- [X] T027 [US2] Extend `shared/src/export/adr-page.ts` with the complete all-ADR list, status labels, full context/decision/consequence/alternative fields, dates, replacement references, and UUID-disambiguated diagram links.
- [X] T028 [US2] Connect `index.html` to the dedicated catalog and preserve relative cross-page anchors in `shared/src/export/diagram-page.ts` and `shared/src/export/html-package.ts`, including the no-ADR state.
- [X] T029 [US2] Run and make green the US2 checks in `shared/tests/adr-page-export.test.ts` and `e2e/tests/html-package-adrs.spec.ts` without regressing the US1 tests.

**Checkpoint**: The catalog works from the extracted ZIP even when no ADR has a diagram link.

---

## Phase 5: User Story 3 — Reuse and restyle exported artifacts (P2)

**Goal**: Supply an editable standalone SVG, readable per-ADR Markdown files, and documented CSS component colors while keeping the HTML interactions intact.

**Independent Test**: Open the extracted SVG and Markdown in standard tools, edit the documented outline and fill variables, reload the HTML page, and verify all ADR links still resolve.

### Tests for User Story 3

- [X] T030 [P] [US3] Add failing manifest, standalone SVG, Markdown escaping/content, UUID filename, and CSS color-token tests in `shared/tests/html-package-portability.test.ts`.
- [X] T031 [P] [US3] Add a failing extracted-package scenario for `diagram.svg`, Markdown files, CSS recoloring, relocation, and intact keyboard navigation in `e2e/tests/html-package-portability.spec.ts`.

### Implementation for User Story 3

- [X] T032 [P] [US3] Generate one safe Markdown file per ADR with decision fields, status, dates, replacement and artifact UUID references, and explicit unlinked state in `shared/src/export/adr-markdown.ts`.
- [X] T033 [P] [US3] Complete standalone `diagram.svg` generation with editable vector primitives, explicit view box, full labels/grouping, and embedded default styling in `shared/src/export/svg-export.ts`.
- [X] T034 [P] [US3] Define documented `--component-outline` and `--component-fill` variables, readable default colors, focus styles, and `:target` detail visibility in `shared/src/export/styles.ts`, consistent with `DESIGN.md`.
- [X] T035 [US3] Emit the final `contracts/package-format.md` manifest from `shared/src/export/html-package.ts`, including `diagram.svg`, `styles.css`, and `adrs/<uuid>.md` for every ADR; keep paths relative and authored names out of paths.
- [X] T036 [US3] Run and make green the US3 checks in `shared/tests/html-package-portability.test.ts` and `e2e/tests/html-package-portability.spec.ts` without regressing US1 or US2.

**Checkpoint**: All requested files are reusable independently and CSS color changes leave navigation intact.

---

## Phase 6: Polish and cross-cutting verification

**Purpose**: Confirm completeness, accessibility, scale, documentation, and compatibility across the full feature.

- [X] T037 [P] Add a 100-component, 200-relationship, 100-ADR export scenario with package completeness and timing assertions in `shared/tests/html-package-scale.test.ts` and `e2e/tests/html-package-export.spec.ts`.
- [X] T038 [P] Document HTML ZIP use, offline extraction, CSS variables, and component-size migration in `README.md` and `backend/.env.example`, referring to `specs/007-export-interactive-html/contracts/package-format.md`.
- [X] T039 Verify unsafe text, broken-link errors, keyboard focus, visible status feedback, empty diagrams, and no silent omission against `specs/007-export-interactive-html/quickstart.md`; close gaps in `shared/tests/html-export-validation.test.ts` and `e2e/tests/html-package-export.spec.ts`.
- [X] T040 Run `npm run build`, `npm test`, and `npm run test:e2e` from `package.json`, complete `specs/007-export-interactive-html/quickstart.md`, and record any remaining validation limits in `specs/007-export-interactive-html/quickstart.md`.

---

## Historical baseline dependencies and execution order

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

## Historical baseline parallel execution examples

- **Foundation**: T002, T003, and T004 can be written together in separate test files; after those checks, T005 domain normalization and T006 migration/schema work touch separate files.
- **US1**: T012, T013, T014, and T015 can be drafted together after the foundation. After T018, T019 diagram-page work and T020 ADR-detail work can proceed in separate files.
- **US2**: T025 catalog unit checks and T026 offline browser checks can be drafted together. T027 then builds the page, followed by T028 integration.
- **US3**: T030 package-file checks and T031 browser checks can be drafted together; T032 Markdown, T033 standalone SVG, and T034 stylesheet work touch separate files before T035 integrates them.

## Historical baseline implementation strategy

1. Complete Setup and Foundation, confirming component-size compatibility and the aggregate ADR read.
2. Deliver US1 as the MVP: an offline ZIP with a selectable diagram and directly linked full ADRs. Run its independent check before extending the package.
3. Add US2's complete ADR catalog, then US3's reusable SVG, Markdown, and color customization. Validate each checkpoint independently and rerun earlier story checks.
4. Finish the scale, safety, accessibility, documentation, and full quickstart checks in Phase 6.

---

## Phase 7: Extension setup (shared infrastructure)

**Purpose**: Prepare reusable parent/child fixtures and scoped offline browser projects without changing the existing app suite or dependencies.

- [X] T041 [P] Extend `shared/tests/html-export-fixtures.ts` with a deterministic general parent, two active children, duplicate-name owners/artifacts/ADRs, an empty child, none/trashed/unrelated child states, external-source sibling navigation, local links, all ADR statuses, and valid same-diagram replacements; reuse `shared/tests/container-fixtures.ts` and expose expected UUID/link sets.
- [X] T042 [P] Extend `e2e/tests/html-package-fixtures.ts` to prepare matching persisted parent/child fixtures, download/extract one ZIP, enumerate files/anchors, and open root/nested pages from disk; provide explicit network-disable and directory-relocation helpers without serving extracted files over HTTP.
- [X] T043 [P] Add `playwright.offline.config.ts` selecting only HTML package suites with projects `offline-chrome` (chrome channel), `offline-edge` (msedge channel), `offline-firefox` (Firefox engine), and `offline-webkit` (WebKit engine); reuse app server setup but remove inherited Chromium executable overrides from engine projects, retain traces, and preserve `playwright.config.ts` defaults without privileged file-access flags.

**Checkpoint**: Shared and browser fixtures identify expected diagrams and links, and offline projects can be selected separately. Existing dependencies suffice; no migration is planned.

---

## Phase 8: Extension foundation (blocking prerequisites)

**Purpose**: Provide a validated, complete, transaction-coordinated saved source for the browser and transient aggregate input types.

Write T044-T046 first and demonstrate missing extension behavior. T047-T051 implement their contracts; T052 must pass before story integration.

- [X] T044 [P] Add failing contract tests in `backend/tests/contract/html-export-source.test.ts` for `GET /diagrams/:diagramId/export/html-source`: entry-first/UUID-ordered active children, full local ADR sets, none/trashed availability, direct-child context including eligible unused sources, no-child/legacy general entries, and 404/409/422/500 error fields per `specs/007-export-interactive-html/contracts/openapi.yaml`; verify unrelated corrupt diagrams do not affect a scoped read and required-child failures never return partial 200 responses.
- [X] T045 [P] Add failing in-memory and PostgreSQL source tests in `backend/tests/persistence/html-export-source.test.ts` using the graph-race patterns in `backend/tests/persistence/container-graph-transactions.test.ts`; cover raw expected child IDs versus missing loads, parent-first locks, selected association rechecks, races with save/create-child/trash/restore/ADR mutations, detached responses, complete before-or-after graphs, bounded full-ADR reads, and unchanged rows/timestamps/trash state.
- [X] T046 [P] Add failing wire-schema tests in `shared/tests/html-export-source.test.ts` for aggregate source fields, UUID/date/full-ADR parsing, invalid member payloads, availability/context shape, and legacy general normalization; distinguish malformed source parsing from later graph-integrity validation.
- [X] T047 Define transient `HtmlPackageCapture`, `HtmlExportSource`, `HtmlPackageSnapshot`, and override/member types in `shared/src/export/html-package-snapshot.ts`, add the source runtime schema in `shared/src/validation/schemas.ts`, and expose them through `shared/src/index.ts`; follow `specs/007-export-interactive-html/data-model.md`, retain existing `HtmlExportInput` APIs, and introduce no persisted schema.
- [X] T048 Add a transaction-scoped raw parent-child membership helper to both repository implementations and `DiagramRepositoryLike` in `backend/src/persistence/diagram-repository.ts`; retain expected UUID/status/owner associations before hydration, do not filter missing active loads, do not call global listing, and avoid reads scaling per individual ADR.
- [X] T049 Extract/reuse repository-scoped ownership, availability, and eligible source hydration helpers in `backend/src/services/container-context.ts` so an existing graph transaction can hydrate bundled and directly selected children without nested transactions or create/open/restore calls; preserve existing public context behavior.
- [X] T050 Implement the read-only source service in `backend/src/services/html-export-source.ts` using `backend/src/persistence/graph-transaction.ts`, canonical parent-first locking, T048 membership, T049 helpers, and transaction-scoped `listFull` from `backend/src/persistence/adr-repository.ts`; recheck entry status/kind/scope inside the boundary, validate saved references, return complete detached ordered members/context/availability, identify expected missing child UUIDs, and release locks before rendering.
- [X] T051 Register the source GET in `backend/src/api/export-routes.ts` and wire its service in `backend/src/api/app.ts`; map missing/inactive entry to 404, broken graph to 409, invalid UUID/content to 422, unexpected reads to safe 500, with code/diagram/artifact/field/remedy feedback; update `backend/tests/contract/openapi.test.ts` to verify `specs/007-export-interactive-html/contracts/openapi.yaml` while preserving existing export/full-ADR routes.
- [X] T052 Run and make green `shared/tests/html-export-source.test.ts`, `backend/tests/contract/html-export-source.test.ts`, `backend/tests/contract/openapi.test.ts`, and `backend/tests/persistence/html-export-source.test.ts` with both repository implementations and a dedicated migrated PostgreSQL database; record actual commands and any skipped database gate in `specs/007-export-interactive-html/quickstart.md` without marking skipped race/zero-write coverage as passed.

**Checkpoint**: One GET returns the complete saved package scope with full ADRs and no writes. Required children cannot vanish through filtered loads; direct children return context but no parent/siblings. Database skips leave T052 incomplete.

---

## Phase 9: User Story 1 - Export and explore an architecture package (P1, extension MVP)

**Goal**: Capture current retained edits and export the parent plus every required active child in one atomic offline package, with complete C4 visuals, exact direct ADR selection, and accessible parent/child/source navigation.

**Independent Test**: Export a duplicate-name parent with two active children, none/trashed owners, parent/child component-only and relationship-only ADRs, and retained edits. Extract the ZIP, disable network, open `index.html` by file URL, visit each child and an external source's included child, read exact local ADRs, and return to the correct parent owner using pointer and native keyboard links. Direct-child export contains only itself. Invalid required-child content yields no ZIP and no state writes.

### Tests for User Story 1

- [ ] T053 [P] [US1] Add failing aggregate snapshot tests in `shared/tests/html-package-snapshot.test.ts` for frozen multi-override inputs, saved fallback, stale/excluded overrides, saving/failed-save states, later edits, canonical kind/owner preservation, owner/source draft rename/removal/reclassification, direct-child source context, aggregate duplicate IDs, local endpoints/ADR/replacement integrity, and diagram/artifact/field/remedy errors; include a saved ADR link removed by a captured ADR draft after a draft artifact deletion.
- [ ] T054 [P] [US1] Add failing path registry tests in `shared/tests/package-links.test.ts` for root/child HTML and SVG, shared CSS/catalog/Markdown, owner returns, sibling source actions, component/relationship fragments, duplicate names, excluded destinations, duplicate paths, absolute/traversal paths, and every relative link in `specs/007-export-interactive-html/contracts/package-format.md`.
- [ ] T055 [P] [US1] Add failing renderer/package tests in `shared/tests/html-package-navigation.test.ts` for entry/children completeness, owner boundary and all C4 fields, stable local selection, exact ADR lists without source/parent/endpoint inheritance, full child decision links, owner returns, sibling source actions without recursive inclusion, none/trashed explanations, empty child states, and direct-child navigation exclusions.
- [ ] T056 [P] [US1] Extend `frontend/tests/html-export-button.test.tsx` and `frontend/tests/container-html-export.test.tsx` for synchronous capture before source retrieval, edits during a delayed request, one source request without per-owner/full-ADR browser requests, eligible current ADR drafts, saving/duplicate-export blocks, stage feedback, source/archive failures, and unchanged stores/history/drafts/navigation/save state.
- [ ] T057 [P] [US1] Extend `e2e/tests/html-package-export.spec.ts` with the independent parent/two-child journey, duplicate-name owner targeting, external-source sibling action, exact parent/child relationship ADR selection, none/trashed exclusions, direct and empty child exports, draft metadata capture, atomic failure/no-save behavior, and real Tab/Enter reachability from normal page focus after disabling network.
- [ ] T058 [P] [US1] Extend `cli/tests/container-export-command.test.ts`, `cli/tests/export-command.test.ts`, and `shared/tests/container-export.test.ts` with compatibility assertions for legacy `buildHtmlPackage(HtmlExportInput)`, no-child general/direct-child root paths, no new CLI parent/sibling requests, and unchanged separate Mermaid/SVG scope.

### Implementation for User Story 1

- [ ] T059 [US1] Extract reusable ADR merge/link-validation helpers in `shared/src/export/html-snapshot.ts`; validate saved ADR sets against saved documents before validating merged ADRs against overlaid documents, preserve existing single-diagram signatures and lifecycle behavior, and generate a new unsaved ADR's package-local UUID once without mutating the editor draft.
- [ ] T060 [US1] Implement pure aggregate assembly/validation in `shared/src/export/html-package-snapshot.ts`: clone capture/source data, overlay only included IDs, reject canonical kind/parent/owner changes, reconcile complete availability, derive child titles/scope/external display fields from the captured parent or direct-child context, merge local ADR drafts with T059, validate cross-member identity uniqueness and required references, and build included-only owner-child maps; never infer metadata or inherit ADRs.
- [ ] T061 [US1] Implement `PackageLinkContext` in `shared/src/export/package-links.ts` mapping UUIDs to safe deterministic HTML/SVG/catalog/Markdown paths and local anchors, computing origin-relative destinations and owner/source navigation from the validated included set; reject collisions, unsafe paths, and nonexistent destinations.
- [ ] T062 [US1] Extend `shared/src/export/diagram-page.ts` with optional package/page context, root and nested relative links, container level/owner headings, a distinct Open container diagram action, parent returns to owner anchors, included external-source actions, none/trashed explanations and direct-child exclusions; preserve exact direct ADR lists, explicit empty states, escaped complete C4 labels, and ordinary text links for native keyboard navigation following `DESIGN.md`.
- [ ] T063 [US1] Extend `shared/src/export/adr-page.ts` to accept aggregate/link context and render every included ADR's full escaped detail at a stable unique anchor, with originating diagram identity and correct local references; add minimum diagram-aware artifact/replacement destinations to `shared/src/export/adr-markdown.ts` so initial child files have no broken links before US3 completes their scope metadata; preserve single-snapshot rendering so US1 can read full child decisions before US2 completes the catalog.
- [ ] T064 [US1] Add an aggregate builder in `shared/src/export/html-package.ts` and expose it in `shared/src/index.ts`; render root and all child HTML/SVG pairs, shared styles/catalog and every ADR file from one validated snapshot, using compatible renderer adapters and T061 paths, and reject duplicate paths or unresolved file/fragment references before returning any file map; retain `buildHtmlPackage(HtmlExportInput)` as the single-diagram adapter.
- [ ] T065 [US1] Replace the browser HTML path in `frontend/src/api/export-client.ts` with one validated html-source GET followed by frozen-overlay aggregate building and the existing JSZip adapter; surface source and local scoped errors, await complete archive generation before download/success, reject duplicate paths before ZIP insertion, and keep Mermaid/separate export helpers compatible.
- [ ] T066 [US1] Update `frontend/src/components/ExportButton.tsx` to synchronously clone the active retained document and matching eligible ADR draft with one capture timestamp before asynchronous work, block saves/concurrent exports, describe parent-versus-direct-child scope, and announce gathering/validation/rendering/archiving/success/failure via the existing polite status region; use actual state in `frontend/src/state/diagram-store.ts` and `frontend/src/state/adr-store.ts` without adding caches or changing save/navigation/history, and follow `DESIGN.md`.
- [ ] T067 [US1] Run and make green the T053-T058 suites in `shared/tests/html-package-snapshot.test.ts`, `shared/tests/package-links.test.ts`, `shared/tests/html-package-navigation.test.ts`, `frontend/tests/html-export-button.test.tsx`, `frontend/tests/container-html-export.test.tsx`, `cli/tests/container-export-command.test.ts`, `cli/tests/export-command.test.ts`, `shared/tests/container-export.test.ts`, and `e2e/tests/html-package-export.spec.ts`; complete the US1 independent journey and record observed results in `specs/007-export-interactive-html/quickstart.md`.

**Checkpoint**: The extension MVP exports complete active parent/children and full direct ADR details atomically. No-child, directly selected child, CLI and separate exports retain scope. US1 engine checks do not complete four-browser product acceptance.

---

## Phase 10: User Story 2 - Browse every ADR in the export (P1)

**Goal**: Complete one package-wide catalog with every local decision and exact diagram-qualified backlinks, without inheriting parent/source ADRs.

**Independent Test**: Export the parent and two children with repeated titles/names, all lifecycle states, replacements, linked/unlinked decisions, and a child with no ADRs. Verify each decision appears once with scope and full content; component and relationship backlinks locate the exact owning page/artifact, and zero-ADR local/global states remain clear.

### Tests for User Story 2

- [ ] T068 [P] [US2] Extend `shared/tests/adr-page-export.test.ts` with aggregate catalog cases for each included decision exactly once, duplicate titles across diagrams, diagram name/UUID/level, all fields/statuses/dates, same-diagram replacements, unlinked decisions, zero-local/global ADRs, and exact parent/child component and relationship destinations without inherited links.
- [ ] T069 [P] [US2] Extend `e2e/tests/html-package-adrs.spec.ts` to open the shared catalog from root and nested children, browse full linked/unlinked decisions and valid replacements, follow backlinks into the exact duplicate-name parent/child artifact, and traverse catalog/decision/backlink text links using native keyboard input with disabled network.

### Implementation for User Story 2

- [ ] T070 [US2] Complete aggregate catalog rendering in `shared/src/export/adr-page.ts` with deterministic diagram-scoped ordering, one entry/detail per ADR UUID, readable name/ID/level, all lifecycle fields and dates, local replacement references, and explicit unlinked/global empty states using T061 paths and escaping.
- [ ] T071 [US2] Finish catalog integration in `shared/src/export/diagram-page.ts` and `shared/src/export/html-package.ts`: every included page reaches the single root ADR browser, full decision references resolve to their owning diagram and exact artifact, and diagrams with zero local ADRs keep their local empty state even when other diagrams have decisions.
- [ ] T072 [US2] Run and make green `shared/tests/adr-page-export.test.ts` and `e2e/tests/html-package-adrs.spec.ts`, validate the US2 independent journey, and rerun US1 navigation/link checks in `shared/tests/html-package-navigation.test.ts` and `shared/tests/package-links.test.ts`; record results in `specs/007-export-interactive-html/quickstart.md`.

**Checkpoint**: Every included decision is browseable once with scope, full fields and exact local references, including unlinked decisions and all statuses.

---

## Phase 11: User Story 3 - Reuse and restyle exported artifacts (P2)

**Goal**: Complete per-diagram standalone vectors, diagram-qualified ADR Markdown and shared documented color controls throughout the portable package.

**Independent Test**: Open root/child SVGs in a standard editor and every parent/child ADR Markdown file in a reader. Verify complete editable content and scoped references, change both documented CSS variables, reload root/nested HTML, relocate the directory, and repeat artifact/ADR/parent/source navigation with native keyboard input.

### Tests for User Story 3

- [ ] T073 [P] [US3] Extend `shared/tests/html-package-portability.test.ts` for the exact multi-diagram manifest, full standalone/inline SVG content parity, empty child boundary, one safe Markdown file per ADR with diagram scope and exact artifact/replacement paths, duplicate names, complete local file/fragment resolution, authored markup escaping, and shared outline/fill variables.
- [ ] T074 [P] [US3] Extend `e2e/tests/html-package-portability.spec.ts` to inspect root/nested SVG and Markdown content, change local CSS and reload all included pages, move the extracted directory, and repeat child/source/parent/ADR journeys using file URLs, disabled network and native keyboard traversal without locator-forced focus.

### Implementation for User Story 3

- [ ] T075 [P] [US3] Extend `shared/src/export/adr-markdown.ts` with optional aggregate/link context, diagram name/UUID/level, exact local artifact names/UUIDs and origin-relative HTML references, same-diagram replacement destinations, explicit unlinked state, and escaped full decision fields/status/dates; retain the single-snapshot adapter.
- [ ] T076 [P] [US3] Verify and extend `shared/src/export/svg-export.ts` only where needed to preserve root/child editable vector parity, owner boundary, Application/Datastore cues, responsibilities/technologies, external details, directed interaction descriptions/protocols, grouping, layout and complete labels with explicit view boxes and embedded standalone defaults; add focused assertions in `shared/tests/svg-export.test.ts` without importing editor state.
- [ ] T077 [P] [US3] Extend `shared/src/export/styles.ts` so documented `--component-outline` and `--component-fill` settings affect every root/nested inline diagram, with readable default contrast, visible text-link/fragment focus and empty/detail states consistent with `DESIGN.md`; retain script-free interactions and independent standalone SVG defaults.
- [ ] T078 [US3] Complete the aggregate manifest in `shared/src/export/html-package.ts` using T075-T077 and `shared/src/export/package-links.ts`: one SVG per diagram, one Markdown per ADR and one root stylesheet/catalog, safe UUID-only internal paths, relative destinations and no collisions or missing generated targets; retain the root-only manifest for legacy/no-child/direct-child adapters.
- [ ] T079 [US3] Run and make green `shared/tests/html-package-portability.test.ts`, `shared/tests/svg-export.test.ts`, and `e2e/tests/html-package-portability.spec.ts`; perform actual SVG-editor/Markdown-reader checks for parent and child files, record tool versions and observations in `specs/007-export-interactive-html/quickstart.md`, and rerun US1/US2 offline links after recoloring/relocation.

**Checkpoint**: Every diagram and ADR is independently reusable, shared recoloring works on all HTML pages, and moved packages retain all destinations.

---

## Phase 12: Extension polish and cross-cutting acceptance

**Purpose**: Prove scope, safety, usability, scale, compatibility and actual four-browser offline acceptance; record pending external validation explicitly.

- [ ] T080 [P] Extend `shared/tests/html-package-scale.test.ts` and the aggregate timing scenario in `e2e/tests/html-package-export.spec.ts` with up to 10 active children and aggregate 100-component/200-relationship/100-ADR totals; assert complete files/artifacts, one browser source request and no per-ADR requests, and record source/archive/total export-and-local-open timing, archive size and environment against the 10-second engineering target in `specs/007-export-interactive-html/quickstart.md` without turning fixture sizes into product caps.
- [ ] T081 [P] Update `README.md` for automatic active-child inclusion, direct-child/CLI scope, nested HTML/SVG paths, package-wide ADRs, documented CSS variables, read-only retained-state export, actionable failures, extraction/relocation and browser validation commands; reference `specs/007-export-interactive-html/contracts/package-format.md` and preserve existing migration/setup guidance.
- [ ] T082 Close cross-cutting gaps in `shared/tests/html-package-snapshot.test.ts`, `shared/tests/html-package-navigation.test.ts`, `frontend/tests/html-export-button.test.tsx`, and `e2e/tests/html-package-export.spec.ts` for unsafe/non-Latin/reserved text, unsupported geometry/subtypes, corrupt sources/links, duplicate output destinations, source/archive rejection, empty parent/child/global ADR states, readable labels/contrast/native keyboard focus, and no save/create/restore/history/timestamp side effects; check FR-001-FR-024 and SC-001-SC-011 against `specs/007-export-interactive-html/quickstart.md` coverage.
- [ ] T083 Run the three HTML package suites in `e2e/tests/html-package-export.spec.ts`, `e2e/tests/html-package-adrs.spec.ts`, and `e2e/tests/html-package-portability.spec.ts` under all four `playwright.offline.config.ts` projects; record exact distributions/builds, OS/date, file-URL/network-disable/native-keyboard conditions, package identity and traces in `specs/007-export-interactive-html/quickstart.md`, fix markup/style regressions and rerun affected journeys, and leave unavailable engines pending rather than passed.
- [ ] T084 Observe representative readers performing SC-003 artifact-to-ADR/unlinked-catalog discovery and SC-007 system-to-child-relationship-ADR/owner-return journeys, including keyboard-only navigation, using the package from `e2e/tests/html-package-fixtures.ts`; record sample size, actual per-journey times/success rates and whether at least 90% finish within 2 minutes without instructions in `specs/007-export-interactive-html/quickstart.md`, fix observed workflow failures and revalidate without inventing usability evidence.
- [ ] T085 Complete the actual current stable Chrome acceptance row in `specs/007-export-interactive-html/quickstart.md` using extracted parent/children, no-child, direct-child and empty-child packages from `e2e/tests/html-package-fixtures.ts`; verify every FR-025/SC-012 rendering/navigation/ADR/keyboard/CSS/relocation journey at file URLs with disabled network and normal settings, and record exact browser/channel/version, OS/version, date, fixture identity, per-journey outcomes and evidence location; reuse branded automation only when its recorded conditions meet acceptance.
- [ ] T086 Complete the actual current stable Edge acceptance row in `specs/007-export-interactive-html/quickstart.md` with the same fixtures and all T085 journeys/conditions/evidence fields; matching branded automation may supply evidence, but an unavailable browser or failed journey leaves the row and task pending.
- [ ] T087 Complete the actual installed current stable Firefox acceptance row in `specs/007-export-interactive-html/quickstart.md` with the same fixtures and all T085 journeys/conditions/evidence fields using a real browser session; do not substitute Playwright's Firefox engine build, and leave the row/task pending if the actual session is unavailable.
- [ ] T088 Complete the actual current stable Safari acceptance row in `specs/007-export-interactive-html/quickstart.md` on supported macOS with the same fixtures and all T085 journeys/conditions/evidence fields using a real Safari session; do not substitute WebKit, a local HTTP server, changed security settings or privileged launch flags, and leave the row/task pending if the required environment is unavailable.
- [ ] T089 Run `npm.cmd run build`, `npm.cmd test`, dedicated PostgreSQL checks with `RUN_POSTGRES_TESTS=1`, the existing app suite from `playwright.config.ts`, and the scoped offline projects from `playwright.offline.config.ts` using the commands in `specs/007-export-interactive-html/quickstart.md`; record actual outcomes, historical-versus-current failures, skips, FR/SC evidence and remaining gates there, and mark extension acceptance complete only after required database, usability and all four actual stable-browser rows pass.

**Checkpoint**: All three updated stories pass their independent journeys, and required source consistency, compatibility, usability and browser evidence exists. An engine pass, skipped database suite or historical checkbox cannot substitute for a pending acceptance gate.

---

## Extension dependencies and execution order

### Phase dependencies

- **Setup (T041-T043)**: Fixture/config preparation can run concurrently. T041 precedes shared/source tests; T042-T043 precede offline journey work.
- **Foundation (T044-T052)**: T044-T046 are independent failing-test batches. T047 establishes shared source types before the source service/client. T048 then T049 provide scoped repository/context helpers before T050; T051 follows T050 and T052 verifies the complete boundary. No story integration begins before T052 passes.
- **US1 (T053-T067)**: T053-T058 can be written concurrently after Foundation. T059 precedes T060; T061 uses validated aggregate types/maps from T060. T062 and T063 touch different renderer files and may proceed together after T061. T064 joins the renderers; T065 then T066 integrate browser capture/download/status; T067 verifies the MVP.
- **US2 (T068-T072)**: Test preparation can begin after Foundation, but implementation waits for US1's T063-T064 renderer/package contracts. T070 catalog precedes T071 integration and T072 verification. US2 modifies renderer files also used by US1; do not edit those tasks concurrently.
- **US3 (T073-T079)**: Test preparation can begin after T061. T075-T077 can proceed together once US1's renderer/package contracts and US2's diagram-qualified references are stable. T078 waits for all three, followed by T079. Do not overlap T076 with US1 SVG rendering changes or T078 with US2 package integration.
- **Polish (T080-T089)**: Begins after story checkpoints. T080 tests and T081 documentation touch separate files, but serialize their quickstart evidence writes. T082 closes gaps before T083 engine acceptance. T084 usability and T085-T088 actual-browser sessions use the verified package; independent sessions may run concurrently, while updates to the shared quickstart evidence are serialized. T089 is the final integrated gate.

### Story completion graph

```text
Historical T001-T040 (reuse; no extension acceptance)
                         |
Setup T041-T043 -> Foundation T044-T052 -> US1 T053-T067 (extension MVP)
                                              |
                                              v
                                         US2 T068-T072
                                              |
                                              v
                                         US3 T073-T079
                                              |
                                              v
                                         Polish T080-T089

After Foundation: US2/US3 test preparation may overlap US1 work.
After T061: US1 diagram-page and full-ADR-detail renderers may overlap.
After US2: US3 Markdown, SVG and stylesheet implementation may overlap.
```

### Within each story

Write the specified checks first and observe failure for missing extension behavior. Implement pure model/validation/path code before renderers and integration; validate each independent story before declaring its checkpoint complete. `[P]` is limited to separate files at the stated batch boundary, not a waiver of prerequisites. Retain every historical task ID and checkbox; mark new tasks complete only from actual implementation/validation evidence.

## Extension parallel execution examples

- **Setup**: T041 shared fixtures, T042 browser fixtures and T043 scoped config use different files.
- **Foundation**: T044 contract tests, T045 persistence/race tests and T046 source-schema tests use different files after their fixtures exist.
- **US1**: T053 snapshot tests, T054 path tests, T055 renderer tests, T056 frontend tests, T057 browser tests and T058 CLI/compatibility tests can be drafted together after Foundation. After T061, T062 diagram-page rendering and T063 full-ADR detail rendering can proceed together in separate files.
- **US2**: T068 shared catalog tests and T069 browser catalog tests can be drafted together; then complete T070-T072 in order.
- **US3**: T073 shared portability tests and T074 browser portability tests can be drafted together. Once US2 is stable, T075 Markdown, T076 SVG and T077 styles can proceed together before T078 integrates them.
- **Acceptance**: Browser sessions for T085-T088 can be performed independently in the required environments after T082-T083, with serialized evidence updates to `specs/007-export-interactive-html/quickstart.md`.

## Extension implementation strategy

1. Reuse the completed baseline and Spec 009 ownership/source behavior. Complete extension Setup and Foundation without migrations, new dependencies or retained-draft navigation changes.
2. Deliver **US1 as the extension MVP**: complete parent/active-child capture, validation, one-source download, offline child/source/owner navigation and exact directly linked full decisions. Validate T067 before extending the catalog.
3. Complete US2's package-wide scoped catalog, then US3's portable SVG/Markdown and shared recoloring. Run each independent check and keep earlier story checks green.
4. Complete scale/safety/documentation, engine regressions and observed usability. Validate actual stable Chrome, Edge, Firefox and Safari with normal settings, disabled network and file URLs, including native keyboard traversal and relocation.
5. Record unavailable validation environments as pending gates and leave their tasks unchecked. Finish T089 only when the full required evidence exists; no historical result or engine-only run completes the updated feature.
