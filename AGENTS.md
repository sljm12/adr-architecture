# Agent Instructions

## Project Context

This repository contains the ADR Diagram project: a tool for creating software architecture
diagrams and recording Architecture Decision Records (ADRs) linked to diagram components.

## General Workflow

- Inspect existing files and project conventions before making changes.
- Preserve unrelated user changes in the working tree.
- Prefer small, focused changes that satisfy the requested behavior.
- Validate changes with the most relevant available checks before reporting completion.
- Keep user-facing requirements technology-agnostic unless implementation details are explicitly
  requested.

## Documentation Lookup

Use the Context7 CLI to fetch current documentation whenever a task asks about a library,
framework, SDK, API, CLI tool, or cloud service.

1. Resolve the library first:
   `npx ctx7@latest library <name> "<full question>"`
2. Fetch documentation using the selected library ID:
   `npx ctx7@latest docs <libraryId> "<full question>"`

Do not use Context7 for refactoring, standalone scripts, business-logic debugging, code review,
or general programming concepts. Do not include secrets in documentation queries. If Context7
reports quota exhaustion, tell the user and suggest authentication or an API key rather than
silently relying on stale documentation.

## Spec Kit

- Feature specifications live under `specs/`.
- Use the repository's Spec Kit skills for specification, planning, task generation, analysis,
  and implementation workflows.
- Read the applicable skill instructions before using a Spec Kit workflow.
- Keep `.specify/feature.json` pointing at the active feature directory.
- Preserve stable identifiers and reference integrity for diagrams, components, relationships, and
  ADRs.
- Specifications must include testable requirements, user scenarios, measurable success criteria,
  edge cases, assumptions, and validation checklists.

## Editing and Safety

- Use `apply_patch` for local file edits.
- Do not use destructive commands such as `git reset --hard` or `git checkout --` unless the user
  explicitly requests them.
- Before destructive operations, resolve and verify exact targets and prefer recoverable actions.
- Do not overwrite unrelated work.
- When referencing changed local files in a response, provide clickable absolute file links when
  possible.

## Quality Expectations

- Architecture artifacts must remain structured, versionable, and cross-referential.
- Destructive actions require clear confirmation and should preserve recoverability where feasible.
- User-visible workflows should provide clear success and failure feedback.
- Core workflows should support keyboard navigation, readable labels, and accessible contrast.
- Changes affecting artifact schemas, persistence, linking, rendering, import, or export should
  include appropriate validation or automated test coverage.
