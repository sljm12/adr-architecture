# Quickstart: Manage Diagram List

This guide validates the feature at shared, API, frontend, and browser boundaries. It assumes the
repository dependencies are installed and the project is checked out on branch
`feature/004-manage-diagram-list-phase-5-6` (or the feature branch under test).

## Prerequisites

- Node.js current LTS and npm are available.
- The repository dependencies are installed with `npm install`.
- For live browser validation, the existing API/database environment is configured as described in
  the repository README and `docker.md`.

## Automated validation

Run the focused unit and integration coverage after implementation:

```bash
npm test -- shared/tests/validation.test.ts frontend/tests/saved-diagram-list.test.tsx frontend/tests/saved-diagram-store.test.ts frontend/tests/accessibility.test.tsx backend/tests/diagrams.test.ts backend/tests/recovery.test.ts
```

Expected result: summary validation accepts `createdAt`; list derivation and panel states cover
name/date filtering, inclusive boundaries, sorting, duplicate names, clear/reset, confirmation,
delete failure, refresh races, and stable UUID behavior; API/repository tests cover
active-to-trashed and restore preservation.

Run the production type/build checks:

```bash
npm run build
```

Expected result: shared, backend, and frontend builds complete without type errors.

Run the feature browser workflow with the repository’s configured Playwright server:

```bash
npm run test:e2e -- e2e/tests/diagram-list-management.spec.ts
```

Expected result: the browser tests prove the following independent journeys:

1. The panel displays creation dates and filters by trimmed case-insensitive name, start date,
   end date, and combined criteria; invalid ranges and no-match/empty states are readable.
2. The panel sorts by name and creation date in both directions, keeps deterministic ties, and
   opens the selected UUID even when names duplicate.
3. Delete opens a named confirmation, cancel leaves the diagram unchanged, success removes only the
   target from the active list, failure leaves it visible, and restore returns the original
   contents and creation date.
4. Deleting the current diagram requires resolving unsaved diagram/ADR changes, and keyboard-only
   users can operate filters, sorting, opening, confirmation, cancellation, and deletion with
   visible focus and status feedback.

## Manual spot check

1. Create at least four diagrams with distinct names and creation dates; edit one after creation.
2. Open the diagrams panel and verify that the edited diagram’s creation date does not change to its
   last-saved date.
3. Enter a partial name, set one or both date boundaries, and verify the results are the intersection
   of all active filters. Clear the filters and verify the full active list returns.
4. Change each sort field and direction; confirm duplicate names remain separate and selectable.
5. Delete one diagram, cancel one confirmation, and confirm one deletion. Verify the confirmed item
   leaves the active list and appears in the existing trash/recovery workflow.
6. With unsaved changes in the current diagram, attempt deletion and verify save/discard/cancel
   choices protect the draft.

## Validation record

Validated on 2026-09-18 from `feature/004-manage-diagram-list-phase-5-6`:

- `npm.cmd test`: 181 passed, 1 skipped.
- `npm.cmd run build`: shared, backend, and frontend builds completed successfully.
- `npm.cmd run test:e2e -- e2e/tests/diagram-list-management.spec.ts`: 9 passed.
