# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json ./
COPY shared ./shared
COPY backend ./backend
RUN npm run build:api

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/build/server.mjs ./server.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "--input-type=module", "-e", "const r = await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(4000) }); if (!r.ok) process.exit(1)"]
CMD ["node", "server.mjs"]
