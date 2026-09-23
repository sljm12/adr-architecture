# Implementation Plan: Export Interactive HTML Package

**Branch**: `main` (active feature: `007-export-interactive-html`) | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-export-interactive-html/spec.md`

## Summary

Add a read-only export action that freezes the visible diagram and ADR draft, loads the complete saved ADR set, validates and merges the snapshot, and downloads one ZIP. The ZIP contains a static offline diagram page with clickable inline SVG, a dedicated all-ADR page, a standalone SVG, a customizable stylesheet, and one Markdown file per ADR. Extend the component domain and persistence model with dimensions so resized components retain their visible layout in the editor and export. Keep the saved-state Mermaid export separate.

## Technical Context

**Language/Version**: TypeScript 5.8; React 19 frontend and Node.js backend as configured by the repository

**Primary Dependencies**: Existing React, Vite, Zustand, Zod, Fastify, Drizzle, PostgreSQL, and React Flow; add JSZip to the frontend archive adapter

**Storage**: Existing PostgreSQL artifacts; add width and height to persisted components. No stored export jobs or package records.

**Testing**: Vitest for domain normalization, validation, SVG/HTML/Markdown rendering, API and persistence compatibility; Playwright for download, extracted offline navigation, CSS recoloring, and keyboard workflows

**Target Platform**: Current browser app and extracted ZIP opened locally in a modern desktop browser; standalone SVG editors and Markdown readers

**Project Type**: Browser frontend with REST backend and shared domain package

**Performance Goals**: Complete export and local open for a valid diagram with 100 components, 200 relationships, and 100 ADRs within 10 seconds in the acceptance environment; no per-ADR network request

**Constraints**: Offline `file://` navigation; no external assets, fetch calls, or scripts inside the package; stable UUID cross-references; no save side effects; atomic failure on invalid content; existing Mermaid behavior retained

**Scale/Scope**: One active diagram per ZIP, its complete ADR set, one optional unsaved ADR draft, and the current domain's component, relationship, and group visuals

## Constitution Check

*GATE: Checked before research and again after Phase 1 design.*

| Principle | Pre-research gate | Post-design result |
| --- | --- | --- |
| I. Linked, versioned artifact | Pass: export uses existing UUIDs and a frozen snapshot. | Pass: [data-model.md](data-model.md) and the package contract define stable anchors and reference checks. Export does not mutate version history. |
| II. First-class decisions | Pass: all ADR states and content are in scope. | Pass: the ADR page and Markdown contract include content, status, timestamps, and replacement references, even for unlinked ADRs. |
| III. Protect architectural data | Pass: invalid content must fail before download. | Pass: validation is atomic and errors identify the artifact and field; no save or deletion occurs. |
| IV. Verify artifact boundary | Pass: scope identifies link, schema, rendering, API, and persistence tests. | Pass: the validation guide covers identity, links, migration, escaping, ZIP, and offline navigation. |
| V. Simplicity and accessibility | Pass: static package with ordinary links and visible focus. | Pass: no package runtime is needed; SVG links and a textual artifact index support keyboard navigation. |

No constitution violation or unresolved technical clarification remains.

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
    component-layout.md
    package-format.md
  tasks.md                 # Created by a later speckit-tasks workflow
```

### Source Code (repository root)
```text
shared/src/
  domain/types.ts          # Component size joins the domain artifact
  domain/invariants.ts     # Snapshot and reference integrity
  validation/schemas.ts    # Backward-compatible component size normalization
  export/                  # Pure SVG, HTML, Markdown, and package-file renderers
shared/tests/              # Domain, export, and compatibility tests

backend/
  src/persistence/schema.ts
  src/persistence/diagram-repository.ts
  src/persistence/adr-repository.ts   # Aggregate full-ADR read
  src/services/adr-service.ts
  src/api/adr-routes.ts                # Diagram-scoped full-ADR read endpoint
  drizzle/                             # Additive component-size migration
  tests/                               # API and persistence contract tests

frontend/
  src/state/diagram-store.ts           # Persist resize as a diagram edit
  src/components/DiagramCanvas.tsx
  src/components/ExportButton.tsx
  src/api/export-client.ts             # Read full ADRs; assemble and download ZIP
  src/styles.css                       # Export control follows DESIGN.md
  tests/                               # Snapshot merge and export UI tests

e2e/                                   # Download, extract, offline and keyboard scenarios
```

**Structure Decision**: Keep rendering and validation in `shared/src/export`, independent of React Flow. The frontend freezes editor state and assembles the ZIP; the backend supplies complete saved ADR records through REST. Component dimensions become domain data, with an additive migration and compatibility defaults. The package files and API boundary are specified in [contracts](contracts/).

## Design Sequence

1. Add component dimensions to domain validation, repository mapping, migration, and editor resize state. Normalize older documents to the current default size and keep group bounds fitted to persisted dimensions.
2. Add a diagram-scoped full-ADR read path that returns every ADR with component and relationship IDs in a bounded number of database reads; preserve the existing summary list API.
3. Capture the editor snapshot before asynchronous work, overlay the optional ADR draft by ID, assign an export-only UUID to a new draft, and validate all artifact ownership, endpoints, group membership, replacement references, and supported visual types.
4. Render one SVG model into inline HTML and standalone SVG, then render static component and relationship detail sections, the all-ADR page, Markdown files, and the stylesheet. Escape text for each output context and use UUID-only anchors and filenames.
5. Package the completed file map into a ZIP Blob and expose a separate HTML package export control with progress and artifact-specific failure feedback. Keep Mermaid export's existing saved-state rule unchanged.
6. Verify schema compatibility, repository/API behavior, exact link sets, duplicate names, rejected/superseded/unlinked ADRs, resized/grouped layouts, unsafe text, invalid references, extracted `file://` use, color settings, and keyboard navigation.
