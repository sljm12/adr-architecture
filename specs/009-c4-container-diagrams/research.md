# Research: C4 Container Diagrams

**Date**: 2026-09-30

**Feature**: [spec.md](./spec.md)

## Repository findings

The existing stack and storage remain the implementation base. Research inspected the shared types, schemas, invariants and exporters; the frontend adapter, canvas, inspector, diagram/ADR stores and navigation; the PostgreSQL repository, services, routes and migrations; and DESIGN.md. Two research agents independently reviewed persistence/recovery and editor/export integration.

Concrete risks:

- `backend/src/persistence/diagram-repository.ts` already applies transactional ID-preserving diffs. Whole-document replacement nevertheless physically removes omitted rows, so service checks confined to DELETE cannot protect new references.
- Existing trash/restore updates one diagram; no cascade provenance exists.
- `backend/src/services/adr-service.ts` does not consistently validate diagram activity before every mutation. Child trash protection therefore requires transaction-coordinated activity checks for ADR writes.
- `backend/src/services/export-service.ts` reads the repository directly; source hydration confined to a GET handler would miss export.
- Existing group fitting assumes at least two Software Systems. A C4 boundary enclosing containers, including zero containers, cannot be represented by SystemGroup.
- Current relationships permit missing labels and undirected connections. Child validation must be stricter while general diagrams retain their behavior.
- SVG and HTML hardcode the old types, HTML rejects new types, and Mermaid drops responsibilities and technology.
- Keyboard node movement must commit to domain state; the existing canvas persists positions through drag-stop handling only.

## Decisions

### 1. Extend the existing domain and tables

**Decision**: Add diagram `kind: general | container`, a source-system scope, and boundary layout. Extend existing components with `role: element | container | external`, technology, and a source reference; extend relationships with protocol.

**Rationale**: Containers and external occurrences retain local component UUIDs, allowing existing relationship endpoints and ADR link tables to remain authoritative. Role explicitly separates legacy free-form type strings from new C4 semantics. Old data defaults to general/element and is not reclassified.

**Alternatives considered**: Separate container/participant tables would require polymorphic endpoints and ADR links. Reusing source IDs in child components violates existing diagram ownership. Inferring diagram level from element names/types is ambiguous.

### 2. Store immutable ownership and enforce uniqueness across trash

**Decision**: Store parent diagram and owning source component IDs on the child. Apply a unique owner index without filtering by active status and restrictive source/owner foreign keys. Ownership and kind cannot be changed by document PUT.

**Rationale**: A recoverable child remains the canonical diagram. Names are display metadata and duplicate names must remain safe. PostgreSQL foreign keys and unique constraints provide persistence backstops; application validation supplies readable errors. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints).

**Alternatives considered**: Active-only uniqueness permits silent replacement of trashed children. Name-based associations break on rename. Cascading physical source deletion discards architecture knowledge.

### 3. Serialize graph writes at the source parent

**Decision**: Use a Drizzle transaction and lock the source parent diagram row before child creation, diagram replacement/removal, trash/restore, or ADR mutations in that graph. Then lock affected child rows in UUID order. Reread eligibility and dependencies after acquiring locks. All entry points use this ordering.

**Rationale**: The existing single-user scope permits a simple parent-level lock rather than fine-grained lock coordination. Drizzle provides PostgreSQL transactions; PostgreSQL row locks coordinate competing writes. The graph lock protocol is this feature's design inference, not a library-provided hierarchy mechanism. [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).

**Alternatives considered**: Frontend in-flight flags alone cannot prevent concurrent clients or retries. Separate lookup and normal create is race-prone. Global serialization is broader than needed.

### 4. Make create-or-open atomic and retry-safe

**Decision**: A component-scoped endpoint resolves a Software System or external occurrence to its canonical source, locks its parent, and returns the existing active child or creates one complete empty child. A trashed child returns RESTORE_REQUIRED metadata. Uniqueness remains the final guarantee. If an expected uniqueness race occurs, roll back and load the winning child through a fresh transaction rather than query within an aborted one.

**Rationale**: Both requested UI entry points converge on one operation without duplicates. No new idempotency-key store is needed because owner identity supplies the natural key.

**Alternatives considered**: A GET-then-POST sequence and client-generated child IDs do not guarantee canonical ownership.

### 5. Resolve source metadata without sharing layout

**Decision**: External occurrences have local UUIDs, source IDs and local layout. Their name, description and C4 type are hydrated from the source parent. Existing required component columns may retain server-written caches; caches never determine source truth. Client-provided external display fields are overwritten with resolved values, while changed source identity or role is rejected.

**Rationale**: Read, save and export show current source names while parent positions and relationships remain unchanged. Only one-hop references to ordinary parent elements are allowed.

**Alternatives considered**: Independent copies drift. Reusing parent coordinates prevents local arrangement. Recursive source chains complicate validation without supporting the requested workflow.

### 6. Share contextual resolution across load, save and export

**Decision**: Add a backend document resolver used by diagram services, summary generation, Mermaid export and a child export-context endpoint. It resolves owner/source fields in a consistent snapshot and validates missing references. Shared pure validators then consume complete resolved documents.

**Rationale**: Browser HTML export can capture unsaved local edits while fetching current source details; CLI export uses the resolved persisted GET response. No export adapter reads React Flow state or directly fetches database data.

**Alternatives considered**: GET-only hydration leaves other routes stale. Forcing browser export to save first changes the existing draft export contract.

### 7. Fit one system boundary with atomic local history

**Decision**: Persist boundary layout on the child; compute it using a shared pure helper. Empty diagrams use a 480 by 320 boundary at the origin. Nonempty boundaries fit internal bounds with 24 units of padding and a 44-unit header. Expansion relocates intersecting external occurrences outside it; direct external placement inside is rejected. All resulting layout changes occupy one history entry.

**Rationale**: The domain owns geometry and undo can restore a complete edit. The boundary is neither an architecture component nor an ADR/relationship endpoint.

**Alternatives considered**: SystemGroup violates cardinality/type rules. React Flow-relative coordinates couple artifacts to the editor.

### 8. Use the existing editor with explicit keyboard actions

**Decision**: Wire canvas double-click and native inspector Create/Open/Restore buttons to one guarded navigation coordinator. Use controlled nodes/edges and a custom, nonconnectable boundary node. Preserve plain-click selection, Shift grouping in general diagrams, and the existing diagram/ADR save-discard-cancel flow.

**Rationale**: Official React Flow docs expose `onNodeDoubleClick`, custom node types and controlled state. Node properties support disabling selection, movement, deletion and connection for the synthetic boundary. Accessibility defaults provide node focus/selection/movement; the explicit button supplies creation/opening and completed keyboard moves must update the domain. [React Flow props](https://reactflow.dev/api-reference/react-flow), [Node properties](https://reactflow.dev/api-reference/types/node), [Accessibility](https://reactflow.dev/learn/advanced-use/accessibility).

**Alternatives considered**: Opening on plain click disrupts selection. Using Enter as implicit navigation would conflict with node selection. Turning off keyboard support would violate the specification.

### 9. Protect dependencies at every mutation boundary

**Decision**: Compare previous and incoming documents inside replacement transactions. Reject omitted/retyped owners with active or trashed children, omitted/invalidly retyped sources with external occurrences, and omitted ADR-linked components or relationships. Keep existing relationship/group blockers. Add typed diagram blockers alongside existing ADR blockers. ADR writes check active parent/child state before mutation in the same graph transaction.

**Rationale**: DELETE, PUT and ADR routes must not bypass reference protection. FKs remain a last defense rather than a user-facing error contract.

**Alternatives considered**: Relying only on frontend validation or raw FK errors permits type-change gaps and opaque failures.

### 10. Record exactly which diagrams a trash operation affects

**Decision**: Add server-managed `trashBatchId` and `trashRootDiagramId` columns. A parent trash marks the parent and currently active direct children with one batch. Previously trashed children keep their earlier marker. Restoration touches exactly that batch and validates sources. Independent child restore requires an active parent.

**Rationale**: This small provenance model distinguishes independent trash from parent cascade. Preflight lists affected diagrams, and DELETE rechecks the confirmed IDs under the graph lock.

**Alternatives considered**: Restoring all children resurrects intentionally trashed work. Matching timestamps is unreliable. A generalized operation-history subsystem is unnecessary.

### 11. Extend existing exports without recursive packages

**Decision**: Support child metadata and boundary in populated Mermaid diagrams, SVG and the existing HTML ZIP. SVG/HTML export empty children as labeled boundaries; empty-child Mermaid export returns an actionable unsupported error. Parent export stays a single-diagram snapshot and explicitly indicates that child contents are not bundled. Browser packages use local drafts plus resolved source context; CLI packages use saved data.

**Rationale**: This fulfills the existing export contracts and avoids silently dropping new fields. Escaping and validation extend to responsibility, technology, protocol and scope names.

**Alternatives considered**: Rejecting every child export is allowed for unsupported cases but removes an existing core workflow. Recursive packages and cross-export navigation exceed this feature.

**Mermaid verification**: Current parser/model sources accept empty subgraphs, but the project does not pin the downstream Mermaid renderer. The design therefore chooses EMPTY_CONTAINER_MERMAID with a remedy to add a container or export SVG/HTML, rather than promise unverified empty rendering or insert dummy artifacts. Populated exports put external nodes and relationships after the system subgraph, use quoted labels with generated line breaks, and escape user fields individually. [Flowchart syntax and escaping](https://mermaid.js.org/syntax/flowchart.html), [official parser](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/flowchart/parser/flow.jison).

### 12. Keep the established stack and plan meaningful validation

**Decision**: Retain TypeScript, React/Vite, Zustand, Fastify, Zod 3, Drizzle/pg, JSZip, Vitest and Playwright. Add no runtime dependencies. Verify domain, contract, history, rendering, migration and real PostgreSQL concurrency boundaries in implementation.

**Rationale**: Repository implementations provide the conventions; current documentation verifies only the library-specific mechanisms this design needs. Installed versions remain authoritative and no upgrade is required. PostgreSQL suites currently skip when configuration is missing, so a skipped suite cannot prove atomicity.

**Alternatives considered**: A new storage abstraction, collaboration infrastructure, state library or diagram editor is unnecessary.

## Documentation lookup record

- Drizzle: Context7 resolved `/drizzle-team/drizzle-orm-docs`, then fetched transactions, PostgreSQL schema/constraints and conflict documentation outside the sandbox. The first PowerShell `npx` invocation was blocked by execution policy; `npx.cmd` succeeded. No quota failure occurred.
- React Flow: Context7 resolved `/websites/reactflow_dev` and fetched interaction, node and accessibility references outside the sandbox.
- Mermaid: Context7 resolved `/mermaid-js/mermaid` and fetched flowchart guidance. An additional query hit Windows argument quoting; official source inspection supplied the empty-subgraph evidence without exceeding the three-command limit.
- Additional primary sources: PostgreSQL locking/constraints above and the [C4 container](https://c4model.com/diagrams/container) and [Software System](https://c4model.com/abstractions/software-system) references supplied in the specification.
- No unresolved technical or product clarifications remain. Source citations establish the mechanisms; the schema, lock protocol and workflow choices are feature-specific design decisions.
