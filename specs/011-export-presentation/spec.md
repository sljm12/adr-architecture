# Export presentation

## User scenarios

1. A reader distinguishes an element's name, type, responsibilities and technology at a glance across System Context, Container and Component exports.
2. A package owner edits the shared stylesheet and reloads root and nested HTML pages to customize presentation without rebuilding the application.
3. A reader follows artifact, child/parent and ADR links using a keyboard in a relocated, offline package.

## Requirements

- FR-001: Render names, types, supporting roles, descriptions and technologies as individually styled fields, preserving every currently exported field.
- FR-002: Use centered hierarchy: name 21px/600, type 12px/600, role 12px/400, description 17px/400, technology 14px monospace; relationship description 14px/600, protocol 12px monospace, boundary name 14px/600.
- FR-003: Use DESIGN.md's neutral palette, blue actions/focus, readable contrast, responsive pages and print rules across diagrams, details and ADR pages.
- FR-004: Emit readable, documented CSS variables/selectors and a user overrides section in the existing shared styles.css. Preserve component outline/fill settings and provide diagram-level selectors.
- FR-005: Inline and standalone SVG defaults must agree. Standalone files retain embedded, independently editable styles.
- FR-006: Default wrapping, sizing and label collision envelopes must account for the distinct typography. Export fitting must not mutate saved artifacts or identifiers.
- FR-007: Preserve existing validation, escaped text, package paths, script-free portability, navigation and ADR semantics. No API/schema migration is required.

## Edge cases and assumptions

Cover empty diagrams/ADRs, absent optional fields, supporting participants, long/multiline/Unicode text, parallel relationships, small nodes, narrow screens and printing. System Context retains its current field selection. New exports receive the redesign; extracted packages retain manual CSS edits. Large manual font changes do not automatically recalculate SVG wrapping/geometry.

## Success criteria

- SC-001: All displayed fields have the documented independent selectors and consistent computed styles across three levels.
- SC-002: Representative long-label fixtures have no clipped text or overlapping node/relationship label envelopes with default styling.
- SC-003: Editing shared color, font-family and weight rules affects every included HTML diagram after reload.
- SC-004: Existing export unit tests and offline navigation/customization checks pass; browser evidence records available engines and any unavailable product browsers.

## Validation checklist

- Verify field hierarchy, escaping, optional fields and default SVG styles.
- Verify geometry, unchanged inputs, stable links and complete package output.
- Verify CSS editing/reload, offline relocation, keyboard access and print/narrow layouts.
