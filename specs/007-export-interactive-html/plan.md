# Implementation Plan: Export Interactive HTML Package with Container Diagrams

**Branch**: `007-export-container-diagrams` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Updated `specs/007-export-interactive-html/spec.md`, FR-001–FR-025 and SC-001–SC-012, including the 2026-10-06 desktop browser clarification.

## Summary

Extend the implemented browser HTML ZIP workflow so exporting a System context includes its active owned container diagrams and all their ADRs. Freeze retained editor drafts before asynchronous work, gather saved parent/child/ADR data through one scoped read-only source endpoint, overlay captured drafts, resolve owner and external-source details against the captured parent, and validate the entire package before rendering or download. Render static child pages with local parent/child navigation, a package-wide ADR browser, one SVG per diagram, all ADR Markdown files, and one shared stylesheet.

The original component-dimension migration, full-ADR endpoint, domain SVG renderer, and ZIP adapter are implemented dependencies. Do not redo them. Keep `buildHtmlPackage(HtmlExportInput)` as the compatible single-diagram entry point for the CLI; add an aggregate builder for the browser. Direct child browser exports remain single-diagram. No database migration, new diagram kind, import capability, or retained-draft navigation feature is required.

The extracted package must pass the same offline journeys in current stable desktop Chrome, Edge, Firefox, and Safari using normal settings. Expand automated engine coverage and record actual stable-browser acceptance separately; all four product-browser results are release gates, including local-file keyboard access and directory relocation.

## Technical Context

**Language/Version**: TypeScript `^5.8.0`, Node.js as configured locally; existing React `^19.1.0` frontend.

**Primary Dependencies**: Existing Vite `^7.0.0`, Zustand `^5.0.0`, Zod `^3.25.0`, Fastify `^5.4.0`, Drizzle ORM `^0.44.0`, PostgreSQL, React Flow `^12.8.0`, and JSZip `^3.10.2`. These are manifest ranges, not newly chosen versions. No new dependency.

**Storage**: Existing diagrams, components, relationships, ADRs and link tables, including Spec 009 ownership/source fields and component dimensions. Package snapshots and navigation maps exist only in memory; no migration or export table.

**Testing**: Vitest for package validation, rendering, API source completeness, transaction consistency, draft capture, compatibility and failures; Playwright projects for branded Chrome/Edge and Firefox/WebKit engine regressions; actual stable Chrome, Edge, Firefox and Safari acceptance for extracted `file://` browsing, keyboard navigation, recoloring and multi-diagram packages; PostgreSQL integration tests for graph-read consistency and zero writes. Record exact browser/distribution, version, operating system and validation date for each result.

**Target Platform**: Existing browser app; extracted ZIP opened directly from disk in current stable desktop Chrome, Edge, Firefox and Safari on a supported desktop operating system for each browser; standard SVG editors and Markdown readers. Mobile, preview and older browser guarantees remain outside acceptance scope.

**Project Type**: Browser frontend, REST backend and shared domain/export package, with an existing CLI consumer.

**Performance Goals**: Preserve the previous 10-second export-and-local-open engineering target for the aggregate 100-component/200-relationship/100-ADR fixture with up to 10 active children in the acceptance environment. Use one browser source request, no per-artifact or per-ADR requests; database reads may scale with diagrams but not with individual ADRs. Record environment and observed timings during implementation.

**Constraints**: Script-free offline pages, relative paths only, no package fetches or external assets, stable UUID navigation, no saves/creation/restoration/read-time timestamp changes, complete failure on any required child or link error, current editor drafts frozen before requests, unchanged Mermaid/separate SVG/CLI scope.

Offline acceptance cannot use an HTTP server, changed browser security settings or privileged launch flags to make package navigation work. Engine tests and forced programmatic focus do not replace stable-browser and real keyboard journeys.

**Scale/Scope**: One selected general/System context and its active direct container children, or one directly selected child. Existing domain `kind: general | container` remains unchanged. Acceptance scope is up to 10 children and aggregate totals above; these are validation fixtures, not product export caps.

## Constitution Check

*GATE: Evaluated before research and re-evaluated after Phase 1 design.*

| Principle | Pre-research gate | Post-design result |
| --- | --- | --- |
| I. Linked, versioned artifact | Pass: existing UUID ownership and ADR references define scope. | Pass: aggregate validation and UUID path maps retain diagram, owner, occurrence and ADR identities; export never changes history. |
| II. First-class decisions | Pass: all included decisions and lifecycle states are required. | Pass: catalog and Markdown include every local ADR, full fields and replacements; links locate exact owning diagram artifacts without inheritance. |
| III. Protect architectural data | Pass: failures cannot silently omit children. | Pass: scoped membership read preserves expected child IDs; frozen overlays and all-or-nothing rendering precede ZIP; no editor or database writes. |
| IV. Verify artifact boundary | Pass: source API, model and package need automated coverage, plus FR-025/SC-012 stable-browser results. | Pass: quickstart maps every requirement, adds the four-browser evidence matrix and separates engine coverage from product acceptance; implementation results remain pending. |
| V. Simplicity and accessibility | Pass: reuse the static package and existing stack; support all required browsers with normal settings. | Pass: ordinary links and text indexes provide real keyboard journeys in each browser, shared styling follows DESIGN.md, and direct child/CLI adapters remain small. |

No justified exception or unresolved technical clarification is needed. These are design gates, not claims that the new implementation tests have run.

## Project Structure

### Documentation (this feature)

```text
specs/007-export-interactive-html/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    openapi.yaml
    package-format.md
    export-source.md
    ui-contract.md
    component-layout.md       # Implemented baseline; unchanged
  tasks.md                    # Original implementation record; regenerate next
```

### Source Code (repository root)

```text
shared/src/export/
  html-snapshot.ts             # Existing single snapshot validation/draft merge
  html-package-snapshot.ts     # Planned aggregate types, overlay and validation
  package-links.ts             # Planned stable paths/navigation context
  html-package.ts              # Single adapter plus aggregate package builder
  diagram-page.ts              # Page context and parent/child actions
  adr-page.ts                  # Catalog across all included diagrams
  adr-markdown.ts              # Diagram scope and diagram-aware local links
  svg-export.ts                # Reuse complete domain renderer
  styles.ts                    # Shared accessible stylesheet
shared/src/validation/schemas.ts
shared/src/index.ts
shared/tests/

backend/src/
  services/html-export-source.ts   # Planned read-only source service
  services/container-context.ts    # Reuse transaction-scoped hydration helpers
  persistence/graph-transaction.ts # Existing parent-first graph coordination
  persistence/diagram-repository.ts # Scoped membership read retaining child IDs
  persistence/adr-repository.ts    # Existing transaction-scoped full ADR reads
  api/export-routes.ts
  api/app.ts
backend/tests/contract/
backend/tests/persistence/

frontend/src/
  components/ExportButton.tsx
  api/export-client.ts
  state/diagram-store.ts       # Read actual retained state, no new draft cache
  state/adr-store.ts
frontend/tests/
cli/tests/                    # Existing single-diagram compatibility regressions
e2e/tests/                    # Existing export suites plus parent/child fixtures
playwright.offline.config.ts  # Planned scoped browser projects for offline suites
```

**Structure Decision**: Domain documents remain authoritative, independent of React Flow. The backend supplies a saved source graph under existing graph transaction coordination; the browser owns draft capture and archiving; shared code owns normalization, complete validation and rendering. Proposed new module names are implementation targets. [Contracts](contracts/) specify the new boundary and portable paths.

## Design Sequence

1. Add aggregate capture/source/snapshot types and schemas while preserving the existing single-diagram export API. Capture one timestamp and clone all actually retained eligible documents and ADR drafts synchronously. Current stores retain only the active document and draft; never switch diagrams, fetch into stores, resurrect discarded edits or introduce new navigation retention semantics.
2. Add `GET /diagrams/{diagramId}/export/html-source`. Use existing `GraphTransaction` to lock the canonical parent before its children and share transaction-scoped diagram/ADR repositories. Read parent-scoped raw membership and preserve every expected active child ID; a scoped discovery helper must not filter missing loads. Recheck the selected/root association inside the transaction. No global diagram list, per-owner browser lookup or POST create/open request.
3. Return saved entry and included child documents, full ADR sets, explicit active/none/trashed availability, and direct-child source context. Read only; release graph locks before rendering. The existing coordinator uses row locks, not SQL `READ ONLY` mode. Do not nest context service transactions inside this boundary.
4. Overlay only frozen drafts whose IDs belong to the required set; an excluded stale draft cannot add a diagram. Preserve canonical kind and parent/owner IDs. Resolve bundled child names, scope and external display fields from the captured parent; validate that each required owner and source still exists and is eligible. Direct-child export uses the source response's consistent context and does not bundle its parent. Merge ADR drafts per diagram using the existing lifecycle/link rules.
5. Validate all per-diagram content and aggregate completeness, active state, identity uniqueness, ownership, source references and local ADR/replacement links. Add diagram identity to every failure. Construct one path registry and owner-to-child map from the included set only.

   Validate saved ADRs against saved documents and final merged ADRs against overlaid documents. Avoid rejecting an old saved link before a captured draft removes it; extract merge/check helpers without changing legacy API signatures.
6. Render the entry at `index.html`/`diagram.svg`, children at `diagrams/<diagram-uuid>/index.html` and `diagram.svg`, a global `adrs.html`, UUID ADR Markdown files, and shared `styles.css`. Use page-relative link contexts throughout; artifact selection still opens ADR details, with a distinct visible child action. Each bundled child returns to the owning parent artifact. External-system actions resolve to already included source children only.
7. Build the complete file map before JSZip. Reject duplicate paths and invalid destinations before adding files; await archive generation before download and success feedback. Capture remains immutable despite later edits; only one export operation runs at a time. Keep no-child/direct-child/legacy builder/CLI paths compatible.
8. Add a scoped `playwright.offline.config.ts` for the offline HTML suites with projects `offline-chrome` (channel chrome), `offline-edge` (channel msedge), `offline-firefox` (Playwright Firefox) and `offline-webkit` (Playwright WebKit). Do not propagate the existing global Chromium executable override to Firefox/WebKit. Preserve existing app e2e defaults. Expand offline fixtures to parent/children, explicit disabled network, real keyboard traversal, local CSS and moved directories.
9. Validate the requirements using [quickstart.md](quickstart.md). Cover every FR/SC group, graph reads versus mutation races, source errors, draft overlays and link destinations. Record four actual current stable browser results: branded Chrome/Edge runs can supply evidence when their recorded conditions match acceptance; use actual Firefox and Safari sessions for product acceptance. Safari must be tested on a supported macOS environment. An unavailable browser leaves its gate pending; do not relabel WebKit as Safari. Regenerate tasks after planning; original completed tasks do not complete this extension.

## Phase Outputs and Handoff

Phase 0 decisions and code/documentation evidence are in [research.md](research.md). Phase 1 entities, validation and transitions are in [data-model.md](data-model.md); source API, package and UI contracts are in `contracts/`; validation commands and scenarios are in [quickstart.md](quickstart.md). Spec 009's export contract receives a narrow supersession note for this browser HTML workflow. No product code or tasks are generated by this planning update.
