# Docker Deployment Validation

**Date**: 2026-10-21 | **Host**: Windows, Node.js 22.18.0; production smoke: Node.js 24.22.0

## Executed

| Check | Result |
| --- | --- |
| Spec Kit feature resolution/prerequisites | PASS; active feature is 014-docker-deployment; requirements checklist 7/7 |
| New lifecycle regression before implementation | FAIL as expected: closing Fastify did not close its pool |
| New lifecycle/config tests after implementation | PASS: 5 tests across 2 files |
| `npm run lint` | PASS |
| `npm run build` | PASS: shared/backend type checks, API ESM bundle, Vite frontend, CLI |
| Production-only clean lockfile install | PASS: `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` in an isolated directory, 111 packages |
| Production bundle on Node.js 24.22.0 | PASS: runtime HTTP `/health`, required DATABASE_URL failure, pool closed on shutdown, and SIGTERM/SIGINT handler execution |
| Compose YAML parsing and topology | PASS: both files parse; same image build definitions; only frontend publishes a port; bundled volume/migration mount present; external setup has no db service |
| Standalone `docker-compose` v5.6.0 | PASS: official Windows executable downloaded locally and verified against its published SHA256 |
| `docker-compose ... config --quiet` | PASS: bundled and existing-database configurations using the committed example environment files |
| `docker-compose ... build` | PASS: both production images built against the reachable Podman Docker-compatible engine |
| Bundled initialization and startup | PASS: fresh PostgreSQL contained zero public tables; migrations 0001–0009 applied explicitly with ON_ERROR_STOP; all three services healthy |
| External database mode | PASS: separate two-service project reused the provisioned test PostgreSQL over an explicit test-only network override; no database service started by external mode |
| Live HTTP/persistence checks | PASS: static page, SPA fallback, process health, saved diagram/relationship writes and reload, linked ADR creation and cross-instance reload, Mermaid download headers, HTML export source |
| Archive proxy checks | PASS: archive export, valid preview larger than 1 MiB, and oversized 24 MiB-plus envelope returning 413 |
| Container recreation | PASS: ordinary down/up retained identical diagram, component, relationship, ADR, and link values/UUIDs without replaying migrations |
| Runtime configuration/users | PASS: `nginx -t`; frontend UID 101 and API UID 1000; only frontend published (test ports 18080/18081) |
| `git diff --check` | PASS |

The API smoke directory contained only the bundle, manifests, and production dependencies,
with no TypeScript sources, tsx, or TypeScript compiler. SIGTERM/SIGINT handlers were exercised
with Node process events in child processes. Live Compose shutdown also completed normally
within its grace period. No database connection is needed for process-health checks.

## Existing full-suite failures

`npm test`: **972 passed, 220 skipped, 14 failed** across 167 files (143 passed, 20 skipped,
4 failed). All 14 failures are in existing OpenAPI/Ajv deletion-contract assertions:

- `shared/tests/diagram-deletion-collection-validation.test.ts`: 1 failure.
- `backend/tests/contract/diagram-deletion.test.ts`: 5 failures.
- `backend/tests/contract/diagram-deletion-all-matches.test.ts`: 7 failures.
- `backend/tests/contract/diagram-deletion-clear-trash.test.ts`: 1 failure.

The same four test files were run against an isolated archive of unchanged Git HEAD using
the same installed dependencies: **the same 14 failures**, with 45 passing tests. This
establishes the failures also exist without this feature. The installed root Ajv is 6.15.0;
the failed checks involve existing nullable scope fields. No unrelated schemas/tests or
dependency versions were changed to address them. Skipped database tests are not evidence
of database correctness.

## Standalone Compose validation and remaining acceptance

The initial session had no Docker CLI on PATH. At the user's request, standalone
`docker-compose` v5.6.0 was downloaded from the official release into the ignored
`node_modules/.docker-compose-validation/` directory and checksum-verified. Engine access
requires execution outside the sandbox; the reachable Windows pipe serves a Podman-compatible
engine. Both configurations passed real Compose validation, image builds, and live HTTP tests.

The live test found the frontend's hard-coded Docker DNS resolver was incompatible with Podman.
The frontend now renders its resolver from /etc/resolv.conf using the official Nginx entrypoint
hook, with a substitution allowlist that preserves request variables and non-root file ownership.
The rebuilt image passed all recorded HTTP checks and startup on a recreated network.

Validation used only isolated projects `adr-diagram-compose-validation` and
`adr-diagram-compose-external-validation` with generated credentials. External mode connected
to the first project's existing database through an explicit test-only external network override;
no user's existing database was accessed. Both test projects were brought down after validation.
The disposable `adr-diagram-compose-validation_postgres-data` volume is retained; no volume
deletion command was run. Built images remain cached locally.

Still pending: interactive browser acceptance, managed PostgreSQL TLS/host database scenarios,
archive import commit/recovery through the browser, complete HTML ZIP browser downloads,
backup/restore, upgrade from 0008, and explicit SIGINT delivery to a running Linux container.
Follow quickstart.md for those scenarios; the HTTP smoke tests do not establish their acceptance.

The initial root `npm ci` encountered a Windows-locked Rollup binary after removing dependencies.
Dependencies were restored using `npm install --package-lock=false`; no existing Node processes
were stopped. Lint/build/tests above then ran successfully as recorded, apart from the baseline
failures. The isolated production clean install succeeded without that file-lock limitation.
Vite reports its existing large-chunk advisory; the production build completes successfully.
