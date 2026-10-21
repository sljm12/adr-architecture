# Feature Specification: Docker Deployment

**Feature**: 014-docker-deployment | **Date**: 2026-10-21 | **Status**: Implemented; container smoke passed; browser acceptance pending

## User Scenarios & Testing

### US1 — Run the complete application locally (P1)

As an operator, I can run the browser application, API, and persistent database together.
Given a clean installation, when I configure credentials, start the database, manually apply
the supplied migrations, and start the application, I can save and reopen diagrams and ADRs.
When I recreate the containers without deleting storage, saved artifacts retain their UUIDs,
references, and values.

### US2 — Use an existing database (P1)

As an operator, I can run the same application images against an existing database without
starting another database. Given a compatible database with pending migrations applied,
when I supply its connection URL, saved diagrams and ADRs remain available through the browser.

### US3 — Operate and upgrade safely (P2)

As an operator, I can inspect health and logs, back up and restore the database, stop the
application without deleting saved work, and manually apply only pending migrations before
an upgrade. Missing configuration fails clearly; migrations never execute automatically.

## Functional Requirements

- **FR-001**: Supply Docker build files and two standalone Compose configurations for US1 and US2.
- **FR-002**: Both configurations MUST use the same production frontend and API image definitions.
- **FR-003**: The bundled database MUST retain data across ordinary shutdown and container recreation.
- **FR-004**: Database credentials MUST be supplied at runtime and excluded from application images.
- **FR-005**: Database migrations MUST remain explicit operator actions; existing migrations MUST NOT be replayed automatically.
- **FR-006**: The browser MUST reach existing APIs through the same origin, including archive requests up to the existing API request limit.
- **FR-007**: Application processes MUST run without root privileges and terminate gracefully.
- **FR-008**: Default publication MUST be limited to the browser port on the local host; the API and bundled database MUST remain internal.
- **FR-009**: Document startup, database initialization, external connections, upgrades, health, logs, backup, restore, and destructive volume removal.

## Edge Cases

- Missing required credentials: configuration refuses startup and identifies the missing setting.
- Missing migrations or unavailable database: health of the process alone does not imply persistence readiness; deployment validation includes reading the saved diagram list.
- Existing database: only operator-selected pending migrations execute, with stop-on-error behavior.
- Large archives: the reverse proxy must not impose a smaller request limit than the API.
- Ordinary shutdown versus volume deletion: documentation distinguishes preserved storage from irreversible removal.
- Host database: container loopback addresses do not identify the host; document Docker Desktop host addressing.

## Success Criteria

- **SC-001**: Both deployment modes load the browser and complete diagram/ADR save and reopen workflows.
- **SC-002**: Container recreation preserves all saved identifiers and links in the bundled deployment.
- **SC-003**: Existing export and archive workflows operate through the published browser address.
- **SC-004**: Startup and shutdown execute zero schema changes; no local credentials are included in built images.
- **SC-005**: An operator can follow the documented fresh setup and existing-database setup without changing application source.

## Assumptions and Boundaries

Linux containers and Docker Compose v2 are available on the deployment host. Database schema
compatibility is the operator's responsibility. Docker is explicitly requested technology;
the product domain and persistence formats do not change. Excluded: hot reload, authentication,
CLI containers, registry publication, cloud provisioning, and public TLS termination.

## Affected Artifacts

No domain schema, SQL migration, or saved artifact changes. Validation must protect diagrams,
relationships, ADRs, component links, exports, and archive imports across the deployment boundary.
