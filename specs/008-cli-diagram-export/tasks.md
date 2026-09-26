---

description: "Dependency-ordered implementation tasks for CLI Diagram Export"

---

# Tasks: CLI Diagram Export

**Input**: Design documents from `specs/008-cli-diagram-export/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/cli-contract.md](contracts/cli-contract.md), [quickstart.md](quickstart.md)

**Tests**: Automated tests are included because the project constitution requires coverage at artifact, reference, validation, and export boundaries.

**Organization**: Tasks are grouped by the three user stories from `spec.md`. Shared CLI setup and the read-only API client are foundational prerequisites.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other ready tasks that touch different files and have no unfinished dependencies.
- **[Story]**: Maps a story-phase task to its user story, such as `[US1]`.
- Every task includes exact repository file paths.

## Phase 1: Setup

**Purpose**: Add the CLI project to the existing TypeScript build and local run workflow.

- [ ] T001 Create the strict ESM CLI project config and root build/run references in `cli/package.json`, `cli/tsconfig.json`, `package.json`, and `tsconfig.json`.

---

## Phase 2: Foundational

**Purpose**: Establish and verify the shared, read-only service boundary required by list and export.

**Checkpoint**: Both story implementations can use one validated API client configured for the existing service.

- [ ] T002 Add API-client contract tests for configured URLs, list/document/full-ADR GET requests, HTTP and network failures, and invalid payloads in `cli/tests/api-client.test.ts`.
- [ ] T003 Implement `ADR_DIAGRAM_API_URL` configuration, read-only GET requests, error handling, and shared-schema validation in `cli/src/api-client.ts`.

---

## Phase 3: User Story 1 - Find diagrams from the command line (Priority: P1) 🎯 MVP slice

**Goal**: List all active diagram summaries and filter by a case-insensitive name substring while preserving stable IDs.

**Independent Test**: With mocked active diagram summaries including duplicate names, run the list command in table and JSON formats, apply empty and matching filters, and verify all expected rows and IDs. An empty match is successful; service failure is a clear error.

### Tests for User Story 1

- [ ] T004 [P] [US1] Add list-command tests for summary fields, duplicate names, name filtering, empty results, and table/JSON output in `cli/tests/diagrams-command.test.ts`.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Implement active-summary listing, trimmed case-insensitive name filtering, empty-state behavior, and table/JSON rendering in `cli/src/diagrams-command.ts` and `cli/src/output.ts`.
- [ ] T006 [P] [US1] Wire `diagrams list` with `--name` and `--format` into the CLI dispatcher in `cli/src/main.ts`.

**Checkpoint**: `npm run cli -- diagrams list` and its filtered/JSON forms work without export functionality.

---

## Phase 4: User Story 2 - Export a diagram package (Priority: P1)

**Goal**: Export one saved active diagram by UUID to a ZIP that follows the existing package contract and does not overwrite an existing local file.

**Independent Test**: Given a known UUID and mocked persisted diagram plus full ADR responses, export and inspect the extracted package manifest and links. Verify missing IDs, invalid package content, destination collisions, and write failures report failure without changing service data or replacing an existing file.

### Tests for User Story 2

- [ ] T007 [P] [US2] Add export-command tests for persisted-state inputs, all ADR states and links, ZIP manifest/content, validation failures, missing diagrams, output collisions, failed writes, and absence of API mutation requests in `cli/tests/export-command.test.ts`.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Fetch the saved diagram and full ADR list, validate and pass them to `buildHtmlPackage`, then create the compatible ZIP with JSZip in `cli/src/export-command.ts`.
- [ ] T009 [US2] Write the generated ZIP to the requested `.zip` path using exclusive creation, report the path only after completion, and clean up an incomplete file on failure in `cli/src/export-command.ts` and wire `diagrams export <id> --output <path>` in `cli/src/main.ts`.

**Checkpoint**: A known diagram UUID can be exported as a complete offline package; invalid content and unsafe destinations fail clearly.

---

## Phase 5: User Story 3 - Learn and automate the basic workflow (Priority: P2)

**Goal**: Make list and export operations discoverable in built-in help and reliably detectable by scripts.

**Independent Test**: Run help without setup instructions, then run a successful list and a failing export. Verify help covers commands, configuration, and common errors, while scripts can distinguish successful, operational-failure, and usage-failure results.

### Tests for User Story 3

- [ ] T010 [P] [US3] Add CLI contract tests for global and command help, standard-output/standard-error behavior, and success/failure/usage exit results in `cli/tests/cli-help.test.ts`.

### Implementation for User Story 3

- [ ] T011 [P] [US3] Complete built-in help for list, filter, export, configuration, and common errors, and map successful, operational, and usage outcomes to the documented process results in `cli/src/main.ts`.
- [ ] T012 [P] [US3] Add a CLI usage section with service configuration, list/export examples, JSON output, and failure behavior to `README.md`.

**Checkpoint**: A first-time user can follow built-in help, and scripts can safely parse list output and detect operation results.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Verify the complete CLI against the package and end-to-end validation contract.

- [ ] T013 Run the root build and Vitest suite, then follow the success and failure scenarios in `specs/008-cli-diagram-export/quickstart.md` and resolve any failures in the corresponding `cli/` source or test files.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; creates the CLI project and root run/build entry points.
- **Foundational (Phase 2)**: Depends on setup and blocks both user stories by providing tested API access and schema validation.
- **User Story 1 (Phase 3)**: Starts after foundational work; its list command can be delivered and validated alone.
- **User Story 2 (Phase 4)**: Export tests and package generation can start after foundational work and proceed alongside User Story 1 because they use separate files. Adding export to the shared dispatcher depends on the list dispatcher from T006.
- **User Story 3 (Phase 5)**: Depends on both commands being wired so help and process behavior can be tested against the complete workflow.
- **Polish (Phase 6)**: Depends on all three user stories.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Setup and Foundational; no dependency on other stories.
- **User Story 2 (P1)**: Its handler and tests depend only on Setup and Foundational. Final command dispatch also depends on the `main.ts` entry point established by User Story 1.
- **User Story 3 (P2)**: Depends on User Stories 1 and 2 because its help and automation criteria describe both operations.

### Within Each User Story

- Write the story's tests before its implementation so they fail against the missing behavior.
- Keep list and export handlers in separate files; only their command registration shares `cli/src/main.ts`.
- Complete the command registration and independent test criteria before moving to the next checkpoint.

### Parallel Opportunities

- After T003, T007 can be authored while User Story 1 tasks proceed; its tests and implementation use export-specific files.
- After T007, T008 can be implemented alongside T005 and T006. T009 waits for both T008 and T006 because it writes export integration into `cli/src/main.ts`.
- T012 can be drafted in parallel with T010 and T011 because it documents the stable command contract in a separate file.
- Avoid parallel work on `cli/src/main.ts`; T006, T009, and T011 update the same dispatcher in that order.

---

## Parallel Example: User Stories 1 and 2

```text
# After T003, these tasks touch separate files and can proceed concurrently:
T004: Write list/filter/format tests in cli/tests/diagrams-command.test.ts
T007: Write ZIP export and output-safety tests in cli/tests/export-command.test.ts

# After T007, the export implementation can proceed alongside the list slice:
T005: Implement listing and output in cli/src/diagrams-command.ts and cli/src/output.ts
T008: Implement package generation in cli/src/export-command.ts

# Integrate export after the list dispatcher exists:
T009: Add export registration in cli/src/main.ts
```

## Parallel Example: User Story 3

```text
# Once both commands are wired, these tasks use separate files:
T010: Add help and exit-result tests in cli/tests/cli-help.test.ts
T012: Document the CLI commands in README.md

# Implement help and process results after the tests are defined:
T011: Update cli/src/main.ts
```

User Story 1 has no parallel pair within its own phase: its tests, list/output implementation, and dispatcher wiring are intentionally ordered. Its tests can run in parallel with the independent User Story 2 test and package-generation work shown above.

---

## Implementation Strategy

### Incremental Delivery

1. Complete Setup and Foundational work so both command handlers share one validated API boundary.
2. Deliver User Story 1 as the first independently testable slice: list and filter persisted active diagrams.
3. Deliver User Story 2 as the second P1 slice: create the existing ZIP package for a selected UUID with safe local output handling. **The complete requested MVP is User Stories 1 and 2 together.**
4. Deliver User Story 3 with built-in help, script result handling, and README examples.
5. Run the full build, tests, and quickstart checks after all stories are integrated.

### MVP Scope

The MVP includes both P1 stories: diagram discovery and ZIP export. User Story 1 alone is a useful first checkpoint but does not fulfill the requested export workflow.

---

## Notes

- `[P]` tasks use separate files and have no unfinished prerequisites; dispatcher edits remain sequential.
- `[US1]`, `[US2]`, and `[US3]` map to user stories in `spec.md`.
- Export must use saved API data and shared package validation; never substitute browser memory or drop unsupported artifacts.
