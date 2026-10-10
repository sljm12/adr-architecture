# Implementation plan

Use the existing shared TypeScript export renderers; add no dependencies or runtime scripts. Replace flattened labels with structured blocks carrying semantic classes and shared typography metrics. Use the same blocks for SVG positioning and render-only sizing. Reuse the existing scoped layout fitting and routing.

Replace compressed/string-replaced CSS with readable sections, documented customization variables, shared SVG defaults and an override section. Update diagram scope/detail markup and ADR metadata styling using existing page structures and links. Preserve paths, UUID anchors, validation and standalone SVG viewport normalization.

Constitution check: artifact identities/references and saved geometry are preserved; validation remains at the export boundary; focused automated rendering, portability and customization coverage satisfies the quality gate. No schema, persistence, dependency or authorization changes.

Validation: shared export tests, TypeScript builds and offline package browser checks. Inspect screenshots at desktop/narrow widths and print layout. Record unavailable browsers and the fixed SVG geometry limitation.
