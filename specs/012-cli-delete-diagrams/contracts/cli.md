# CLI Contract: Diagram Deletion

## Syntax

```text
npm run cli -- diagrams delete (--id <uuid> | --name <exact-name>) (--trash | --permanent) [--all-matches] [--yes]
npm run cli -- diagrams clear-trash [--yes]
```

Delete requires one selector and one mode. --all-matches is valid only with --name and explicitly selects all eligible exact-name roots. Without it, zero/multiple matches retain safe refusal. Clear-trash accepts only --yes: reject selectors, --all-matches, mode flags and output flags. Reject positional roots, extra roots, repeated options, --format and --output. Existing list/export behavior remains unchanged. Name strings retain shell-quoted spaces.

```text
npm run cli -- diagrams delete --name "Payments" --trash
npm run cli -- diagrams delete --id 00000000-0000-4000-8000-000000000001 --permanent
npm run cli -- diagrams delete --name "Payments" --permanent --yes
npm run cli -- diagrams delete --name "Payments" --all-matches --trash
npm run cli -- diagrams delete --name "Payments" --all-matches --permanent --yes
npm run cli -- diagrams clear-trash --yes
```

These commands are destructive once implemented; use disposable fixtures.

## Preview

Backend preview resolves exact saved names, case/whitespace sensitive, without partial/wildcard matching. Trash searches active; permanent searches active and Trash. UUID-looking names are literal under --name. Without --all-matches, duplicates fail with candidate UUID/name/status rows and UUID/all-matches guidance. With it, every eligible matching root is selected, overlapping affected hierarchies are deduplicated, and disjoint Trash subtrees remain independently recoverable.

Print mode, root name/UUID, every affected name/UUID/status and explanation that contained artifacts and ADRs are included. Explain recovery for Trash, prior batch preservation, and irreversible removal including trashed descendants for permanent mode. Escape terminal control characters in displayed names without changing selector strings. Never output tokens or full ADR contents.

Collection actions use POST /diagrams/deletion-set-preview then POST /diagrams/deletion-set; ordinary single-root requests retain existing endpoints. Print action/mode, every matched root identity where applicable, every unique affected summary and total count. Clear-trash previews all trashed diagrams across all batches and warns that recovery is lost; active data is outside scope. Empty Trash prints "Trash is already empty" with count zero and exits 0 without a prompt or execution request.

## Confirmation

- Prompt: Continue? Type yes to confirm:; only trimmed case-insensitive yes grants consent.
- Other answers, EOF and interruption cancel.
- Without --yes, non-TTY input fails promptly rather than reading piped consent.
- --yes grants explicit consent to the resolved preview, which is still printed before execution.
- Execute uses preview UUID/mode/token once. No name re-resolution or automatic retries/refresh.
- Any affected saved change, including ADR-only edit or edit/revert, rejects stale confirmation in both modes and scripted execution; require fresh invocation/preview/consent.
- Committed result identifies mode/root/name/UUID and every affected identity.
- Collection execution submits the reviewed target/root IDs/token once. Re-resolving membership only compares it to the reviewed set; new or removed matches and Trash entries invalidate consent. Any affected or required saved change requires a fresh invocation, also with --yes.
- Clear-trash is always permanent; --yes confirms that resolved collection, not a different later set. No mutation request is sent for empty Trash.
- The entire invocation commits or rolls back, including disjoint roots. Active descendants or external dependencies block clearing with actionable diagnostics; references wholly within a permanently removed union are not blockers.
- Collection committed summaries include action/mode, all matched roots where applicable, each unique affected identity and total count. Validate response target, mode, root set, affected identities and count against the preview before claiming success; mismatches after execution are uncertain.

## Streams and statuses

| Outcome | Exit | Output |
|---|---|---|
| Commit | 0 | Preview and committed summary on stdout. |
| Cancellation, absent scripted consent, no match, ambiguity, stale/blocked state, service/transport failure | 1 | Actionable stderr diagnostic; no success claim. |
| Invalid syntax/options/selector/UUID/mode | 2 | Usage/help instruction on stderr; no mutation request. |

Prompt and warnings may use stderr. Execution response loss may mean a commit occurred: advise verifying active/Trash state in the application before retrying, never imply rollback solely from transport failure. Validate response root/mode and shared schemas before claiming success.

Use existing ADR_DIAGRAM_API_URL (default http://localhost:3000). No new configuration, accounts, output files, dry-run or JSON flags.
