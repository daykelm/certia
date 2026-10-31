# A single image for the API (which also serves the frontend), the worker and migrations.
# The mode is selected with APP_MODE=api | worker | migrate.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# --- Dependencies and build ---
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/adapters/package.json packages/adapters/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/measures/package.json packages/measures/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm measures:check && pnpm build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --offline

# --- Runtime image ---
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    MEASURES_DIR=/app/packages/measures/definitions \
    MIGRATIONS_DIR=/app/packages/db/migrations \
    WEB_DIR=/app/apps/web/dist
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/measures/definitions ./packages/measures/definitions
COPY --from=build /app/packages/db/migrations ./packages/db/migrations
COPY docker/start.mjs ./start.mjs
USER node
EXPOSE 8080
CMD ["node", "start.mjs"]
