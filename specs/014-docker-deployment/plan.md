# Implementation Plan: Docker Deployment

## Technical Context

The repository has one root package-lock.json and root dependencies, not npm workspaces.
Vite serves the frontend; Fastify listens on 0.0.0.0 and requires DATABASE_URL. Current TypeScript
output retains extensionless imports and shared source references. Nine ordered SQL migrations
are applied manually and have no applied-migration ledger.

## Design

- Build the API as a Node.js 24 ESM bundle using esbuild, leaving npm packages external. Retain TypeScript checks and existing development commands.
- Build Vite assets and serve them with unprivileged Nginx on 8080; strip /api/ for proxy requests and permit 24 MiB request bodies.
- Provide separate root-context multi-stage Dockerfiles and standalone bundled/external Compose files. Install from the root lockfile; run production processes without root.
- Use PostgreSQL 17 and a named volume in bundled mode; require a runtime DATABASE_URL in external mode. Publish only 127.0.0.1:8080 by default.
- Keep migrations entirely manual. Mount SQL read-only in the bundled database for explicit psql commands, never as initialization scripts.
- Close the PostgreSQL pool on Fastify shutdown and handle SIGTERM/SIGINT only in the executable entrypoint.

## Interfaces

Environment: POSTGRES_PASSWORD (bundled), DATABASE_URL (external), HOST_BIND and WEB_PORT (both,
default 127.0.0.1 and 8080). Existing REST routes and /health process-health semantics remain.
Use GET /api/diagrams for a non-mutating persistence readiness check. No schema migration.

## Constitution Check

PASS: Domain artifacts and stable references remain unchanged. Manual migrations and persistent
volumes protect data. No additional product capabilities. Tests target shutdown and executable
production output; deployment acceptance checks artifact persistence and proxy behavior.

## Validation

Run lint, unit/contract tests, root production build, bundled entrypoint smoke checks, and both
Compose builds/configuration checks where Docker is available. Exercise the quickstart in both
database modes, including persistence, archives, external database failure, and clean shutdown.
Record unavailable checks honestly in validation.md rather than marking them passed.
