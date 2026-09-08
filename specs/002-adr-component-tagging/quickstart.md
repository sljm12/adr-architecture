# Quickstart Validation: ADR Component and Relationship Tagging

## Prerequisites

- Node.js and npm installed.
- Dependencies installed with `npm install`.
- PostgreSQL available and `DATABASE_URL` configured when running persistence tests.
- A diagram containing at least two components and one relationship with stable UUIDs.

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
3. Link an ADR to zero, one, and multiple components and/or relationships. Verify component names
   and distinguishable relationship references are shown, links use stable UUIDs, and unlinking one
   preserves the remaining links of both types.
4. Rename/reposition a linked component and edit a linked relationship's label or visual properties.
   Reopen the ADR and verify the same artifacts resolve.
5. View a component and a relationship with linked ADRs. Verify every linked ADR appears with its
   title and current status, and activate each summary to open the corresponding ADR without
   searching.
6. View a component and a relationship with no linked ADRs. Verify each view shows a clear
   no-linked-ADRs state that is distinct from an error or unavailable-data state.
7. Attempt missing-artifact and cross-diagram links for both components and relationships. Verify a
   422-style actionable error and no broken link.
8. Attempt to delete a linked relationship, then delete a component whose dependent relationship is
   linked. Verify each deletion is blocked until affected ADR links are repaired or explicitly
   removed, and blocking ADR IDs/titles are identified.
9. Mark an ADR superseded without a replacement; verify rejection. Select a same-diagram replacement;
   verify the original remains discoverable with its replacement reference.
10. Attempt to delete a replacement target and an ADR with both link types. Verify replacement
   deletion is blocked, ADR deletion requires confirmation, and success/failure feedback
   is visible.
11. Simulate API unavailability during save. Verify edits remain visible, the ADR is marked unsaved/
   failed, and retry succeeds after the backend returns.
12. Navigate create, edit, link, status, component-summary, relationship-summary, save, retry, and
   delete flows by keyboard; verify labels, focus order, 44px targets, contrast, and accessible
   status announcements.
