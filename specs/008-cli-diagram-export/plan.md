# Implementation Plan: CLI Diagram Export

**Branch**: `008-cli-diagram-export` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-cli-diagram-export/spec.md`

## Summary

Add a small TypeScript CLI that lists and filters active diagrams and exports one selected, persisted diagram as the existing portable ZIP package. The CLI reads through the existing REST routes, validates responses with shared schemas, calls the shared HTML package builder, and uses the existing JSZip dependency to write a local archive without overwriting an existing file. The user-facing contract and design decisions are in [cli-contract.md](contracts/cli-contract.md) and [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.8, Node.js 22 (repository runtime is Node 22.17.1)

**Primary Dependencies**: Existing shared package schemas and `buildHtmlPackage`; existing JSZip 3.10.2; Node built-ins `util.parseArgs`, `fetch`, `node:path`, and `node:fs/promises`; existing `tsx` and Vitest toolchain. No new CLI or HTTP framework.

**Storage**: Existing REST service backed by the current PostgreSQL persistence layer; one local ZIP file per export. The CLI has no direct database access and adds no persistent server data.

**Testing**: Root Vitest suite with CLI unit and HTTP-contract tests using mocked fetch responses and temporary output directories; package validation against the established ZIP contract. Existing backend route contract tests remain authoritative for server behavior.

**Target Platform**: Node.js 22 on Windows, macOS, and Linux; API URL and local output path are configurable or interpreted through standard Node URL and path handling.

**Project Type**: TypeScript CLI sibling project in the existing monorepo, runnable from the repository checkout with a root npm script.

**Performance Goals**: Meet spec criterion SC-001 by listing up to 100 active diagrams and letting the author identify a target within 30 seconds. Export one diagram at a time using the existing package builder's snapshot behavior.

**Constraints**: The CLI reads only persisted active diagrams from the existing REST API, uses stable UUIDs, includes every full ADR state returned for the diagram, and reuses shared export validation. It adds no API route, authentication, permissions, workspace, migration, or artifact mutation. Name filtering is local because the existing list endpoint has no filter parameter. Output paths must not be overwritten; package validation and archive generation finish before the output is opened. The first release is invoked from the repository checkout; publishing a global package is outside the current scope.

**Scale/Scope**: List and filter up to 100 active diagram summaries; export one selected diagram and its ADR set per invocation. No bulk export, CRUD, import, trash, or restore operations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

- **I. Architecture is a linked, versioned artifact — PASS.** The CLI selects diagrams by stable UUID and reuses shared artifact validation and package references. It reads saved state and does not alter artifact history.
- **II. Decisions are first-class and explainable — PASS.** Export loads the complete diagram-scoped ADR set, including unlinked ADRs and every lifecycle state, then relies on the existing package builder to preserve ADR content and artifact links.
- **III. User actions protect architectural data — PASS.** The CLI is read-only against the service, fails on unsupported or invalid package content, and refuses to overwrite local files or report incomplete archives as successful.
- **IV. Quality is verified at the artifact boundary — PASS.** The design calls for tests of API schema validation, stable link preservation, package manifest/content, validation failures, and filesystem failure behavior.
- **V. Simplicity and accessibility guide the product — PASS.** One small CLI project and built-in Node utilities cover the required workflow; readable diagnostics, help, and machine-readable list output support terminal use and scripts.

No constitution violations require an exception.

## Project Structure

### Documentation (this feature)

```text
specs/008-cli-diagram-export/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── cli-contract.md
```

### Source Code (repository root)

```text
cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts                 # Parse arguments, dispatch commands, and set process result
│   ├── api-client.ts           # Configured read-only HTTP calls and shared schema parsing
│   ├── diagrams-command.ts     # List, local name filtering, and table/JSON output
│   ├── export-command.ts       # Read saved snapshot, build package, create ZIP, and write output
│   └── output.ts               # Human-readable and diagnostic formatting
└── tests/
    ├── api-client.test.ts
    ├── commands.test.ts
    └── export.test.ts

shared/src/
├── validation/schemas.ts       # Existing response schemas and domain types
└── export/html-package.ts      # Existing validated HTML/SVG/ADR package builder

backend/src/api/
├── diagram-routes.ts           # Existing list and saved-document GET routes
└── adr-routes.ts               # Existing full ADR GET route

package.json                    # Add CLI build and run scripts
tsconfig.json                   # Add CLI project reference
vitest.config.ts                # Existing root Vitest discovery
```

**Structure Decision**: Add `cli/` as a fourth sibling TypeScript project consistent with `shared/`, `backend/`, and `frontend/`. It references `shared/`, is included in the root build ordering after shared, and is run from the repository root with `npm run cli -- ...`. Tests live beside the project and are collected by the root Vitest configuration. The CLI calls existing backend GET routes; backend routes, database schema, and export package format remain unchanged.

## Constitution Check After Design

- **Stable identity and references — PASS.** Diagram selection, artifact validation, and package navigation remain UUID-based; display-name duplicates cannot redirect an export.
- **Complete ADR representation — PASS.** The full ADR read route supplies unlinked ADRs and all lifecycle states; shared export code validates links and replacement references.
- **Safe read-only export — PASS.** No service mutations are sent. Schema/package validation completes before writing, destination creation is exclusive, and a failed write is reported and cleaned up when possible.
- **Artifact-boundary verification — PASS.** Planned Vitest checks cover list schema/filter behavior, API failures, the full package manifest and references, unsupported content, output collisions, and failed writes.
- **Small and accessible workflow — PASS.** The CLI adds no new third-party runtime dependency or service. Help, readable output, stderr diagnostics, and JSON list output cover interactive and scripted use.

No design gate violations remain.

## Complexity Tracking

No constitution exceptions are required. The one new `cli/` project is the smallest boundary that keeps a reusable terminal entry point separate from browser and server execution while sharing domain validation and package generation.
