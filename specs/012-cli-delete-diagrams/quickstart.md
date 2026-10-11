# Validation Guide: CLI Diagram Deletion

Planned commands require implementation first. Use disposable data; permanent deletion is irreversible.

## Setup

Use Node.js 22, repository dependencies and a dedicated PostgreSQL database. Follow README for pending migrations 0001–0007; retain applied migrations. Then apply the planned additive migration before updated runtime:

```powershell
npm install
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/drizzle/0008_diagram_deletion_revision.sql
npm run build
npm run dev
```

DATABASE_URL belongs in the API process environment. In-memory tests do not prove durability/database race safety. ADR_DIAGRAM_API_URL defaults to http://localhost:3000.

## Automated checks

```powershell
npm test -- cli/tests backend/tests/contract shared/tests
$env:RUN_POSTGRES_TESTS = '1'
npm test -- backend/tests/persistence
npm test
npm run build
npm run test:e2e
```

Database helpers must include migration 0008 in isolated schemas. Confirm database tests run rather than skip. Reuse component-recovery-fixture and graph-transaction tests; include existing list/export/ADR/recovery/save regressions.

## Workflow fixture

Create disposable Payments Context, Container and Component hierarchy, mixed active/independently trashed branches, populated groups/relationships and all ADR statuses with replacements and both link kinds. Add unrelated Payments API, payments, duplicate names and a UUID-shaped name. Record UUIDs.

| Scenario | Action and expected result |
|---|---|
| Exact name/cancel | diagrams delete --name "Payments" --trash; decline. Correct root/active descendants preview; exit 1, no changes. |
| UUID parity | Replace --name with --id <uuid>; same affected set. |
| Trash/recovery | Confirm Trash; restore through existing application. UUIDs/content/references retained; earlier Trash batch unchanged. |
| Permanent | --id <uuid> --permanent from active and trashed roots. Confirm warning; entire selected subtree absent from active/Trash, unrelated data intact. |
| Scripts | --yes still previews; redirected input without --yes fails promptly. |
| Duplicate/near names | Duplicates show candidates and fail; partial/case/whitespace variants never select a root accidentally. |
| Invalid usage | Missing/conflicting modes/selectors, repeated options or malformed UUID exit 2; no mutation request. |
| Child root | Only subtree removed; ancestors/siblings/owner component preserved. |
| Saved changes | Pause at prompt and edit/save content or ADR. Confirm → stale rejection and fresh preview required. |
| Inherited name | Rename parent owner after child preview → stale rejection and new resolved name. |
| Response loss | HTTP fixture suppresses response after commit → uncertainty diagnostic, no automatic retry. |

Prefix actions with npm run cli --. Scripted stale tests need an HTTP barrier between preview and execution. Include edit/revert under frozen clock and ADR/link-only edits; counters must invalidate old previews.

## Persistence and concurrency proof

- Exercise strict request/response schemas and root/mode/token mismatch through [OpenAPI](contracts/openapi.json).
- Verify raw residual counts in every normalized artifact table, internal replacements and trash-root references, plus unrelated preservation and external blockers.
- Inject failure after descendant AND root removal; memory and PostgreSQL restore documents, ADR/indexes, provenance and revisions.
- Two database connections: writer before delete locks → stale rejection; writer queued behind deletion → missing/inactive failure with no UUID resurrection. Cover save, create-child, ADR links, Trash/restore and ancestor rename.
- Migration preserves original identities/timestamps/artifacts; counters default zero and increase on supported writes; failures roll back increments.
- Keep deleted diagram open in browser: stale save fails clearly while preserving local draft; never recreates removed UUID.
- Measure p95 fixture budget from plan.md; record actual database/network environment. SC-005 needs representative first-time-user validation, not just automated checks.

See [CLI contract](contracts/cli.md) and [data model](data-model.md) for authoritative fields and behavior.
