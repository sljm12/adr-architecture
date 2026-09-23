# Data Model: Interactive HTML Package Export

## Persisted artifact change: Component size

`Component` remains a diagram-owned UUID artifact. Add `size: { width: number; height: number }` beside its existing absolute `position`. Width and height are positive finite diagram units. The current default is 180 by 72, matching `DEFAULT_COMPONENT_SIZE`. A component resize updates the same component ID and its `updatedAt`; it is a diagram edit with undo/redo and save semantics. Group boundaries must continue to enclose member positions and sizes.

Add `width` and `height` columns to the existing `components` table with defaults of 180 and 72 for existing rows. Diagram API responses include the normalized size. Legacy diagram input or serialized documents without size normalize to the defaults before invariant checks; invalid, zero, negative, or non-finite supplied dimensions fail validation. Compatibility tests must cover old rows and old document payloads. No export table is introduced.

## Transient ExportSnapshot

| Field | Meaning | Rule |
| --- | --- | --- |
| `diagram` | Frozen `DiagramDocument` from the editor | Active diagram, unique UUIDs, valid components, relationships, groups, positions, and sizes |
| `adrs` | Every full saved ADR from the diagram plus the frozen draft overlay | Unique UUIDs, same `diagramId`, all required fields and lifecycle rules valid |
| `capturedAt` | Time of the author's export action | Informational package metadata only; does not change artifact timestamps |
| `draftOrigin` | Whether an ADR was overlaid from the editor | For a new draft, assign a package-local UUID; existing drafts retain their persisted UUID |

The snapshot is assembled only in memory and is never saved. Capture `diagram` and the ADR draft synchronously before fetching saved ADRs. Do not use `AdrSummary` as exported content. If a save is in progress, defer export with a clear message; if the last save failed, preserve and validate the draft shown to the author. An invalid unfinished draft stops the export with field feedback rather than disappearing from the package.

## Artifact relationships and integrity

- Every component, relationship, group, and ADR has a unique stable UUID within its artifact type. Relationship endpoints refer to components in the same diagram. Group members refer to same-diagram Software Systems and obey existing single-group membership rules.
- An ADR has zero or more `componentIds` and `relationshipIds`; each ID must refer to an artifact in this snapshot's diagram. Link arrays are unique. A relationship link does not imply links to its endpoint components.
- A superseded ADR must identify a replacement ADR. Any non-null `replacementAdrId` must resolve to a different ADR in the same exported set. A missing replacement fails export.
- Existing ADRs retain their saved identity when overlaid. A new unsaved ADR uses a package-local UUID consistently in HTML anchors, Markdown filename, and links; saving it later may assign a different persistent UUID because export does not mutate editor state.
- `diagramDocumentSchema`, `architectureDecisionRecordSchema`, and domain invariants validate the normalized snapshot. Export-only checks reject unsupported component types and content that cannot be represented. Errors contain artifact kind, UUID when available, field path, and a readable remedy.

## Transient ExportPackage

| Field | Meaning | Rule |
| --- | --- | --- |
| `files` | Map of relative package paths to generated UTF-8 content | Required paths and one ADR Markdown path per ADR; no duplicate or absolute paths |
| `diagramAnchors` | UUID-keyed component and relationship destinations | Each target resolves to exactly one detail section in `index.html` |
| `adrAnchors` | UUID-keyed ADR destinations | Every ADR resolves to exactly one section in `adrs.html` and one Markdown file |
| `componentColors` | CSS custom properties for outline and fill | Presentation only; no artifact identity or link change |

The ZIP is produced only after the full file map succeeds validation and rendering. Paths are fixed (`index.html`, `adrs.html`, `diagram.svg`, `styles.css`) or contain only a validated ADR UUID (`adrs/<uuid>.md`). See [package-format.md](contracts/package-format.md) for the portable file and navigation contract.

## State transitions

Export is read-only: `idle → gathering ADRs → validating → rendering → archiving → downloaded`, or any active stage `→ failed` with an actionable message. Failure produces no successful download and does not alter diagram or ADR save status. Saved, unsaved, and failed-save editor states may export if their frozen snapshot is valid. A saving state cannot start a snapshot. Existing Mermaid export retains its own saved-diagram rule.
