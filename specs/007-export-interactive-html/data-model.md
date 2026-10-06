# Data Model: Parent and Container HTML Package Export

**Updated**: 2026-10-06. New entities are transient; existing persisted artifacts remain unchanged.

## Existing persisted artifacts

Reuse DiagramDocument, ContainerScope, components, relationships, groups and full ADRs with stable UUIDs. Kind remains general/container; legacy omitted kinds normalize as general. Software Systems reserve one active/recoverable child each. Scope identifies canonical parent and owner; external occurrences retain local IDs and sourceComponentId. Keep Application/Datastore subtype, responsibilities (description), technology, boundary, directed interactions/protocol, sizes, timestamps and local ADR links. No migration or export table. [component-layout.md](contracts/component-layout.md) documents the implemented size baseline.

## HtmlPackageCapture

| Field | Meaning and rule |
| --- | --- |
| entryDiagramId | Selected stable UUID, matching the captured active document. |
| capturedAt | One export-start timestamp, informational only. |
| overrides | ID-keyed deep clones of actually retained documents and optional AdrExportDraft values. No mutable store references. |

Current stores contribute one active diagram and at most one matching ADR draft. The input can represent additional retained overrides if a provider exists; this feature introduces no inactive cache. Saving blocks capture; valid dirty/failed-save drafts are allowed. Discarded/unrelated drafts are excluded.

## HtmlExportSource

| Field | Meaning and rule |
| --- | --- |
| entryDiagramId | Requested active diagram UUID. |
| sourceCapturedAt | Time the saved graph read completes; distinct from capture time, not a persisted revision token. |
| diagrams | Entry first, followed by active direct children ordered by UUID for a general entry. Each member has diagram: DiagramDocument and adrs: full ArchitectureDecisionRecord[]. Direct child has exactly one member. |
| availability | ContainerAvailability for every saved parent Software System for a general entry. Active entries match included children exactly; none/trashed are exclusions. Empty for direct child. |
| containerContext | Null for general entry; consistent scope and eligible source summaries for direct child, including sources usable in unsaved external additions. Context does not include a parent page. |

Discovery is parent-scoped and transaction-coordinated. Preserve the raw expected active child IDs before loading; absence is an error. Never treat silently filtered loads as completeness. Every member is active, structurally valid and has its full saved ADR set. No summary-only records or partial-success response.

## HtmlPackageSnapshot

| Field | Meaning and rule |
| --- | --- |
| entryDiagramId, capturedAt | Taken from immutable capture. |
| diagrams | Validated per-diagram HtmlExportSnapshot members after frozen overlays/source resolution, all sharing capture time. |
| ownerChildren | Map from canonical parent Software System UUID to included child UUID only. |
| availability | Saved statuses reconciled with captured parent; unsaved new owners have none. Required active owners cannot disappear silently. |

Assembly:

1. Parse source; verify entry, active membership and canonical associations.
2. Apply clones only to included IDs. Excluded stale overrides cannot add diagrams. Reject kind/parent/owner identity changes.
3. Resolve bundled child title/scope and external display metadata from the overlaid parent by UUID, preserving occurrence IDs, geometry, local relationships, subtype and links. Direct child resolves through matching containerContext.
4. Validate diagrams and merge optional ADR drafts per diagram. Existing ADR IDs/creation dates remain; new drafts get one package-local UUID used in all outputs, without modifying editor state. Validate the final merged ADR sets.
5. Check aggregate completeness/ownership, identity uniqueness and all output destinations.

Validate persisted ADR links against their saved diagrams and final merged links against the overlaid diagrams. Do not reject an old saved link against the new draft document before a captured ADR draft has removed that link. Refactor shared merge/validation helpers as needed while preserving the legacy single-diagram API.

## Integrity rules

- Exactly one entry. General bundles include all expected active direct children once, no trashed/unrelated diagrams; direct child includes only itself. No recursive discovery.
- Diagram IDs and each artifact-type UUID set are unique across included diagrams. ADR duplicates fail rather than overwrite catalog/Markdown. Artifact diagramId matches its member.
- Each child matches scope parent/owner IDs and an eligible ordinary parent Software System. Required owners removed/reclassified in a draft fail the package.
- External occurrences resolve eligible parent Person/Software System sources, excluding the child owner. Local identities/links remain distinct; duplicate source occurrences or invalid placement fail existing invariants.
- Endpoints and ADR artifact links stay within their owning diagram. Occurrence selection never inherits source ADRs; relationships never inherit endpoint ADRs.
- All lifecycle fields remain. Replacement ADRs resolve to a different eligible ADR in the same diagram, not just somewhere in the catalog.
- Preserve every required container label, subtype, technology, responsibility, boundary, direction and protocol. Existing content, geometry and escaping validation applies to all members.
- Missing context/source metadata is never inferred. Later edits cannot overwrite captured state during rendering.

## PackageLinkContext and ExportPackage

One registry maps diagram UUIDs to HTML/SVG paths, ADR UUIDs to catalog/Markdown paths and local artifact UUIDs to anchors. Entry paths are index.html/diagram.svg; children use diagrams/<diagram-uuid>/index.html and diagram.svg; adrs.html/styles.css/adrs/<adr-uuid>.md remain shared at root. A helper computes relative destinations from the originating file; authored names are display text only.

SVG selection links stay local. ADR backlinks include the owning page. Parent return targets the owning system anchor. External-system child actions use the source-to-included-child map without changing membership. Files are safe unique relative paths, and every generated local link/fragment resolves. [package-format.md](contracts/package-format.md) defines exact paths.

## State transitions and errors

The browser clarification changes no domain identity, capture field, source response or persisted schema. Browser compatibility is validated on the generated package, using the evidence record below.

Read-only: idle -> capturing -> gathering source -> resolving drafts/sources -> validating -> rendering -> archiving -> downloaded; any stage may fail. One operation at a time. Store history/navigation/save indicators, database rows/timestamps and trash state remain unchanged. Graph locks end after source gathering.

Failures contain diagramId, artifact kind, artifactId where known, field and remedy. Missing loads identify the expected child UUID. No partial map/catalog or successful ZIP follows a required-member failure. Retry captures fresh state. This is not an import format, revision system or retained-draft lifecycle.

## Browser validation evidence

Record one acceptance result for each actual stable Chrome, Edge, Firefox and Safari distribution. Each result identifies browser name, distribution/channel, exact version, operating system/version, validation date, tested package/fixture identity, normal settings, disabled-network/file-URL conditions, per-journey outcomes and evidence location. Status is pending, passed or failed; only completed required journeys may pass. Engine regression results identify the engine/build explicitly and cannot replace required product-browser rows. Evidence lives in validation reports, not application storage, API responses or the ZIP snapshot. See [quickstart.md](quickstart.md) for the matrix.
