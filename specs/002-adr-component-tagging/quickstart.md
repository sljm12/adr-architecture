# Quickstart Validation: ADR Component Tagging

## Prerequisites

- Node.js and package manager installed.
- PostgreSQL running with the project schema/migrations applied.
- A diagram containing at least two components with stable UUIDs.

## Validation commands

From the repository root, install dependencies, run database migrations, then run the unit/contract
suite and browser suite using the project package scripts once the application scaffold is created:

```text
<package-manager> install
<package-manager> run db:migrate
<package-manager> run test
<package-manager> run test:e2e
```

The API contract is defined in [contracts/openapi.yaml](./contracts/openapi.yaml), and entities and
invariants are defined in [data-model.md](./data-model.md).

## Acceptance scenarios

1. Create an ADR with title, context, decision, consequences, and optional alternatives. Save, reopen,
   and confirm UUID, content, status, and timestamps remain stable.
2. Attempt to save with each required field missing. Confirm an actionable field message and no valid
   completed-save state.
3. Link an ADR to zero, one, and multiple components. Confirm names are shown, links use component UUIDs,
   and unlinking one preserves the others.
4. Rename and reposition a linked component. Reopen the ADR and confirm the same component resolves.
5. Attempt a missing/cross-diagram link. Confirm a 422-style error and no broken link.
6. Mark an ADR superseded without a replacement and confirm rejection; then provide a same-diagram
   replacement and confirm the original remains discoverable.
7. Attempt to delete a replacement target or linked component. Confirm deletion is blocked and blocking
   ADRs are identified. Remove links explicitly, retry, confirm deletion and clear feedback.
8. Simulate API unavailability during save. Confirm edits remain visible, the ADR is marked unsaved,
   and retry succeeds after the backend returns.
9. Navigate create/edit/link/status/delete flows by keyboard and verify labels, focus order, contrast,
   and success/error announcements.
