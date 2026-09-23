# Portable ZIP Package Contract

## File manifest

```text
index.html
adrs.html
diagram.svg
styles.css
adrs/<adr-uuid>.md       # One file per ADR; none when there are no ADRs
```

The ZIP contains these paths at its root, with no external network dependency or package runtime. Relative links keep working after the extracted directory is moved. The filename of the ZIP may use a sanitized diagram name, but paths inside the ZIP never use authored names. The package is a read-only snapshot; it is not an import format or a promise of exact source reconstruction.

## HTML navigation

- `index.html` is the entry page. It includes the diagram SVG inline and a link to `adrs.html`. Each component and relationship has one selectable SVG link and one readable text-list link to `#component-<uuid>` or `#relationship-<uuid>`.
- Each artifact anchor identifies exactly one pre-rendered detail section. That section lists only directly linked ADRs, once each, with title and status. An empty link set displays “No ADRs linked.” ADR links go to `adrs.html#adr-<uuid>`.
- `adrs.html` lists every ADR, including unlinked and all lifecycle states. Each `#adr-<uuid>` section shows full content, available timestamps, status, replacement relationship when present, and linked artifact names with UUID-disambiguated links back to `index.html`.
- No generated page fetches sibling files or executes JavaScript. Text is escaped before insertion. Default page and selection states remain readable with CSS enabled; keyboard focus is visible, and the text-list links remain usable when SVG link focus differs by browser.

## SVG and CSS

`diagram.svg` is a standalone SVG with an explicit view box, groups, vector component shapes, relationship paths, labels, arrowheads for directed relationships, and default embedded colors. The same validated geometry and text are rendered inline in `index.html`; inline content has stable artifact classes and IDs. Group and relationship styles remain visually distinct from components.

`styles.css` documents `--component-outline` and `--component-fill` at the top of the file. These variables control the stroke and fill of component shapes in the HTML diagram. Default values follow `DESIGN.md` with readable text and focus contrast. Changing them does not alter IDs, paths, hit targets, or ADR links. The standalone SVG retains its own default colors for portability and can be restyled in an SVG editor.

## Markdown ADR files

Each `adrs/<uuid>.md` starts with the ADR title and includes stable ADR ID, status, created and updated times, optional replacement ADR reference, context, decision, consequences, alternatives or constraints, and linked component and relationship references with names plus UUIDs. Empty link sets are explicit. Authored text is escaped for Markdown syntax where needed and retains line breaks; generated Markdown never contains executable HTML from authored fields. UUID filenames prevent duplicate-title collisions and path traversal.

## Failure contract

No ZIP is downloaded until every artifact, link, output file, and path passes validation. A failure message identifies the artifact kind, UUID if available, field, and correction needed. Unsupported visual types, missing endpoints, broken ADR links or replacement references, invalid dimensions, and text that cannot be safely represented are errors, never omissions.
