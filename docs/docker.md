# Run ADR Diagram with Docker

Use Linux containers with Docker Engine/Desktop (or a compatible engine) and Docker Compose
v2.20 or later. Commands use the standalone `docker-compose` executable; Docker CLI plugin
users can substitute `docker compose`. Run commands from the repository root. Node.js is not
required on the host. Both setups build the same production images: static Vite assets served
by unprivileged Nginx, and a Node.js 24 API.

| Setup | Compose file | Runtime configuration |
| --- | --- | --- |
| Application and PostgreSQL 17 | `compose.yaml` | `.env.docker` |
| Application and an existing PostgreSQL | `compose.external-db.yaml` | `.env.docker.external` |

Choose one setup per installation. These are standalone files; do not combine them with `-f`.
Both use the project name `adr-diagram` and default to <http://127.0.0.1:8080>. For independent
installations, use a different `-p` project name and `WEB_PORT` on every command for each instance.

## Start with bundled PostgreSQL

Copy `docker/.env.bundled.example` to `.env.docker` and replace `POSTGRES_PASSWORD` with a long
random password containing only letters, digits, hyphens, or underscores. This password is
also interpolated into a connection URL, so other characters require a different configuration.
Do not commit the resulting environment file. The bundled database and user are `adr_diagram`.

```text
docker-compose --env-file .env.docker config --quiet
docker-compose --env-file .env.docker up -d --wait db
```

**On a new, empty database only**, manually apply all nine migrations in lexical order. The
following command works from PowerShell and POSIX shells; the loop runs inside the container.
`ON_ERROR_STOP` and `sh -e` stop on the first failure. SQL files are mounted read-only at
`/migrations`; they are never run by PostgreSQL initialization or application startup.

```sh
docker-compose --env-file .env.docker exec -T db sh -ec 'for file in /migrations/*.sql; do psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$file"; done'
```

Do not rerun that loop against an initialized database, including after a partially failed
attempt. There is no migration tracker. Inspect the database and the error, record which files
succeeded, and apply only the missing files after resolving the cause. Do not assume a failed
file rolled back completely: not every historical migration wraps itself in a transaction.

Once migrations have succeeded:

```text
docker-compose --env-file .env.docker up -d --build --wait
docker-compose --env-file .env.docker ps
```

Open <http://127.0.0.1:8080>. Verify <http://127.0.0.1:8080/api/diagrams> returns a JSON array,
then create, save, and reopen a diagram. API health does not check the database schema, so
`--wait` alone does not establish database readiness.

## Start with an existing PostgreSQL database

Back up the database and apply **only pending** SQL files from `backend/drizzle/` in order using
your existing migration process. The current application requires migrations through
`0009_diagram_archive.sql`. Use `psql -v ON_ERROR_STOP=1` for each file. Record applied migrations
outside the application; Docker does not infer their status or change the schema automatically.

Copy `docker/.env.external.example` to `.env.docker.external` and set `DATABASE_URL` to the
database's connection URL. Percent-encode reserved characters in its username/password; retain
the database provider's required TLS settings. Compose environment files interpolate `$` in
unquoted values: use a single-quoted value for a literal URL containing dollar signs.

- Remote/managed PostgreSQL: use its reachable hostname, database, credentials, and provider
  connection options. Allow connectivity from the Docker host in the database firewall.
- PostgreSQL on the Docker Desktop host: use `host.docker.internal`, not `localhost`. The
  external Compose file also maps this name to the host gateway on Linux Engine. PostgreSQL
  must listen on an interface reachable from Docker and permit that client in `pg_hba.conf`.
- TLS: use the provider's documented `sslmode`/certificate requirements. If a connection URL
  references a CA file, mount that file read-only into the API using an explicit Compose
  override and reference its **container** path. Never bake credentials/private keys into an
  image or disable certificate verification as a workaround.

```text
docker-compose --env-file .env.docker.external -f compose.external-db.yaml config --quiet
docker-compose --env-file .env.docker.external -f compose.external-db.yaml up -d --build --wait
docker-compose --env-file .env.docker.external -f compose.external-db.yaml ps
```

Verify <http://127.0.0.1:8080/api/diagrams> and save/reopen a diagram as above. This configuration
starts only `frontend` and `api`; it creates no PostgreSQL service or database volume.

## Ports, health, and logs

Only the browser port is published, defaulting to `127.0.0.1:8080`. Set `WEB_PORT` to change the
port. Set `HOST_BIND` to a deliberate network interface for a server deployment; public HTTPS
belongs on a hosting reverse proxy. The application has no authentication, so choose network
exposure appropriate to its existing single-user model.

The frontend listens internally on 8080, API on 3000, and bundled database on 5432. The database
and API are reachable between services on the Compose network without host port mappings.
Requests to `/api/` have that prefix stripped before reaching existing API routes. The proxy
allows the archive routes' 24 MiB request envelopes and preserves download headers.
Nginx reads the container's actual DNS resolvers at startup, supporting Docker and Podman
networks and refreshing API addresses after container recreation.

| Check | Meaning |
| --- | --- |
| `/healthz` | Static web server is responding |
| `/api/health` | API process is responding; no database query |
| `/api/diagrams` | Saved-list API can query the database with the expected schema |

For bundled mode:

```text
docker-compose --env-file .env.docker logs --tail=100 api frontend db
docker-compose --env-file .env.docker logs -f api
```

For external mode, use `--env-file .env.docker.external -f compose.external-db.yaml` and omit
`db`. A missing required setting fails Compose validation. Database connection/schema failures
appear when reading saved data; check the URL, TLS/network permissions, and applied migrations.
To inspect health-check failures use `docker inspect` on the container reported by `compose ps`.
Do not share unredacted `compose config` output: without `--quiet` it includes credentials.

## Stop, restart, and upgrade

```text
docker-compose --env-file .env.docker down
docker-compose --env-file .env.docker up -d --wait
```

Ordinary `down` retains the bundled named volume. An unchanged restart requires no migrations.
API termination drains Fastify and closes its PostgreSQL pool; Compose allows 30 seconds before
forced termination. Frontend and API runtime processes run as non-root users.

For an upgrade, back up first, stop application writers, and apply only pending migrations
before starting the new runtime. For example, an installation already at 0008 can apply 0009:

```sh
docker-compose --env-file .env.docker stop frontend api
docker-compose --env-file .env.docker exec -T db sh -ec 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /migrations/0009_diagram_archive.sql'
docker-compose --env-file .env.docker build --pull
docker-compose --env-file .env.docker up -d --wait
```

Use the external Compose arguments and your database migration tooling for external mode.
Check `/api/diagrams` and representative save/reopen/export workflows after the upgrade.
Do not downgrade the PostgreSQL major version or attach its volume to another major version.
Base images are pinned to a Node/PostgreSQL major or Nginx release line; `build --pull` refreshes
application base images. Bundled PostgreSQL patch updates require an explicit `pull db` and
database recreation during a planned maintenance window. Use image digests in a deployment
override if your release process requires immutable base-image versions.

Changing `POSTGRES_PASSWORD` in the environment does not change the password in an existing
PostgreSQL volume. Rotate it in PostgreSQL through your database administration process, update
the environment file to match, and recreate API/database containers.

## Back up and restore bundled PostgreSQL

Use a fresh backup filename and keep a copy outside this checkout. These commands avoid piping
a binary custom-format dump through PowerShell redirection. First create a `backups` directory
if it does not exist. Dumps and this directory are excluded from Git and Docker build contexts.

```sh
docker-compose --env-file .env.docker exec -T db sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/adr-diagram.dump'
docker-compose --env-file .env.docker cp db:/tmp/adr-diagram.dump backups/adr-diagram.dump
docker-compose --env-file .env.docker exec -T db rm /tmp/adr-diagram.dump
```

Before restoring, verify the backup and explicitly choose the destination. Prefer a separate
fresh database to verify recovery. The following creates a separate recovery database without
changing the application's existing database. Replace `adr_diagram_recovery` if it already exists.

```sh
docker-compose --env-file .env.docker cp backups/adr-diagram.dump db:/tmp/adr-diagram.dump
docker-compose --env-file .env.docker exec -T db sh -ec 'createdb -U "$POSTGRES_USER" adr_diagram_recovery'
docker-compose --env-file .env.docker exec -T db sh -ec 'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d adr_diagram_recovery /tmp/adr-diagram.dump'
docker-compose --env-file .env.docker exec -T db rm /tmp/adr-diagram.dump
```

Inspect the recovered database before a deliberate cutover. Use your provider's backup and
restore process for an external database. Diagram archives complement database backups but do
not replace them.

**Destructive removal:** `docker-compose --env-file .env.docker down --volumes` permanently
deletes this Compose project's bundled database volume and all saved diagrams/ADRs. Ordinary
shutdown does not require this flag. Only remove the volume after explicitly deciding to discard
the installation and verifying recovery from a separate backup.

## Build and acceptance checks

```text
docker-compose --env-file .env.docker build
docker-compose --env-file .env.docker.external -f compose.external-db.yaml build
```

Image builds use the root lockfile with `npm ci`; the API runtime contains its ESM bundle and
production dependencies, while the frontend runtime contains only static assets and Nginx.
Neither image includes local environment files, database dumps, or source credentials.
Host-installed Node.js is needed only for the repository's lint/tests/build developer checks.
See [deployment acceptance scenarios](../specs/014-docker-deployment/quickstart.md) and
[recorded validation](../specs/014-docker-deployment/validation.md).
