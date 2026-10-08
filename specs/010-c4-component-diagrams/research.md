# Research: C4 Component Diagrams

**Date**: 2026-10-08 | **Feature**: [spec.md](spec.md)

## Research scope and resolved decisions

Repository research covered the existing Container domain, schemas, database migrations, graph transactions, source resolution, recovery, editor, naming, list, ADR, HTML package and CLI boundaries. Separate research agents reviewed backend/persistence and frontend/export. No technical or product clarification remains unresolved. The decisions below distinguish project choices from library mechanisms.

### 1. Extend the existing domain by one level

- **Decision**: Add `kind: component`, a `ComponentScope` discriminated by diagram kind, and internal `role: component` / `type: component`. Retain general and Container documents and their existing scope shapes. Keep `isC4ArtifactType` limited to Person/Software System; introduce separate level-aware predicates.
- **Rationale**: `shared/src/domain/types.ts`, `invariants.ts`, `c4.ts` and `validation/schemas.ts` currently encode two levels. The explicit new discriminator prevents Container creation controls or exports from interpreting internal C4 Components as deployable containers. React Flow remains an adapter.
- **Alternatives considered**: Reuse `kind: container` with a flag (ambiguous scope and type rules); invent a generic arbitrary-depth C4 engine (unneeded Code-level scope); store React Flow nodes (violates domain boundary).

### 2. Reuse storage identities and add a forward constraint migration

- **Decision**: Plan `backend/drizzle/0007_c4_component_diagrams.sql`. Retain `diagrams.parent_diagram_id`, `owner_component_id`, boundary columns, status/batch columns, and `components.source_component_id`. Replace the three named kind/scope/role CHECK constraints to admit the new level and external supporting containers. Retain the owner unique index across active and trashed rows, owner-parent composite FK, source FK and per-diagram source uniqueness. Reconcile Drizzle declarations with the SQL FKs already installed by 0005.
- **Rationale**: The current schema already stores the required graph identities. A parent-source occurrence points to its own canonical source, so no flattened source column or duplicate artifact tables are needed. SQL CHECK expressions must explicitly reject null child boundary values: PostgreSQL treats a null CHECK result as passing. Cross-row kind/owner/source rules belong in the locked service, not a cross-table CHECK.
- **Alternatives considered**: New Component-specific tables (splits existing ADR targets); rewrite applied 0005/0006 (breaks deployment history); delete/reinsert parent components on save (breaks incoming FKs); persist ancestor names as authority (rename drift).

### 3. Preserve the immediate source occurrence dependency

- **Decision**: A Component supporting occurrence's `sourceComponentId` references the participant in its immediate Container parent. For a Person/Software System, derive the canonical System Context source through that parent's existing external source. Return both immediate and canonical identities in source-context projections. Never automatically retarget the occurrence when its parent source is removed.
- **Rationale**: This implements clarification A. Canonical identity disambiguates display and navigation; immediate identity preserves the dependency the user explicitly wants. Local relationship and ADR links remain attached to the child occurrence UUID.
- **Alternatives considered**: Flatten directly to System Context (would permit the prohibited parent-occurrence removal); cascade child removal (unapproved data loss); store the full source chain redundantly (more synchronization burden).

### 4. Coordinate the complete hierarchy under its root lock

- **Decision**: Resolve the highest System Context ancestor before all diagram, ADR, source, creation, recovery and export-source operations. Acquire that root first and the affected Container/Component rows in deterministic depth/UUID order through the existing `GraphTransaction`. Rediscover membership and validate under the lock. Extend both in-memory and PostgreSQL repositories and transaction-scoped ADR writes.
- **Rationale**: Existing service/repository branches assume a general parent and one child level. Locking only a Component's immediate Container can race with System Context trash or source changes. Parent-root serialization plus the existing unique index supports idempotent create/open and complete dependency checks across levels.
- **Alternatives considered**: Lock immediate parents independently (root races); global application mutex (unnecessary contention); optimistic-only checks (insufficient for dependency deletion and exact recovery).

### 5. Retain exact trash batches and staged independent restoration

- **Decision**: Trash traversal follows active descendants to depth two and records the exact affected IDs with existing batch/root columns. A child-initiated restore previews the highest inactive required ancestor and its applicable batch. Restore that confirmed batch first; independently trashed descendants require a separate explicit restore after their ancestors are active. Re-preview whenever membership or batch identity changes.
- **Rationale**: This extends the established recovery behavior without reviving unrelated earlier trash operations. A deeply requested child may be absent from the ancestor batch; the UI must explain this through `requestedDiagramIncluded` and offer its next explicit restore after ancestor success.
- **Alternatives considered**: Restore every descendant indiscriminately (violates prior trash intent); combine independent batches invisibly (confirmation becomes misleading); activate child alone (invalid hierarchy).

### 6. Extend editor navigation and naming without replacing drafts

- **Decision**: Reuse guarded navigation, per-diagram retained drafts, child availability/loading states, owner-driven names, `BoundedHistory`, ADR stores and existing boundary geometry. Route internal containers and supporting container occurrences to Component entry; route Software Systems to existing Container entry; internal C4 Components have no deeper action. Generalize small shared helpers for scope/owner/boundary/type policy rather than duplicate the workspace.
- **Rationale**: Existing `DiagramCanvas`, `DiagramWorkspace`, `WorkspaceInspector`, `DiagramToolbar`, `diagram-store.ts` and list state already implement the requested interaction. Level-aware helpers address hardcoded `softwareSystemId` and `kind === container` assumptions. Render names before filtering/sorting, preserve newer edits during asynchronous responses, and check current dependencies before history changes remove an owner/source.
- **Alternatives considered**: Independent editor/store (duplicate guards and ADR integration); derive state from node coordinates (unstable references); use group boundaries as C4 owners (changes semantics).

### 7. Bound package traversal and preserve portable paths

- **Decision**: Browser interactive export gathers selected-entry descendants: general → Container → Component, Container → Component, Component alone. Replace depth-one membership checks and singleton `containerContext` with discriminated per-diagram source contexts. Hydrate ancestors for validation even when they are outside the package. Preserve root files, flat `diagrams/<uuid>/` member paths, shared ADR catalog/styles and script-free links. CLI and existing single-diagram builders remain selected-only saved snapshots.
- **Rationale**: `html-export-source.ts`, `html-package-snapshot.ts` and `package-links.ts` assume one level. File paths already use diagram UUIDs, so deeper semantic hierarchy requires no filesystem nesting or new package version field. Captured drafts overlay saved members by stable identity; captured ancestor/source names are reconciled throughout before validation, without any database writes.
- **Alternatives considered**: Recursive filesystem nesting (unnecessary link churn); automatically bundle parents/siblings (violates entry scope); silently skip failed required children (incomplete successful exports); change CLI recursion implicitly (breaks its established selected-only contract).

### 8. Preserve the existing REST and validation boundary

- **Decision**: Add three Component endpoints parallel to Container entry/context; extend existing load/save/list/dependency/recovery/export contracts. Keep Zod 3 shared parsing and deliberate `422` field errors, `409` conflicts, and existing success statuses. OpenAPI documents the boundary; no Swagger plugin or Zod major upgrade is required.
- **Rationale**: Current Fastify documentation supports explicit full JSON Schema for v5 route schema usage; database-dependent validation is performed by the service after payload parsing. Existing `sendError` and schema parsing are the compatibility baseline. Additive response fields must be covered by serialization tests so Component scope is never stripped.
- **Alternatives considered**: Replace the backend validation stack (unrelated migration); add new per-element write endpoints (unneeded with existing whole-document PUT); trust submitted source display fields (stale or forged metadata).

### 9. Set validation scale and operational expectations

- **Decision**: Carry the existing per-diagram envelope forward: 100 internal elements, 100 supporting occurrences and 300 relationships. Add a hierarchy fixture with 1 System Context, 3 Containers and 6 Component diagrams and linked/unlinked ADRs at each level. These are validation targets, not product caps. Record warmed local timings for layout/validation, create/open/load and full package generation; investigate median regressions over 20% against an equivalent existing Container baseline, after five warmups and twenty measured samples. Require SC-001/SC-003 usability observation separately.
- **Rationale**: Existing scale fixtures establish the per-diagram volume. A modest multi-level fixture exercises traversal and graph coordination without inventing multi-user throughput requirements. Capture browser/runtime/hardware and fixture sizes alongside timings; avoid per-occurrence database/network reads by batch hydration.
- **Alternatives considered**: Arbitrary production hard limits (not requested); asserting timing from one sample (unreliable); treating mocked/in-memory races or WebKit alone as release evidence (cannot prove database concurrency or Safari behavior).

## Documentation evidence

Context7 library resolution and documentation retrieval were performed outside the sandbox. Versions remain governed by the existing lockfile; documentation is checked for mechanisms rather than used to justify dependency upgrades.

- [Fastify v5 migration guidance](https://github.com/fastify/fastify/blob/main/docs/Guides/Migration-Guide-V5.md): full route JSON Schema requirements; [validation and lifecycle guidance](https://github.com/fastify/fastify/blob/main/docs/Reference/Lifecycle.md): validation/error handling boundary. Retrieved through `/fastify/fastify`.
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions) and [indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints): transactional repository work and named constraints. Backend research verifies the applicable mechanism; SQL/service invariants remain project decisions.
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) and [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html): CHECK null behavior, referential integrity, and deterministic transaction locks.
- [React Flow subflows](https://reactflow.dev/learn/layouting/sub-flows) and [React Flow API](https://reactflow.dev/api-reference/react-flow): visual grouping and event boundaries. Parent-node coordinate semantics must not change persisted absolute domain geometry.
- [C4 Component diagram](https://c4model.com/diagrams/component) and [Component abstraction](https://c4model.com/abstractions/component): the single-container scope and functional abstraction followed by the specification.

## Phase 0 outcome

No dependency upgrade, new runtime service, generic arbitrary-depth graph, source flattening, authentication, collaboration, or new history infrastructure is needed. All unknowns are resolved into the decisions above. Implementation and release evidence remain future work.
