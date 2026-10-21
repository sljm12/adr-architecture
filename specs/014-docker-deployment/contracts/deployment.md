# Deployment Contract

| Mode | Configuration | Required setting | Services |
| --- | --- | --- | --- |
| Bundled | compose.yaml | POSTGRES_PASSWORD | frontend, api, db |
| Existing database | compose.external-db.yaml | DATABASE_URL | frontend, api |

Both modes build the same frontend/API Dockerfiles from the repository root. WEB_PORT defaults
to 8080 and HOST_BIND defaults to 127.0.0.1. The API listens internally on 3000, the frontend on
8080, and the bundled PostgreSQL on 5432. Only the frontend is published.

The frontend maps /api/<path> to API /<path>, preserving query strings, status, content type,
and download headers. Requests up to the existing 24 MiB API body limit pass the proxy.
/healthz checks the static server; /api/health checks the API process; /api/diagrams checks
database/schema access. Missing database settings fail Compose interpolation. No container
startup or shutdown command runs migrations. Ordinary Compose down retains the database volume.
