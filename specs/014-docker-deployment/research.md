# Research: Docker Deployment

- **Decision**: Separate production frontend/API images, shared by two standalone Compose files.
  **Rationale**: Supports bundled and existing databases without conditional interpolation or mixing processes.
  **Alternative**: A single application image adds process supervision and couples independent runtimes.
- **Decision**: esbuild ESM bundle with external npm packages.
  **Rationale**: Resolves existing extensionless/local shared imports while preserving Node package behavior and import.meta.url.
  **Alternative**: Rewrite imports throughout backend/shared or ship TypeScript and a runtime transpiler.
- **Decision**: Manual migrations and an explicit read-only SQL mount.
  **Rationale**: User selected manual migrations; no existing ledger can safely infer applied files.
  **Alternative**: Automatic migrations would require baseline tracking and additional consent/configuration.
- **Decision**: Non-root production processes, process-health checks, separate saved-list readiness validation.
  **Rationale**: Retains the existing /health contract and avoids claiming a listening API proves schema compatibility.

Sources checked with Context7: [Docker React guide](https://docs.docker.com/guides/reactjs/),
[Docker Node guide](https://docs.docker.com/guides/nodejs/),
[Compose dependencies](https://docs.docker.com/compose/how-tos/startup-order/),
[esbuild packages](https://esbuild.github.io/api/#packages).

Live validation with standalone docker-compose against a Podman-compatible engine exposed
that Docker's hard-coded 127.0.0.11 resolver does not apply to every engine. The frontend now
uses the image's supported NGINX_ENTRYPOINT_LOCAL_RESOLVERS hook and envsubst template to
read /etc/resolv.conf at startup. Only NGINX_LOCAL_RESOLVERS is substituted; request variables
stay intact. The generated configuration is writable by nginx, preserving a non-root runtime.
Confirmed against the shipped entrypoint scripts and the
[official resolver hook documentation](https://github.com/nginx/docker-nginx/blob/master/_autodocs/api-reference/15-local-resolvers.md).
