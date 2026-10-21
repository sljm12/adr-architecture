# Docker Deployment Acceptance

Follow [the operating guide](../../docs/docker.md) for exact setup commands. Use disposable
databases with no valuable data. Docker builds and schema/persistence checks require Docker
Engine/Desktop, Compose v2.20+, and the relevant database connectivity.

## Bundled mode

1. Configure `.env.docker`, validate Compose, and start only `db`. Confirm the application tables
   do not exist before the explicit migration step; startup must not apply SQL.
2. Apply migrations 0001–0009 once, then build/start the remaining services with `--wait`.
3. Check `/healthz`, `/api/health`, and `/api/diagrams`. Confirm API requests return JSON rather
   than the frontend fallback document. Verify query strings and unknown API paths retain API responses.
4. Save a diagram with linked components, a relationship, and ADR. Reload and confirm references.
5. Export Mermaid/HTML and export/import a disposable diagram archive through the proxy. Check
   filenames/content types. Include a valid archive larger than 1 MiB (below 8 MiB), and an
   over-limit envelope that must receive 413 rather than fallback HTML.
6. Run ordinary `down`, then `up -d --wait`. Confirm saved IDs, positions, metadata, links, and
   ADRs are unchanged, and no migration executes during restart.
7. Recreate only `api`; after Docker DNS refresh, verify the proxy reaches the replacement.
8. Verify `docker compose ... exec -T api id -u` and the same for `frontend` are nonzero.
   Inspect published ports: only frontend is exposed to the host. Check runtime image contents
   for absent `.env` files, SQL dumps, and development sources.
9. Back up and restore to a separate recovery database using the guide. Inspect artifact values.

## Existing-database mode

1. Prepare a separate disposable PostgreSQL with migrations applied and a known saved fixture.
2. Configure `.env.docker.external`, validate the external Compose file, and start it independently.
   Confirm it starts only frontend/API and creates no database service/volume.
3. Repeat save/reopen, ADR linking, export, archive, process-user, and published-port checks.
4. Test a database on the Docker Desktop host using `host.docker.internal`, or a remote managed
   database using the provider's required TLS configuration.
5. In a disposable installation, omit DATABASE_URL: Compose validation must fail clearly.
   Try an unavailable database or an empty unmigrated database: `/api/diagrams` must fail without
   creating tables or changing saved data. `/api/health` remains process health only.

## Shutdown and upgrades

1. Observe a SIGTERM-driven API shutdown and confirm the process exits within 30 seconds without
   forced killing; repeat with SIGINT on a Linux container.
2. Start a disposable database at migration 0008; record saved artifact values, stop application
   writers, apply only 0009, and start the new image. Confirm saved content and IDs remain.
3. Never use `down --volumes` or restore over a valuable database as part of these checks.

## Developer verification

Run `npm ci`, `npm run lint`, `npm test`, and `npm run build`. New lifecycle tests verify that
closing Fastify closes the database pool exactly once and startup failure releases it. Validate
the production ESM entrypoint independently from the development TypeScript runtime. Record
actual execution and unavailable scenarios in validation.md.
