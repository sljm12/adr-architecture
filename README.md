# ADR Diagram

![Alt text](images/logo.png)
C4ADR (Pronouced Ceeee-Adder, bad pun in know) is a browser-based editor for structured software architecture diagrams. Components,
relationships, ADR links, and system groups have stable UUIDs, changes can be explicitly saved
through the REST API, and validated diagrams can be downloaded as Mermaid files.

## Developed features

- Create and name architecture diagrams in a browser-based editor.
- Add, move, and remove software architecture components with stable UUIDs.
- Create C4 System Context components as Person or Software System artifacts, while keeping older
  unclassified components readable.
- Create/reopen one C4 container diagram per Software System and model Application/Datastore
  containers with source-linked external participants.
- Create/reopen one Component diagram per Application or Datastore, with internal Components,
  supporting participants, local interactions and ADR links across the three-level hierarchy.
- Connect components with labeled directed or undirected relationships.
- Group two or more Software Systems inside a labeled, movable boundary without rearranging their
  existing positions.
- Review, rename, remove membership from, or confirm ungrouping of a system group while preserving
  component, relationship, and ADR identities.
- Browse saved diagrams and load a selected diagram back into the editor.
- Preserve diagram names, C4 types, component positions, group membership/layout, relationship
  endpoints, labels, and metadata in PostgreSQL.
- Show clear saved, unsaved, saving, and failed-save states.
- Undo and redo diagram edits during the active editing session.
- Check component dependencies before deletion and prevent removal when relationships still exist.
- Move diagrams to recoverable trash and restore them later.
- Export validated diagrams as downloadable Mermaid files.
- Escape supported Mermaid-reserved characters and report actionable export validation errors.
- Provide keyboard-accessible controls, readable labels, and accessible status feedback.

## Setup

Prerequisites: Node.js (current LTS), npm, and PostgreSQL when using the database deployment.

```text
npm install
npm run build
npm run dev
```

The frontend is available at `http://localhost:5173`; the Fastify API runs at
`http://localhost:3000`. Set `DATABASE_URL` in the environment of the API process for a PostgreSQL
deployment; the current server does not automatically load `backend/.env`. Apply additive migrations
in order with your PostgreSQL migration runner before deploying the corresponding runtime:

```text
psql "$DATABASE_URL" -f backend/drizzle/0001_initial.sql
psql "$DATABASE_URL" -f backend/drizzle/0002_adrs.sql
psql "$DATABASE_URL" -f backend/drizzle/0003_system_groups.sql
psql "$DATABASE_URL" -f backend/drizzle/0004_component_dimensions.sql
psql "$DATABASE_URL" -f backend/drizzle/0005_c4_container_diagrams.sql
psql "$DATABASE_URL" -f backend/drizzle/0006_container_component_types.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/drizzle/0007_c4_component_diagrams.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/drizzle/0008_diagram_deletion_revision.sql
```

Migration `0003_system_groups.sql` adds `system_groups` and normalized
`system_group_members` rows. It does not cascade group deletion into components, relationships, or
ADR links.

Preserve an already-applied `0005_c4_container_diagrams.sql` and apply only pending migrations.
Migration 0006 adds `container_type` and backfills **Application only for existing internal
containers**, including trashed children. General/external elements retain null subtypes and
original types; UUIDs, creation times, metadata, geometry, relationships and ADR links remain
unchanged. It never infers Datastore from metadata. Apply 0006 before deploying runtime validation
that requires subtype; authors can then change existing data stores to Datastore. New internal
writes missing a subtype fail validation.

Migration 0007 widens the existing diagram/scope/role constraints for Component documents and
requires valid child boundary values. It adds no tables, columns or backfill. Apply it after
0001–0006; retain applied migrations and apply only pending migrations on existing deployments.

Apply migration `0008_diagram_deletion_revision.sql` after 0007 and **before starting the updated
API runtime**. It adds an internal saved-state revision counter with a zero default, preserving
existing artifacts and identities. The counter detects edits made after a deletion preview,
including ADR-only edits and edits subsequently reverted; it is not an editable document field.

## Tests

Run `npm run lint` to check TypeScript across the repository and React/React Hooks rules in the
frontend. Run `npm run lint:fix` to apply available automatic fixes.

```text
npm test
npm run test:e2e
```

`npm test` runs domain, validation, persistence, API contract, adapter, compatibility, and export
tests. `npm run test:e2e` starts the frontend and API together and runs the browser workflows.
For release validation, configure a dedicated migrated `DATABASE_URL` and set
`RUN_POSTGRES_TESTS=1`; skipped database tests do not establish migration, rollback or race safety.
See the [container quickstart](specs/009-c4-container-diagrams/quickstart.md) and
[validation evidence](specs/009-c4-container-diagrams/validation.md) for commands and outstanding gates.
The [Component quickstart](specs/010-c4-component-diagrams/quickstart.md) includes the three-level
journeys, disposable PostgreSQL setup, real HTTP/database workflow, offline browser matrix and
scale checks. [Spec 010 evidence](specs/010-c4-component-diagrams/validation.md) records results
and pending product-browser/usability acceptance; Playwright WebKit does not establish Safari acceptance.

## Mermaid preview

Create a diagram with at least one component and relationship, choose **Export Mermaid**, and open
the downloaded `.mmd` file in a Mermaid-compatible previewer such as Mermaid Live. Export validates
the complete domain document first; invalid content produces an actionable message and no file.
Person and Software System nodes use distinct Mermaid shapes, and each system group is emitted as a
labeled `subgraph`. Mermaid preserves group meaning and membership, but not exact canvas positions.

## Interactive HTML package

Choose **Export HTML package** to download the active diagram, its active descendants and their local ADRs as a ZIP. Extract
the ZIP and open `index.html` directly to browse the diagram offline. The package also includes
`adrs.html`, an editable `diagram.svg`, and one UUID-named Markdown file per ADR under `adrs/`.
Its links are relative, so the extracted folder can be moved as a unit. Edit `--component-outline`
and `--component-fill` near the top of `styles.css` to recolor component shapes in the HTML pages.
System Context, Container and Component diagrams share a centered hierarchy: prominent names,
smaller types/roles, regular responsibility text, and monospace technology/protocol text.
The stylesheet is readable and documented. Change its font, color, field-size and page-spacing
variables, or add rules in the **User overrides** section at the bottom. For example:

```css
.component-name { font-weight: 700; }
.component-technology { font-family: Consolas, monospace; }
.component-description { fill: #333333; }
.diagram-level-component .component-technology { font-style: italic; }
```

Reload any HTML page after editing; root and nested pages all use the same `styles.css`.
SVG text uses `fill` for color. Wrapping and SVG coordinates are calculated when exporting, so
large manual font-size/family changes can require manual SVG adjustments. Standalone `diagram.svg`
files embed matching default rules with resolved values for vector-editor compatibility; edit
their `<style>` independently. New exports contain the default styles, not edits to older packages.
The exact package paths and navigation contract are documented in
[`package-format.md`](specs/007-export-interactive-html/contracts/package-format.md).

## Command line diagram list and export

Run the CLI from the repository checkout with Node.js dependencies installed. It reads saved data
from the REST API and defaults to `http://localhost:3000`; set `ADR_DIAGRAM_API_URL` to another
absolute HTTP or HTTPS service URL when needed.

```text
npm run cli -- --help
npm run cli -- diagrams list
npm run cli -- diagrams list --name payments
npm run cli -- diagrams list --format json
npm run cli -- diagrams export 00000000-0000-4000-8000-000000000001 --output .\architecture.zip
```

The list shows each diagram's stable UUID, name, and timestamps. Name filtering ignores case, and
JSON output is an array suitable for scripts. Export uses the persisted diagram and its full ADR set
to create a selected-diagram-only portable package, including for Component diagrams. Browser
exports include the active subtree and retained drafts; CLI exports use saved data for the selected
diagram and its ADRs. The output path must end in `.zip`,
its parent directory must already exist, and an existing file is never replaced.

Successful commands exit with status `0`. Service, validation, and file errors exit with status `1`;
invalid command syntax exits with status `2`. Diagnostics are written to standard error.

The list table also identifies diagram level, parent and owner. JSON remains a flat
array with `kind` and resolved `scope`. Container exports retain the child's own name, canonical scope,
Application/Datastore subtypes, responsibilities, technologies, protocols and local ADR links.

Component width and height are stored with the diagram and default to 180 by 72 when an older
document is read. Apply `backend/drizzle/0004_component_dimensions.sql` before running against an
existing PostgreSQL database so saved resizes are retained.

## Command line diagram deletion

Use exactly one explicit selector and one explicit mode. Name matching compares the complete saved
name, including case and whitespace; it differs from the list command's substring filter. Container
and Component names follow their saved owners. A UUID-shaped name is still a name with `--name`.

```text
npm run cli -- diagrams delete --name "Payments" --trash
npm run cli -- diagrams delete --id 00000000-0000-4000-8000-000000000001 --trash
npm run cli -- diagrams delete --id 00000000-0000-4000-8000-000000000001 --permanent
npm run cli -- diagrams delete --name "Disposable example" --trash --yes
npm run cli -- diagrams delete --name "Payments" --all-matches --trash
npm run cli -- diagrams delete --name "Payments" --all-matches --permanent --yes
npm run cli -- diagrams clear-trash --yes
```

Each invocation previews the root and affected descendants with names, UUIDs and statuses. Trash
moves the active subtree and its contained artifacts/ADRs to recoverable Trash; independently
trashed descendants retain their previous recovery batches. Restore through the existing browser
recovery workflow. **Permanent deletion is irreversible**: it removes the entire selected subtree,
including previously trashed descendants, components, relationships, groups, ADRs and links.
Selecting a child preserves its ancestors, siblings and outside owner. Outside dependencies block
deletion and identify what must be resolved first.

Review the preview and type `yes` (case-insensitive, surrounding whitespace allowed). Refusal, EOF
or interruption cancels without executing deletion. Scripts and redirected input require explicit
`--yes`, which still prints the preview. Choosing a mode alone does not grant consent. Committed
success exits `0`; cancellation, unavailable service, stale confirmation and other failures exit
`1`; invalid selectors/options or missing/conflicting modes exit `2`. Diagnostics use stderr.

Duplicate exact names refuse selection by default and list candidate UUIDs and statuses; rerun
with `--id` for one root, or `--name` with `--all-matches` for every eligible exact-name match.
`--all-matches` is valid only with `--name` and one explicit mode. Overlapping matching roots and
their descendants appear once in the unique affected total. Disjoint selected Trash subtrees
have separate recovery batches and can be restored independently. All selected hierarchies
commit or roll back together; references entirely within a permanently removed union are allowed.
Trash searches active diagrams; permanent mode searches active diagrams and Trash. No exact match
requires checking the saved name or UUID. Deletion operates only on saved data: unsaved browser
edits are not captured. Save work you want retained first. A later stale browser save fails and
retains the local draft rather than recreating the deleted UUID.

`diagrams clear-trash` permanently removes every saved diagram in Trash across all recovery batches,
including owned artifacts, ADRs, links and recovery metadata. **This is irreversible.** Active
diagrams remain outside the scope; an active descendant or outside dependency blocks the whole
operation without changes. The command accepts only optional `--yes`, with no selector, mode,
`--all-matches` or output flags. Nonempty Trash prints every affected identity and total, then
requires interactive `yes` or explicit scripted `--yes`. Empty Trash reports "Trash is already
empty" with count zero, exits `0`, and sends no execution request or confirmation prompt.

Both new actions use the existing service URL and migration 0008; no new migration or dependency
is required. Preview and execution are separate transactions, so user confirmation holds no locks.
Execution briefly queues supported writers while checking the complete collection and committing.

Saved edits, changes to the eligible exact-name match set, or Trash membership changes between
preview and execution invalidate consent. Review a fresh preview in a new
invocation; the CLI never refreshes consent or retries deletion automatically. If the execution
response is lost or invalid, the operation may already have committed. Verify the root UUID and
descendants (every reviewed UUID for collection actions) in the application's active collection
and Trash before another invocation; use
`diagrams list` to check active saved entries. Absence from the active list alone does not prove
permanent removal. See the [deletion validation guide](specs/012-cli-delete-diagrams/quickstart.md)
for database, performance and workflow evidence.

## C4 system groups

New components use the C4 System Context vocabulary:

- **Person** represents a user, actor, role, or persona interacting with systems.
- **Software System** represents a system shown in the system-context view and is eligible for
  grouping.

Groups contain at least two Software Systems. A component belongs to at most one non-nested group,
and group names are unique after trimming and ignoring capitalization. Creating a group fits a
labeled boundary around the existing member positions; moving or resizing a member automatically
expands, repositions, or shrinks the boundary without changing membership. Moving the boundary
translates all members by the same delta.

Plain clicks select one component for editing. Hold **Shift** while clicking to build a temporary
grouping selection; incompatible Person/Software System selections are rejected with an explanation
and no partial mutation. Ungrouping and membership removal preserve the stable component,
relationship, and ADR references.

Documents created before C4 types or groups remain readable: omitted groups load as `groups: []`,
and a null component type is shown as **Unclassified** until it is classified.

## C4 container diagrams

Save a general diagram containing a Software System, then double-click the system or select/view it
and activate **Create container diagram**. Both entry points reopen the same canonical child after
creation, including grouped systems or systems with identical names. A Person or group cannot
own a child. An external Software System action resolves its parent source identity.
Unsaved parent/ADR work uses Save/Discard/Cancel; failed creation/loading leaves current work visible
and offers retry. A trashed child offers restoration and reserves its identity.

Inside a child, **Add component** and editing offer exactly **Application** and **Datastore**.
Name, responsibilities and technology are required; interactions are directed and require a
description, with an optional protocol. Creation forms reset when switching from a parent, so
Person/Software System drafts cannot become internal containers. **Include external participant**
is a separate workflow for parent People and other Software Systems. Source details are read-only
in the child: edit them in the parent, then reopen or use **Refresh source details**. Local occurrence
positions, relationships and ADR links retain UUIDs independently of parent positions.

The boundary fits internal containers; affected externals move outside with clearance in the same
undoable edit. Invalid overlap leaves previous geometry intact. Save and Save-before-navigation
update the existing child's own ID/name/level/scope. Failed or mismatched save responses retain the
draft for retry. **Return to** uses the persisted parent association and guards diagram/ADR work;
entering through the library or another source never changes ownership.

The library nests children beneath parent UUIDs and shows their own name, level, owner and parent.
Name/date filters match each diagram's own fields: contextual parent headings for matching children
do not inflate counts, and a matching parent does not make unrelated children match. Missing parent
summaries retain context; duplicate names do not merge parents.

Owner deletion/reclassification and unsupported source reclassification are blocked while active or
recoverable children depend on them. `DIAGRAM_DEPENDENCY` names each child/status and identifies
source and occurrence UUIDs. Restore a trashed child if necessary, explicitly resolve its local
relationship/ADR blockers and remove the occurrence before changing the parent source. Rejected
writes preserve sources, occurrences, relationships and ADR links. Supported Person/Software System
changes remain available for sources that do not own a child.

Trash confirmations name the parent and currently active affected children. Restoration previews
the canonical root and exact trash batch through `GET /diagrams/{id}/restore-impact`. Confirm that
ID set and batch against the root restore route; changed previews require refresh/reconfirmation.
When initiated from a child whose parent is trashed, confirmation restores the parent batch first.
A child independently trashed earlier stays trashed and needs separate confirmation after the
parent is active. Cancel changes nothing; failures retain work. Successful recovery followed by a
failed refresh/load offers retry without restoring again. See
[OpenAPI 1.2.0](specs/009-c4-container-diagrams/contracts/openapi.yaml).

Populated children export scope/boundary, subtypes, metadata, externals and interactions. Browser HTML
captures the current diagram and ADR draft, then resolves current parent source metadata without
saving; CLI HTML uses persisted data. Empty children retain their boundary in SVG/HTML; Mermaid
returns `422 EMPTY_CONTAINER_MERMAID` with those alternatives and produces no file. Unsupported
content fails explicitly. Browser Context packages include active Container and Component descendants;
Container packages include active Component children; Component packages contain only that child.
Single-diagram builders and the CLI remain selected-only. Navigation appears only for included
destinations. Extract the ZIP and open `index.html` offline to follow local ADR links.

## C4 Component diagrams

In a saved Container diagram, select an Application or Datastore and activate **Create component
diagram**, or double-click it. Later entry uses **Open component diagram** or **Restore component
diagram** and retains the same UUID and owner. Save-before-first-create must succeed; canceled or
failed saves retain the draft. Retry after a failed load reuses the created child.

Add internal **Components** with name, responsibilities and technology. Container-level forms keep
Application/Datastore choices; Component forms offer only Component. Include sibling containers or
existing Container Person/Software System occurrences as supporting participants. Interactions require
a description and at least one internal endpoint; protocols are optional. Supporting details are
read-only: use **Edit source** to reach the authoritative Container or Context, then reopen or
**Refresh source details**. Moving/resizing local occurrences preserves source layout and identities.

The boundary fits internals and displaces overlapping supporting participants in one undoable edit.
Save/reopen preserves local architecture and ADR links. Titles follow the owner and are read-only;
draft owner renames update library previews before filtering/sorting. The library nests Component
children under their Container and Context UUIDs. **Return to** opens the immediate parent and
selects the exact owner, with Save/Discard/Cancel protection for diagram and ADR drafts.

Owner/source removal is blocked by active or recoverable children. A supporting Person/System retains
its immediate Container occurrence reference and its canonical Context source. Keeping the Context
source does not permit removing that Container occurrence: restore each affected child as needed,
resolve its relationship/ADR blockers and explicitly remove its local occurrence, then remove the
parent occurrence once all dependencies are cleared. No removal cascades or retargets these references.
Changing an owner between Application and Datastore retains its child.

Trash previews list all active affected descendants. Restore confirms the exact recorded batch,
ancestor-first; previously independently trashed descendants stay trashed and need separate
confirmation after their ancestors are active. Changed impact requires a fresh confirmation.

Populated Components export scope, responsibilities, technology, supporting roles, interactions and
local ADRs. Empty SVG/HTML retain the boundary; Mermaid returns `EMPTY_COMPONENT_MERMAID` with the
remedy to add a Component or choose SVG/HTML. Mermaid preserves semantic information rather than
exact canvas geometry. Invalid or unavailable required artifacts fail the entire export.

## Project boundaries

The shared domain model is authoritative. React Flow is only a visual adapter, and Mermaid export
consumes validated domain data. This keeps component UUIDs stable for relationships, ADR component
links, and group membership; renaming or repositioning an artifact never rewrites those references.
