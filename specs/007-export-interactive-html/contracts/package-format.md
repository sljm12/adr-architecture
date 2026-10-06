# Portable ZIP Package Contract

**Updated**: 2026-10-06. Extends the browser System context workflow; compatible single-diagram builders and CLI keep their existing scope.

## File manifest

```text
index.html
adrs.html
diagram.svg
styles.css
diagrams/<child-diagram-uuid>/index.html
diagrams/<child-diagram-uuid>/diagram.svg
adrs/<adr-uuid>.md
```

Root HTML/SVG represent the selected entry. Child pairs exist for every included active direct child and no others. ADR Markdown exists once per ADR across all included diagrams. No-child contexts, direct-child exports and legacy single builders retain the root paths without a diagrams directory. One root ADR catalog and stylesheet serve all pages. The extracted directory is moved as a unit; no external network assets or runtime are needed.

ZIP download name may use a sanitized entry name, but internal paths contain fixed segments and validated UUIDs only. Duplicate UUIDs/paths, absolute paths and path traversal fail before archiving. This is a read-only review snapshot, not an import/reconstruction format. Order entry first and children by UUID; preserve ADR ordering deterministically within diagram scope.

## Relative path registry

| Origin | Destination | Generated link |
| --- | --- | --- |
| Root index | Included child | diagrams/<child-uuid>/index.html |
| Child index | Shared ADR | ../../adrs.html#adr-<adr-uuid> |
| Child index | Stylesheet | ../../styles.css |
| Child index | Parent owner | ../../index.html#component-<owner-uuid> |
| Child index | Included source-system child | ../<source-child-uuid>/index.html |
| ADR catalog | Root artifact | index.html#component-<uuid> or #relationship-<uuid> |
| ADR catalog | Child artifact | diagrams/<child-uuid>/index.html#component-<uuid> or #relationship-<uuid> |
| ADR Markdown | Root artifact | ../index.html#component-<uuid> or #relationship-<uuid> |
| ADR Markdown | Child artifact | ../diagrams/<child-uuid>/index.html#component-<uuid> or #relationship-<uuid> |
| ADR Markdown | Replacement ADR | ../adrs.html#adr-<replacement-uuid> |

Each artifact alternative above has its own full destination path, followed by the corresponding fragment. Implement links through one page-relative registry, not string substitutions or name matching. Every file/fragment reference must resolve to exactly one generated target.

## HTML selection and navigation

- Each diagram page embeds its own SVG inline. Component/relationship SVG links and text-index links select local #component-<uuid> or #relationship-<uuid> detail sections.
- Details list only directly linked ADRs, once each, with title/status and explicit No ADRs linked state. Global catalog links use the origin-aware destination.
- Root system details offer Open container diagram only for a validated included child. Selection continues to expose parent-system ADRs. Bundled child headings show container level and captured owner name; Return to System context locates the parent owner.
- External Software System occurrence details retain local ADR links and expose navigation to the source's child only if already included. Person/unclassified/internal containers have no child action.
- None/trashed-child systems explain that no active container is included. Direct-child packages show owner/scope but offer no parent/sibling link. No generated page creates/restores diagrams or opens live application routes.
- adrs.html lists and renders every included ADR exactly once, including unlinked and all lifecycle states, with diagram name/ID and level. Full views preserve dates, fields and replacement references. Artifact backlinks open the owning page and exact artifact.
- Static links, CSS target detail sections and text indexes remain script-free. Default/empty selection states and visible keyboard focus work in each page.

## SVG and stylesheet

Root and child standalone SVGs have explicit view boxes and complete vector content matching their corresponding inline views. Preserve labels, groups, container boundary, subtype, responsibility, technology, source-derived external details, interaction descriptions/protocols, direction and layout. Standalone files embed default styles for independent editor use; HTML inline diagrams use the common stylesheet.

styles.css documents --component-outline and --component-fill settings. Both apply across all included HTML diagrams without changing identities, hit targets, structure or ADR/child links. Defaults follow DESIGN.md. Standalone SVG editor users can restyle separately; interactive page navigation is an HTML package guarantee.

## Markdown ADR files

Every adrs/<uuid>.md includes title, stable ADR ID, owning diagram name/ID/level, status, dates, optional replacement, context, decision, consequences, alternatives/constraints and exact local artifact references with names and IDs. Artifact links include the owning diagram path. Empty links are explicit. Escape authored syntax/markup and preserve line breaks. Repeated titles never collide or merge.

## Failure and compatibility

The same extracted package must satisfy FR-025/SC-012 in current stable desktop Chrome, Edge, Firefox and Safari with normal settings and network access disabled. Verify complete root/child rendering, local artifact selection, ADR catalog and backlinks, parent return, external-source child actions, keyboard access, shared CSS recoloring/reload and directory relocation. Do not require an HTTP server, loosen browser security settings or substitute engine-only results for required product-browser acceptance. Exact browser versions and operating systems belong in validation evidence, not package metadata.

All required documents, owners, external sources, endpoints, ADR/replacement links, visual fields, output paths and destinations pass validation before ZIP generation. No partial child omission or successful incomplete package. Failure identifies diagram, artifact, field and remedy.

Trashed/no-child states are deliberate exclusions, distinct from failed required loads. Valid empty children include their boundary and empty states. Preserve existing single-diagram paths and interactions, component geometry compatibility and separate Mermaid/SVG/CLI scope. See [export-source.md](export-source.md) and [ui-contract.md](ui-contract.md).
