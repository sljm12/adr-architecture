# Quickstart Validation: ADR Component Tagging

## Prerequisites

- Node.js and npm installed.
- Dependencies installed with `npm install`.
- PostgreSQL available and `DATABASE_URL` configured when running persistence tests.
- A diagram containing at least two components with stable UUIDs.

## Validation commands

From the repository root:

```text
npm install
npm test
npm run build
npm run test:e2e
```

Apply `backend/drizzle/0002_adrs.sql` after `0001_initial.sql` before running PostgreSQL-backed
tests. The API contract is defined in [contracts/openapi.yaml](./contracts/openapi.yaml), and
entities/invariants are defined in [data-model.md](./data-model.md).

## Acceptance scenarios

1. Create an ADR with title, context, decision, consequences, and optional alternatives/constraints.
   Save and reopen it; verify UUID, content, status, and timestamps are preserved.
2. Omit each required field in separate save attempts; verify an actionable field message and no
   completed-save state. Omit alternatives/constraints; verify a valid save remains possible.
3. Link an ADR to zero, one, and multiple components. Verify names are shown, links use component
   UUIDs, and unlinking one preserves the remaining links.
4. Rename and reposition a linked component. Reopen the ADR and verify the same component resolves.
5. Attempt a missing-component and cross-diagram link. Verify a 422-style actionable error and no
   broken link.
6. Mark an ADR superseded without a replacement; verify rejection. Select a same-diagram replacement;
   verify the original remains discoverable with its replacement reference.
7. Attempt to delete a replacement target and a linked component. Verify deletion is blocked and
   blocking ADR IDs/titles are identified. Repair or explicitly remove links, retry, and verify clear
   success feedback.
8. Attempt to delete an ADR from the UI. Verify confirmation is required and success/failure feedback
   is visible.
9. Simulate API unavailability during save. Verify edits remain visible, the ADR is marked unsaved/
   failed, and retry succeeds after the backend returns.
10. Navigate create, edit, link, status, save, retry, and delete flows by keyboard; verify labels,
    focus order, 44px targets, contrast, and accessible status announcements.
