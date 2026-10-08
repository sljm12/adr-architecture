# Export Contract: Component Diagrams

**Spec**: [../spec.md](../spec.md) | **Existing package**: [../../007-export-interactive-html/contracts/package-format.md](../../007-export-interactive-html/contracts/package-format.md)

## Selected-only formats

Mermaid, standalone SVG and existing selected-only HTML builders/CLI consume validated selected documents and their required local ADRs. Preserve container/Software System scope, boundary, internal Component and supporting roles, metadata, direction/protocol and source subtype.

SVG preserves fitted geometry and complete vector content. Mermaid retains existing escaped flowchart/subgraph semantics and stable generated IDs; it does not promise exact canvas coordinates. Unsupported content fails with diagram/artifact/field/remedy. Empty Component HTML/SVG show boundary/empty states. Empty Component Mermaid follows Container format limitations with EMPTY_COMPONENT_MERMAID and remedy to add a Component or use HTML/SVG, without dummy nodes.

CLI remains selected-only saved data with unchanged overwrite/exit conventions; shared validation/list labels recognize Component kind and scope. No recursive CLI default/flag is introduced.

## Browser interactive membership

| Entry | Required package members | Context-only reads |
| --- | --- | --- |
| Context | Entry and all active Container/Component descendants | Source resolution in root graph |
| Container | Entry and active Component children | Owning Context |
| Component | Entry alone | Parent Container and Context |

Gather expected membership and documents/ADRs under root-first coordination. Validate every required member; missing/failed active children abort the entire export. Trashed children are intentional exclusions. Reject duplicate ownership, cycles/wrong levels, invalid sources/endpoints and ADR/replacement references. Context-only ancestors are not bundled or navigable.

Source DTO retains entry/member/capture fields, adds Component availability and per-diagram sourceContexts, replacing depth-one containerContext. Batch ancestor/source hydration and detach before rendering/compression.

## Captured drafts

Freeze only drafts the session actually retains into existing UUID-keyed overrides. Apply included members ancestor-first regardless of transport/output order. Captured owner/source names determine descendant metadata; omitted ancestors use context snapshots. Reject identity/kind/parent/owner changes, invented membership or deletion of a required source/owner. Never silently shrink saved membership, invent discarded drafts, save, reset drafts or alter history.

## Paths and navigation

Keep existing paths and no new version field:

```text
index.html
diagram.svg
adrs.html
styles.css
diagrams/<included-nonentry-diagram-uuid>/index.html
diagrams/<included-nonentry-diagram-uuid>/diagram.svg
adrs/<adr-uuid>.md
```

Root represents selected entry even for Container/Component. Other members remain flat UUID directories, not nested by hierarchy. Preserve component-UUID/relationship-UUID/adr-UUID fragments. One page-relative registry derives every destination without names or hardcoded semantic depth.

Container member → Component member: ../COMPONENT_UUID/index.html. Component member → Container member: ../CONTAINER_UUID/index.html#component-OWNER_UUID. Component member → entry Container: ../../index.html#component-OWNER_UUID. Resolve actual UUID paths through the registry rather than literal symbolic examples.

Selection exposes only directly linked local ADRs and explicit empty states, alongside visible keyboard child actions. Source-linked containers navigate to canonical Component children only if included; Software Systems retain included canonical Container actions. Internal Components have no child action. Return selects immediate owner only if parent is included. Absent/trashed/out-of-package destinations expose no broken link or creation/restoration/live-app action.

One shared ADR catalog renders all included decisions once, including unlinked/lifecycle variants, with exact scope/backlinks. Markdown files use registered relative artifact/replacement destinations.

## Portability and failures

Keep script-free HTML, inline complete SVG, shared --component-outline/--component-fill customization, standalone default SVG styles and relative resources. Escape authored content; reject traversal, duplicate paths/IDs and unresolved destinations. Entry first, then members by UUID; metadata hydration remains ancestor-first.

Required product acceptance: current stable Chrome, Edge, Firefox and Safari, normal file:// settings, network disabled and relocated folders. Existing Chrome/Edge/Firefox/WebKit automation supports but does not substitute for Safari. Verify three-level navigation, source entry, exact ADR/backlinks, keyboard focus, recoloring/reload/relocation.

Required source failures retain HTML_EXPORT_INCOMPLETE semantics and actionable diagram/artifact/field/remedy. No successful partial ZIP. Distinguish deliberate trash/no-child exclusions from unavailable required reads; validate every file/fragment target before archiving.
