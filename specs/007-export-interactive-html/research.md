# Research: System Context and Container HTML Package Export

**Updated**: 2026-10-06. Decisions apply to the implemented exporter and updated Spec 007. Existing dimensions, full-ADR reads, domain SVG and archive logic remain dependencies.

## Decision 1: Preserve the existing single-diagram adapter

**Decision**: Retain `HtmlExportInput`, `validateHtmlExportSnapshot()` and `buildHtmlPackage()` for existing consumers. Add an aggregate capture/source/snapshot and browser builder. Reuse per-diagram schemas, SVG and escaping. System contexts remain existing general diagrams.

**Rationale**: `shared/src/domain/types.ts` defines only general/container kinds. `cli/src/export-command.ts` calls the single builder, and `cli/tests/container-export-command.test.ts` expects no parent request for a direct child. FR-022/FR-024 and the assumptions preserve this scope.

**Alternatives considered**: Recursive fetching in the shared builder (breaks purity and CLI scope); new persisted kind (unnecessary migration); replace export stack (duplicates working behavior).

## Decision 2: Capture only drafts actually retained in the current session

**Decision**: Clone one timestamp and ID-keyed retained document/ADR overrides synchronously before requests. Current providers are the active document and eligible ADR draft. Saving blocks capture; unsaved and failed-save valid drafts remain exportable. No export invokes save, navigation, clear or restore.

**Rationale**: `frontend/src/components/ExportButton.tsx` already captures through `structuredClone`. Diagram/ADR stores each retain one current document/draft, and workspace navigation requires Save/Discard/Cancel. There is no inactive draft cache. The requirement covers retained drafts, without requiring a new retention UX. Later edits cannot partially change capture.

**Alternatives considered**: Navigate into children (mutates editor); introduce retention UX (scope growth); re-read stores after requests (mixed-time snapshot).

## Decision 3: Gather one scoped saved graph under existing coordination

**Decision**: Add `GET /diagrams/{diagramId}/export/html-source`. Use `GraphTransaction` with canonical parent-first locks and transaction-scoped ADR reads. Return included saved documents/full ADRs and explicit availability; direct child returns itself and eligible source context only. Retain raw parent-scoped child IDs and fail on missing active loads. Use repository-scoped hydration helpers without nested transactions.

**Rationale**: Existing availability/context/full-ADR GETs are safe but multiple requests cannot establish one saved graph boundary. Global diagram listing validates unrelated documents. `PostgresDiagramRepository.findChildren()` filters undefined loads, so its results alone cannot prove completeness. `GraphTransaction.run()` already shares diagram/ADR transaction scope and coordinates graph mutations. This is read-only application behavior using locks, not SQL READ ONLY mode; release locks before rendering. Recheck the selected association inside the boundary.

**Alternatives considered**: Global list plus child GETs (unrelated corruption/mixed state); per-owner browser requests (round trips); backend ZIP (unneeded draft transfer); second transaction/isolation strategy (more complexity).

## Decision 4: Resolve child metadata against the captured parent

**Decision**: Overlay eligible frozen drafts, preserving canonical kind/parent/owner IDs. Derive bundled child titles, scope labels and external name/type/description from the captured parent by UUID. Preserve occurrence identity, geometry, subtype and local ADR links. Missing/ineligible required owners or sources fail. Direct child uses consistent saved source context without bundling its parent. Unsaved new parent systems have no persisted child.

**Rationale**: `resolveContainerExportInput()` currently refreshes one child from live context; doing that independently would erase a captured parent rename. `ContainerContextService.hydrateAndValidateDocument()` already distinguishes display fields and local occurrence identity. FR-023 requires consistent owner names and FR-019 forbids inherited ADR links.

**Alternatives considered**: Retain saved child names (conflicting titles); match by name (ambiguous); copy parent/source ADRs (wrong scope); silently exclude a required child after draft owner deletion (incomplete export).

## Decision 5: Keep static pages and centralize paths

**Decision**: Preserve root index.html, diagram.svg, adrs.html, styles.css and adrs/<adr-uuid>.md; add diagrams/<diagram-uuid>/index.html and diagram.svg for children. Use one path/link context throughout diagram, catalog and Markdown rendering. Local artifact anchors remain stable; page paths disambiguate diagrams. Reject duplicate artifact-type UUIDs and file paths.

**Rationale**: Current diagram-page, adr-page and adr-markdown modules hardcode root links and single-diagram wording. A manifest-only change leaves CSS/backlinks broken. Static SVG links, CSS target details and textual indexes already support offline browsing. System details gain a distinct child action without changing ADR selection. Source-to-included-child maps allow sibling navigation without recursive inclusion.

**Alternatives considered**: Dynamic switching runtime (unneeded state/script); adjacent JSON fetch (unneeded local-file dependency); authored-name directories (collisions); child-only catalogs (incomplete global browsing).

## Decision 6: Archive only after complete rendering

**Decision**: Reuse installed JSZip 3.x. Add validated UTF-8 strings with forward-slash relative names; await generateAsync with Blob, DEFLATE and level 6 before download. Reject duplicate paths before adding files and propagate archive failure without success.

**Rationale**: Context7 documentation confirms nested file names, file's add-or-update behavior and generateAsync's promise/error behavior. Duplicates must be checked to prevent replacement. Existing adapter uses these generation settings. Retrieved 2026-10-06: [JSZip file API](https://github.com/stuk/jszip/blob/main/documentation/api_jszip/file_data.md), [async generation](https://github.com/stuk/jszip/blob/main/documentation/api_jszip/generate_async.md).

**Alternatives considered**: Hand-written ZIP (format risk); per-diagram downloads (fails one-package workflow); unresolved child-content promises inside the ZIP (weakens complete validation).

## Decision 7: Validate complete scope and preserve compatibility

**Decision**: Validate saved source structure and the final overlaid package; errors include diagram ID, artifact kind/ID, field and remedy. None/trashed are deliberate exclusions; unreadable active children are failures. Keep ADR links/replacements local to their owning diagram. Extend existing unit/e2e suites with aggregate, transaction, link-resolution, source-overlay and compatibility cases.

**Rationale**: The constitution and FR-013 forbid silent omission. Existing validators cover dimensions, groups, endpoints, lifecycle, direct ADR links and safe text. Aggregate validation adds ownership/source completeness and navigation destinations.

**Alternatives considered**: Omit failed children (false completeness); infer subtype/repair references (silent changes); rely on old completed tasks (no extension coverage).

The current single-snapshot validator checks saved ADRs against its supplied diagram before merging the draft. Aggregate assembly must validate saved sets against saved diagrams, then merge and validate final links against overlaid diagrams, so an explicitly removed link in a captured ADR draft can resolve a draft artifact deletion. Preserve public single-diagram inputs while extracting reusable merge/check helpers.

## Decision 8: Validate four stable browsers with separate engine regression coverage

**Decision**: Implement scoped offline Playwright projects for branded Chrome/Edge and Firefox/WebKit engines. Require separate recorded acceptance in actual current stable Chrome, Edge, Firefox and Safari, using file URLs, disabled network and normal settings. No HTTP or security-flag workaround. Safari acceptance uses a supported macOS environment. Document browser/OS/version/date and each required journey; unavailable browsers remain pending.

**Rationale**: FR-025/SC-012 require product-browser results. Current playwright.config.ts has one global Chromium-family executable and no projects. Existing portability tests force focus before Enter, and file tests do not explicitly disable network. Extend them to prove native keyboard reachability and offline operation. Official guidance supports chrome/msedge channels and project selection, while bundled Firefox/WebKit are patched builds and cannot automate branded Firefox/Safari. Engine success is useful regression evidence but does not establish those product acceptance results. [Playwright browsers](https://playwright.dev/docs/browsers), [project CLI](https://playwright.dev/docs/test-cli) (verified 2026-10-06 via Context7 and official documentation).

**Alternatives considered**: Relabel engine tests as stable browser proof (incorrect evidence); change the package to require a local server or security settings (contradicts FR-025); require a new browser-automation dependency (unnecessary; actual Firefox/Safari journeys can be recorded manually).

## Resolved Unknowns

All planning choices are resolved: no new dependency or migration; no inactive draft cache; one source endpoint with existing graph coordination; UUID paths; script-free navigation; unchanged single adapters; scoped engine coverage plus four actual stable-browser acceptance rows. PostgreSQL race/zero-write checks, browser results and observed usability/performance measurements are implementation gates.
