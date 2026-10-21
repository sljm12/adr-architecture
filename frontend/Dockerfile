# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json ./
COPY shared ./shared
COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 NGINX_ENVSUBST_FILTER=^NGINX_LOCAL_RESOLVERS$
COPY --chown=nginx:nginx docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
