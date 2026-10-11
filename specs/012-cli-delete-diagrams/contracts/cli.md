# CLI Contract: Diagram Deletion

## Syntax

```text
npm run cli -- diagrams delete (--id <uuid> | --name <exact-name>) (--trash | --permanent) [--yes]
```

One selector and one mode required. Reject positional roots, extra roots, repeated options, --format and --output for delete. Existing list/export behavior remains unchanged. Name strings retain shell-quoted spaces.

```text
npm run cli -- diagrams delete --name "Payments" --trash
npm run cli -- diagrams delete --id 00000000-0000-4000-8000-000000000001 --permanent
npm run cli -- diagrams delete --name "Payments" --permanent --yes
```

These commands are destructive once implemented; use disposable fixtures.

## Preview

Backend preview resolves exact saved names, case/whitespace sensitive, without partial/wildcard matching. Trash searches active; permanent searches active and Trash. UUID-looking names are literal under --name. Duplicate names fail with candidate UUID/name/status rows.

Print mode, root name/UUID, every affected name/UUID/status and explanation that contained artifacts and ADRs are included. Explain recovery for Trash, prior batch preservation, and irreversible removal including trashed descendants for permanent mode. Escape terminal control characters in displayed names without changing selector strings. Never output tokens or full ADR contents.

## Confirmation

- Prompt: Continue? Type yes to confirm:; only trimmed case-insensitive yes grants consent.
- Other answers, EOF and interruption cancel.
- Without --yes, non-TTY input fails promptly rather than reading piped consent.
- --yes grants explicit consent to the resolved preview, which is still printed before execution.
- Execute uses preview UUID/mode/token once. No name re-resolution or automatic retries/refresh.
- Any affected saved change, including ADR-only edit or edit/revert, rejects stale confirmation in both modes and scripted execution; require fresh invocation/preview/consent.
- Committed result identifies mode/root/name/UUID and every affected identity.

## Streams and statuses

| Outcome | Exit | Output |
|---|---|---|
| Commit | 0 | Preview and committed summary on stdout. |
| Cancellation, absent scripted consent, no match, ambiguity, stale/blocked state, service/transport failure | 1 | Actionable stderr diagnostic; no success claim. |
| Invalid syntax/options/selector/UUID/mode | 2 | Usage/help instruction on stderr; no mutation request. |

Prompt and warnings may use stderr. Execution response loss may mean a commit occurred: advise verifying active/Trash state in the application before retrying, never imply rollback solely from transport failure. Validate response root/mode and shared schemas before claiming success.

Use existing ADR_DIAGRAM_API_URL (default http://localhost:3000). No new configuration, accounts, output files, dry-run or JSON flags.
