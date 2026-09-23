# Quickstart Validation: Interactive HTML Package Export

This guide validates [Spec 007](spec.md) after implementation. Use the API's local in-memory mode for a quick manual run, or configure `DATABASE_URL` and apply migrations through `backend/drizzle/0004_component_dimensions.sql` to verify PostgreSQL persistence. Do not treat this guide as an implementation script.

## Prerequisites and commands

From the repository root, install dependencies if needed, then run the available checks:

```powershell
npm install
npm run build
npm test
npm run test:e2e
```

For manual browser validation, start the app with `npm run dev` and open `http://localhost:5173`. The API runs at `http://localhost:3000`. If using PostgreSQL, set `DATABASE_URL`, apply the existing migrations in order and then `backend/drizzle/0004_component_dimensions.sql` with the project's migration runner, and restart the API. The [API contract](contracts/openapi.yaml) and [component layout change](contracts/component-layout.md) describe the expected read and persistence boundaries.

## End-to-end scenarios

1. Create a diagram with two differently named components, a directed labeled relationship, and a system group. Resize one component, move it, and save. Create one ADR linked only to the component, one linked only to the relationship, and one unlinked ADR. Include draft, accepted, and rejected states. Export the HTML package and verify the download reports success.
2. Extract the ZIP to a new directory and open `index.html` directly from disk with network access disabled. Verify the group, component sizes and positions, relationship label and arrow, and the link to `adrs.html`. Click a component and the relationship separately. Each detail section must show exactly its direct ADRs, without borrowing the relationship ADR for an endpoint component. Select an unlinked artifact and check its empty state.
3. Use Tab and Enter to reach the diagram's textual artifact links, an ADR link, the all-ADR page, and a linked artifact back in the diagram. Verify visible focus and meaningful labels. In `adrs.html`, open every ADR, including the unlinked one, and verify status, full decision fields, timestamps, and references.
4. Open `diagram.svg` in a standard SVG editor and confirm that groups, shapes, labels, and relationship paths remain vector elements. Open every `adrs/<uuid>.md` in a Markdown reader and confirm its content and stable references. Consult the [package contract](contracts/package-format.md) for exact paths and anchors.
5. Edit `--component-outline` and `--component-fill` at the top of `styles.css`, reload `index.html`, and verify both colors change while selection and ADR links still work. Move the entire extracted directory and reopen the pages to check relative navigation.
6. Make unsaved diagram changes and edit an existing ADR without saving; export again. The package must reflect the visible edits while the app's save indicators remain unchanged. Start a valid new unsaved ADR and verify it appears once with a package-local UUID. An incomplete new draft must produce a field-specific error and no successful ZIP.
7. Test duplicate component names, non-Latin characters, punctuation, Markdown characters, and text resembling HTML or script. The text must be readable, links must resolve by UUID, and authored text must never execute. Test a diagram with no ADRs and a valid empty diagram; both must show clear empty states.
8. Supply or simulate a missing relationship endpoint, broken ADR component or relationship link, missing replacement ADR, invalid component dimensions, and unsupported visual type. Each case must stop before download and identify the artifact and field. Repeat with a resized group member and verify its group boundary still encloses it after save and reopen.

## Automated proof expected

- Shared tests cover legacy size normalization, changed dimensions through save/reopen, stable IDs, group enclosure, snapshot merge, direct versus endpoint links, replacement references, escaping, deterministic SVG and Markdown output, and atomic validation errors.
- Backend contract and persistence tests cover `GET /diagrams/{diagramId}/adrs/full`, all ADR states and links, missing or inactive diagram errors, bounded aggregate reads, and the additive component-size migration.
- Frontend tests cover unsaved and failed-save snapshots, a saving-state block, download feedback, and no save side effects. Playwright covers the extracted package using a local file URL, keyboard navigation, all-ADR browsing, CSS recoloring, and representative SVG content.

The feature is ready for review when these checks pass and the package contents match [package-format.md](contracts/package-format.md) for all representative and failure cases.
