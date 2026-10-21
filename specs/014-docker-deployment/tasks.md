# Tasks: Docker Deployment

## Setup

- [x] T001 Record approved requirements/design and activate specs/014-docker-deployment in .specify/feature.json.

## Foundations

- [x] T002 Add shutdown regression tests in backend/tests/server-lifecycle.test.ts.
- [x] T003 Add the production API bundle script/dependency in package.json and package-lock.json, and lifecycle handling in backend/src/server.ts.
- [x] T004 Add backend/Dockerfile, frontend/Dockerfile, docker/nginx.conf, and production context exclusions in .dockerignore.

## US1 — Bundled database

- [x] T005 [US1] Add compose.yaml and docker/.env.bundled.example with persistent PostgreSQL, health checks, and manual migration access.
- [x] T006 [US1] Document fresh initialization, pending migration selection, backup/restore, and persistence validation in docs/docker.md.

## US2 — Existing database

- [x] T007 [US2] Add compose.external-db.yaml and docker/.env.external.example using the same application images.
- [x] T008 [US2] Document external database/TLS/host networking and verification in docs/docker.md.

## US3 — Operations and verification

- [x] T009 [US3] Add container acceptance scenarios in specs/014-docker-deployment/quickstart.md and link Docker instructions from README.md.
- [x] T010 Run lint, tests, builds, and executable bundle smoke checks; record results and any unavailable Docker validation in specs/014-docker-deployment/validation.md.

## Dependencies and Strategy

T001 precedes foundations; T002 precedes T003. T004 follows T003. US1 and US2 then share images
and can be validated independently. T009/T010 complete the cross-cutting operating instructions.
T005/T007 are independent configuration work after foundations; no parallel agents are required.
