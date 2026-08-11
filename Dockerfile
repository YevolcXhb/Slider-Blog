# syntax=docker/dockerfile:1

# =============================================================================
# Slider Blog single-image build
#   - Frontend: Next.js standalone server (port 4000)
#   - Admin:    admin-proxy.mjs (port 4100 -> 127.0.0.1:4000)
#   - Database: external MySQL/MariaDB, configured at first run via /zh/setup
# =============================================================================

# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN

ENV DATABASE_URL=${DATABASE_URL:-mariadb://build:build@build.invalid:3306/build} \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output: server.js + traced node_modules (includes next)
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma generated client (not always captured by standalone tracing)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Runtime tools: prisma CLI (db push), http-proxy (admin proxy), dotenv (prisma config).
# Installing with package.json present keeps the full production dependency tree
# (including the `next` package required by server.js).
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-save --package-lock=false --no-audit --no-fund prisma@7.9.1 http-proxy@1.18.1 dotenv

# Admin proxy and entrypoint
COPY admin-proxy.mjs ./admin-proxy.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Non-root user and persistent config volume
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && chown -R nextjs:nodejs /app \
    && mkdir -p /data && chown -R nextjs:nodejs /data
VOLUME ["/data"]
USER nextjs

EXPOSE 4000 4100
ENV PORT=4000

ENTRYPOINT ["./docker-entrypoint.sh"]
