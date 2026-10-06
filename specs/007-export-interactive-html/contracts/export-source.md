# Read-only HTML Export Source Contract

**Date**: 2026-10-06. [OpenAPI](openapi.yaml) is the wire contract; [data model](../data-model.md) defines capture and overlays.

## Endpoint and scope

`GET /diagrams/{diagramId}/export/html-source` (browser proxy: `/api/diagrams/{diagramId}/export/html-source`) gathers saved data only. General/System context returns the selected diagram and every active direct owned child, with complete ADRs per member. Direct container returns that child alone and its consistent source context, not a parent/sibling package. No request body, ZIP generation, persistence, creation, restore, or timestamp update.

Response fields: entryDiagramId, sourceCapturedAt, diagrams (entry first; children by UUID), availability, containerContext. Each diagrams member has diagram and full adrs. General availability covers every saved Software System with none/active/trashed; active IDs match included children exactly. Trashed children are excluded from content. Direct child availability is empty and context contains canonical scope plus eligible parent sources excluding its owner.

## Consistent source gathering

1. Resolve the canonical parent for locking. Within existing GraphTransaction parent-first coordination, recheck the entry status/kind/scope, then gather scoped raw child membership, included documents and complete ADR sets using the same transaction.
2. Preserve the expected active child UUIDs and fail if any required child cannot load. Do not silently filter missing documents through findChildren. Do not read the global diagram list.
3. Validate saved ownership and source structure with repository-scoped hydration helpers. Avoid nested context transactions. Read full ADRs in bounded aggregate reads, not one query/request per ADR.
4. Return the complete detached response and release locks before browser validation/rendering. Locks coordinate with existing graph mutations; the operation performs no writes and is not SQL READ ONLY mode.

Changes after source gathering do not replace response data. Later retry gathers a new source. This boundary supplies a consistent saved graph, not a persisted historical revision.

## Failure behavior

- 404: selected entry absent or inactive.
- 409: broken/mismatched scope, owner/source, or expected active child unavailable during gathering. Code HTML_EXPORT_SOURCE_INCOMPLETE; identify affected diagram and artifact with a repair/retry remedy.
- 422: invalid UUID or invalid/unsupported saved artifact content. Code HTML_EXPORT_VALIDATION_FAILED; field-specific error.
- 500: unexpected read failure; no partial 200 response. Preserve a safe user-readable message and diagram context where available.

Source error fields: message, code, diagramId, artifactKind, artifactId when known, field, remedy. A missing required child identifies its expected UUID. Local draft, aggregate and archive failures are client-side failures with equivalent diagram/field feedback, not invented HTTP responses.

## Browser assembly and compatibility

Capture editor state before GET. Overlay cloned retained overrides; source results never load into stores. Resolve bundled owner/external display details from the captured parent and validate final content. Unsaved owner deletion/reclassification or missing sources fail, rather than shrinking membership. New unsaved systems have no child without creation. Direct-child source context can resolve newly added eligible external occurrences.

Existing GET /diagrams/{diagramId}/adrs/full remains unchanged, and existing CLI/single-diagram buildHtmlPackage consumers continue to use it. Existing create/open POST, trash/restore endpoints and Mermaid/separate SVG scope remain unchanged.
