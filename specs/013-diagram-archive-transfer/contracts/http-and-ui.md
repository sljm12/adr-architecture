# Archive HTTP and UI Contract

The API is described by [openapi.json](openapi.json); file fields by [archive.schema.json](archive.schema.json). Paths are API paths; browser requests use the existing `/api` proxy prefix.

## File boundary

- `.adr.json`, UTF-8 without BOM, maximum 8,388,608 bytes. No compression or embedded executable content. Serve downloads from a Blob as JSON; never inject file strings as HTML.
- Reject invalid UTF-8, NUL/unpaired-surrogate text, duplicate JSON object keys (including escaped spellings of the same key), malformed JSON, unknown fields, unsupported versions, duplicate record identities, and nesting beyond 64 levels. A bounded lexical check plus native JSON parsing is sufficient; do not add a second general parser dependency. Cover escaped quotes, nested arrays/objects, and repeated values so valid files are not misidentified as duplicate keys.
- Browser checks byte size before reading and uses fatal UTF-8 decoding that preserves a BOM for rejection. Server checks `Buffer.byteLength(archiveText, 'utf8')` before archive parsing. The JSON HTTP envelope has its own strict schema and 24 MiB request-body limit.
- Export record identities/manifest sort deterministically; strings and original timestamps remain unchanged. Hash the exact UTF-8 `archiveText`, including whitespace and order, for review. Use safe UUID-based download names: `diagram-<selectedDiagramId>.adr.json` and `recovery-<selectedDiagramId>.adr.json`.
- The JSON Schema captures structural rules; shared runtime schemas and semantic checks enforce primitive ranges, graph integrity, ownership, closure and destination union rules. Neither the file schema nor OpenAPI alone proves these properties.

## POST /diagrams/{diagramId}/archive

No body. Invalid UUID returns 400, absent diagram 404. Active and trashed diagrams are eligible. Capture all required raw data in one read-only repeatable-read transaction; validate and encode once. Return `PreparedArchive`: exact text, SHA-256, byte length, included diagram summaries with inclusion reason, and all eight record counts. Use `Cache-Control: no-store`.

The browser displays this scope and asks for download approval. Approval downloads the already returned string; it must not issue a second export that could capture different data. Cancel discards the prepared text. Saved-only warning offers save/retry, explicit continuation with saved data, and cancel when relevant diagram/ADR drafts exist.

## POST /diagram-archives/preview

Strict JSON request `{ "archiveText": "<exact selected file text>" }`.

Return file SHA-256, server `previewedAt`, opaque `previewToken`, included diagrams, complete record-level `changes`, totals and per-collection delta counts, `requiresOverride`, `requiresRecovery`, and nullable `recovery` prepared archive. Each change identifies the collection, single UUID or endpoint pair, owning diagram, available name, action (`added`, `replaced`, `removed`, `unchanged`), and whether incoming identity already exists.

`requiresOverride` is true for any incoming existing identity, including an exact reimport. `requiresRecovery` is true when any pre-existing diagram's owned snapshot changes, even through additions alone. No-change exact reimports require override confirmation but do not require backup or alter any rows/epochs. New-only imports have neither requirement but still require the explicit Import action after preview.

Generate recovery only from prior existing changed diagrams and their required hierarchies. Use `previewedAt` as recovery `exportedAt` so commit can rebuild identical bytes; bind its SHA-256 in the token. A recovery file over 8 MiB blocks the preview with `ARCHIVE_TOO_LARGE` rather than allowing replacement without recovery. Dependency/ownership failures return no actionable commit token.

## POST /diagram-archives/import

Required strict JSON fields:

| Field | Rule |
| --- | --- |
| `archiveText` | Exact reviewed file text. |
| `previewedAt` | Exact preview time returned by the server. |
| `previewToken` | Exact opaque preview fingerprint. |
| `overrideExisting` | True iff the preview requires override and the author explicitly agreed. Otherwise false. |
| `recoverySaved` | True iff recovery was required and the author acknowledged saving the returned recovery file. Otherwise false. |
| `recoveryFileSha256` | Exact reviewed recovery file digest when required; otherwise null. |

Reconstruct file digest, collision set, scope, raw destination rows/absence, retained dependencies, revisions, local epochs, delta, and recovery bytes inside collection coordination. Recompute the token using the supplied preview time, never the current time. Reject mismatches with `ARCHIVE_PREVIEW_CHANGED` before mutation; do not silently refresh a token or retry commit. This token is a consistency guard, not an authentication mechanism.

After atomic commit, return the file digest, affected diagram IDs, included summaries and committed total/per-collection counts, with `committed: true`. `affectedDiagramIds` contains changed or added diagrams only and can be empty on exact reimport. No bytes of archive contents are echoed in success diagnostics.

## Error boundary

All feature errors use `{code, message, remedy, issues?}`; issues contain field path and optional diagram/artifact identities without echoing sensitive text values or SQL. Normalize parser-level failures in an archive-only encapsulated Fastify error handler as well as handler failures. Do not globally enlarge body limits or change existing validators.

| HTTP status | Codes / meaning |
| --- | --- |
| 400 | `ARCHIVE_REQUEST_INVALID`, `ARCHIVE_JSON_INVALID`: malformed envelope, JSON, duplicate keys, or UUID selector. |
| 404 | `ARCHIVE_NOT_FOUND`: selected saved diagram absent. |
| 409 | `ARCHIVE_PREVIEW_CHANGED`, `ARCHIVE_DEPENDENCY`, `ARCHIVE_OWNERSHIP`, `ARCHIVE_CONFIRMATION_REQUIRED`: fresh review or explicit choice needed. |
| 413 | `ARCHIVE_TOO_LARGE`: HTTP request, selected file, generated export, or recovery file exceeds its boundary. |
| 415 | `ARCHIVE_MEDIA_TYPE`: unsupported request media type. |
| 422 | `ARCHIVE_VERSION_UNSUPPORTED`, `ARCHIVE_INVALID`: invalid stored/file values, missing/unknown fields, manifest or graph violations. |
| 500 | `ARCHIVE_FAILED`: rolled-back operation or export preparation failed; no success claim. |

An interrupted import response has an uncertain outcome. Display instructions to inspect saved data before retrying. A known commit followed by failed list/view refresh remains "Import succeeded; refresh failed" and offers refresh only.

## Existing Trash/restore confirmation compatibility

Extend `TrashImpact` and `RestoreImpact` with `impactToken`, computed under current graph coordination from the existing reviewed scope plus raw relevant data/revisions/local epochs. Extend Trash confirmation `{confirmedDiagramIds, impactToken?}` and Restore confirmation `{confirmedDiagramIds, confirmedTrashBatchId, impactToken?}`. Tokens supplied by new clients must always match. Missing tokens are accepted only for scopes whose relevant local epochs are all zero; otherwise return `TRASH_IMPACT_CHANGED` or `RESTORE_IMPACT_CHANGED` with a fresh-preview remedy. Body-less legacy single-diagram mutations obey that same epoch rule.

Update shared types/strict schemas, both recovery UI paths, clients, services, memory fixtures and OpenAPI descriptions together. Include epochs in existing single and collection deletion fingerprints without changing those request/response shapes. Earlier legacy confirmation from before an import must never pass on restored IDs/batch values. Do not remove epoch tombstones on any permanent purge.

## UI state and accessibility

- Import is available in an empty saved-diagram list. Export archive is available on active and Trash rows, in addition to the current workspace action.
- One `DiagramArchiveTransfer` coordinator owns the selected file/prepared snapshot, request sequence, busy state, preview, recovery download/acknowledgement, and commit outcome. One dedicated review dialog displays scope, full scrollable impact, accessible names/UUIDs/status, and explicit removal counts.
- Reuse `DESIGN.md` typography, spacing, Action Blue, `primary-pill`, `secondary-action`, destructive-action styling, and existing dialog focus trap/restore. Cancel is safe by default; Escape and dismissal cancel before submission. Announce busy/results/errors and permit keyboard-only review and download.
- Serialize with current save/recovery actions. Inspect all retained affected diagram and ADR drafts; save/discard/cancel explicitly before commit. If saving changes saved state, discard the old review and request a new one. Preserve unrelated drafts. Keep the selected exact file text unchanged throughout one review.
- Required recovery download exposes the actual returned file; a separate unchecked acknowledgement enables override. Explain that recovery keeps newly added diagrams and may be blocked by their dependencies. Do not claim a browser download proves the file was saved durably.
- After successful commit clear affected diagram/ADR retained drafts, undo history and cached documents; refresh affected current views and both lists. New IDs are available normally. Preserve unrelated cached drafts; prevent stale in-flight results from repopulating replaced caches. A refresh failure does not resubmit import.
