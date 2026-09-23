# Research: Interactive HTML Package Export

## Decision 1: Assemble the export from a current editor snapshot

**Decision**: Freeze a deep copy of the active `DiagramDocument` and the open ADR draft when the author starts export. Read the full persisted ADR set through a new diagram-scoped aggregate endpoint, replace the matching saved ADR with the frozen draft or append a new draft with a package-only UUID, then validate and render the complete snapshot in the browser. Disable export while a diagram or ADR save is in progress; a failed save does not discard the visible draft. Do not call either save action.

**Rationale**: `useDiagramStore.document` contains the current diagram. `useAdrStore.records` contains only summaries, while `draft` is the sole full ADR in memory. The existing Mermaid GET reads the last saved diagram and explicitly blocks unsaved changes, so it cannot satisfy FR-012. One aggregate read avoids one request per ADR. Overlaying the draft after the read preserves current edits, and retaining the original saved ID keeps references stable. For a new unsaved draft, a UUID generated only for this package gives internal links a stable target without pretending that the draft has already been persisted.

**Alternatives considered**: Reuse saved Mermaid GET (loses unsaved edits and all ADR content); fetch each ADR by ID (many requests for 100 ADRs); POST the whole editor snapshot for backend ZIP generation (valid, but sends already available current state to the server and adds a larger write-shaped export contract).

## Decision 2: Use static HTML navigation for the extracted package

**Decision**: Generate `index.html` with inline SVG and a pre-rendered detail section for each component and relationship. SVG links target those sections by stable UUID-based anchors. A dedicated `adrs.html` lists every ADR and contains full ADR sections; references link back to the diagram anchors. CSS `:target` exposes the selected section. Include visible default and no-links states and a textual artifact index for keyboard access. The package requires no JavaScript, JSON fetch, server, or external asset.

**Rationale**: Local `file://` documents cannot reliably fetch sibling files because local origins are often treated as opaque. Static links work after moving the extracted directory and give browser history and keyboard navigation. Pre-rendering is manageable for the acceptance size of 100 components, 200 relationships, and 100 ADRs. It also prevents authored text from becoming script input.

**Alternatives considered**: JavaScript loads of adjacent JSON/Markdown (local-origin restrictions); one dynamic page with embedded data and script (more code and security surface); SVG embedded through `<img>` (not individually interactive or styled by the host stylesheet). [Local-origin behavior](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy); [SVG embedding behavior](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Including_vector_graphics_in_HTML).

## Decision 3: Render SVG from validated domain data

**Decision**: Add a pure domain-to-SVG export adapter in `shared/src/export/`. Use it both for inline diagram markup in `index.html` and for standalone `diagram.svg`. Preserve stable IDs, absolute positions, group boundaries, component type cues, relationship labels and direction, including separated routes for parallel relationships. Use primitive vector shapes and text so SVG editors can manipulate the result. Standalone SVG embeds default styling; inline SVG uses `styles.css` classes and component color variables.

**Rationale**: React Flow remains an editor adapter rather than export source of truth. Reusing one renderer prevents the HTML and standalone diagram from diverging. Inline SVG allows package CSS to change component outlines and fills and allows each component and relationship to act as a link.

**Alternatives considered**: Serialize the React Flow DOM (mixes editor chrome and runtime state with artifacts); generate a raster preview (not editable); render two independent diagrams (risk of content drift).

## Decision 4: Persist component dimensions needed by the export

**Decision**: Extend the component domain artifact with positive finite width and height, update resize actions to change that artifact, and persist dimensions in PostgreSQL with compatibility defaults equal to the current 180 x 72 component size. Existing documents without dimensions receive those defaults during validation/normalization. The SVG renderer uses domain positions and dimensions, never React Flow measured state.

**Rationale**: Today the component domain stores position only; `DiagramCanvas` keeps resized dimensions transiently. An export of the visible diagram would otherwise shrink resized components to the default box. This data belongs in the domain because it is part of diagram layout, and persistence keeps subsequent exports consistent. The migration is limited to two layout fields, with compatibility coverage required by the constitution.

**Alternatives considered**: Always render default component sizes (loses visible resize layout); pass canvas measurements as an export-only side channel (breaks the validated-domain export boundary and makes repeated exports inconsistent).

## Decision 5: Generate the ZIP in the browser with a small archive dependency

**Decision**: A pure package renderer returns a deterministic map of text files. The frontend archive adapter adds those files to JSZip, generates a ZIP Blob, and downloads it. Paths are fixed except for `adrs/<adr-uuid>.md`; user titles are never used as path segments. The package contains `index.html`, `adrs.html`, `diagram.svg`, `styles.css`, and one Markdown file per ADR.

**Rationale**: The browser already holds the frozen current-state snapshot. JSZip supports adding named files and asynchronously generating a Blob, and the backend only needs a read endpoint for complete ADR data. No extra persistent export record or temporary server file is needed. [JSZip file API and archive generation](https://github.com/stuk/jszip/blob/main/documentation/api_jszip/generate_async.md).

**Alternatives considered**: Backend ZIP endpoint (larger request/response boundary and duplicate current-state transfer); hand-written ZIP format (unnecessary correctness risk); multiple independent downloads (fails the single-package requirement).

## Decision 6: Validate and escape before packaging

**Decision**: Parse the complete diagram and every ADR with shared schemas, then check diagram ownership, duplicate identities, endpoints, group membership, ADR component and relationship links, and replacement ADR targets. Reject unsupported component types or content that cannot be safely represented, with the offending artifact ID and field. Escape authored text separately for HTML, XML/SVG, and Markdown contexts. Render HTML ADR body fields as escaped text with preserved line breaks, without interpreting authored Markdown or HTML. Only offer the ZIP after every file has been generated successfully.

**Rationale**: The constitution forbids silent omission and broken references. Context-specific escaping keeps titles and decision content visible without letting them change markup or package paths. Atomic generation prevents a partial package from being reported as complete.

**Alternatives considered**: Best-effort omission or warnings (violates data protection); inserting text directly into templates (markup injection); treating Markdown as trusted HTML (executable content risk).
