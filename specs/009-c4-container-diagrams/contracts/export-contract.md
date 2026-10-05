# Export Contract: C4 Container Diagrams

**Base package**: specs/007-export-interactive-html/contracts/package-format.md

**Model**: [data-model.md](../data-model.md)

## Snapshot boundary

A container export is a single-diagram snapshot. Preserve the existing package paths and offline relative-link contract. Do not add recursively exported parents/children or links that depend on access to the live application.

Every exporter consumes a validated, resolved domain document. Owner and source participant references must resolve before export; unresolved or unsupported content fails with an artifact ID, field and corrective action. The boundary is scope metadata, not a fabricated component endpoint.

Browser HTML export retains its existing unsaved draft behavior. Capture an immutable local diagram/ADR draft snapshot, fetch container-context for the same child/source scope, overlay current owner/source display metadata, validate IDs and fields, then generate the ZIP. A failed context lookup leaves editor state untouched and produces no successful incomplete package. Local unsaved additions to the child may reference eligible parent sources returned in the context. A source lookup never saves or changes either diagram.

CLI export uses the source-resolved persisted GET document and saved ADRs through its existing client. Shared schemas must retain kind, scope, boundary, roles, containerType, technologies, protocols and source identities, rather than stripping the new fields. Preserve the child's owner-derived name and canonical parent/owner IDs in the snapshot; list grouping does not change package scope.

## Required content by format

| Content | Mermaid | SVG | HTML ZIP |
| --- | --- | --- | --- |
| Diagram level and current owning system | Title/comment and labeled system subgraph | Title/accessible description and boundary heading | Heading and scope details |
| Internal container membership | Nodes inside one system subgraph | Rectangles inside one boundary | Same SVG plus artifact details |
| Empty child | Actionable unsupported-export error | Empty labeled boundary | Diagram with empty-state details |
| Name, Application/Datastore type, responsibilities, technology | Escaped multiline node labels | Wrapped full labels, never silently omitted | SVG and textual artifact details |
| External Person/Software System | Nodes outside system subgraph | Outside boundary with current type/name | Source identity and detail sections |
| Directed interaction and optional protocol | Arrow and escaped description/protocol label | Arrow and full label | SVG and relationship details |
| IDs and source associations | Stable generated IDs and scope/source comments | Stable artifact IDs/data metadata | Stable anchors, source/scope details |
| ADR lifecycle/content/links | Existing Mermaid scope; no new ADR promises | Existing SVG scope; no new ADR promises | Existing complete ADR and local links contract |

New fields must be escaped and validated for every format, including owner name, responsibility, technology, protocol and source descriptions. Reject unsupported control characters and invalid references before creating a file. Long content wraps; SVG viewBox/layout must include the boundary, components and relationship labels. The same complete content must be available in printable/textual HTML details.

Internal subtype labels derive from validated `containerType`, independently of the underlying `type: container` abstraction and source-derived external types. An internal container with missing subtype fails export with its artifact ID and a remedy to choose Application or Datastore in the editor. The migration compatibility default is applied to persisted legacy rows before deployment; exporters never invent a category or omit an artifact. Keep general/free-form classification compatibility and the existing package paths.

Mermaid remains a semantic export and does not preserve exact canvas positions. Use the existing supported flowchart/subgraph grammar rather than adding experimental C4 rendering dependencies. Define internal nodes within the owning-system subgraph, then external nodes and all relationships after its end. Use traditional quoted labels, generated line-break separators and individually escaped user fields. See the [official flowchart syntax](https://mermaid.js.org/syntax/flowchart.html).

For an empty container diagram, Mermaid export returns EMPTY_CONTAINER_MERMAID with a message to add a container or choose SVG/HTML; the REST export returns 422 and no file is produced. This is an explicit permitted unsupported case under FR-019. Current parser acceptance of empty subgraphs does not establish rendering compatibility with downstream versions, and no dummy architecture element is inserted. Empty general diagrams retain their current behavior.

Parent/general exports remain single-diagram exports. Show a concise scope note that only the selected diagram is included and child container contents are not bundled; this does not require discovering or requesting every child. Do not add broken offline navigation to child packages. Absence of bundled child contents must never be represented as a complete multi-level export.

## Validation scenarios

- One empty child and one populated child with Application and Datastore labels, persisted containerType values, both external types, metadata and protocols.
- Subtype changed in an unsaved browser draft versus saved CLI content; missing/unsupported internal subtype rejected with a correction action; source participants retain Person/Software System labels.
- Every new label field with quotes, angle brackets, ampersands, line breaks, Unicode and unsupported controls.
- Source rename/reclassification reflected without changing occurrence layout or UUIDs.
- Browser unsaved child/ADR export captures the draft; CLI exports only saved content.
- Dangling ownership/source references and unsupported roles fail with actionable errors and no partial success.
- HTML ZIP extracts and browses offline; ADR links resolve to local containers/occurrences/relationships.
- Parent exports explicitly retain their single-diagram scope.
- Existing general diagrams, groups, metadata, lifecycle and package paths remain compatible.

## Owner title consistency (2026-10-05)

Resolved titles/headings and filenames use the current owning Software System name. Browser source refresh updates the captured title alongside scope while retaining captured local content, subtype, geometry and unsaved ADR data. ZIP filenames use the refreshed capture.
