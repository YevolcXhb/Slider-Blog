# syntax=docker/dockerfile:1

# =============================================================================
# Slider 单一体镜像
#   - 前台：Next.js standalone 服务（端口 4000）
#   - 管理端：admin-proxy.mjs 代理（端口 4100，转发到容器内 4000）
#   - 数据库：需外部 MySQL/MariaDB（见 docker-compose.yml）
#
# 构建参数（可选，但生产建议提供，用于生成正确的客户端内联值与 SSG 内容）：
#   DATABASE_URL          构建期 SSG 查库用（无数据库时构建靠 safeDbQuery 兜底）
#   NEXT_PUBLIC_SITE_URL  内联到客户端 bundle
#   NEXT_PUBLIC_SENTRY_DSN 内联到客户端 bundle（可选）
# =============================================================================

# ---- 依赖安装阶段 ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 构建阶段 ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 构建期环境（由 --build-arg / compose build.args 注入）
ARG DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
# 构建期若未注入 DATABASE_URL，使用占位 URL 保证 Prisma 客户端可实例化。
# 真正连接发生在容器启动时（由 docker-compose / 用户环境变量注入）。
ENV DATABASE_URL=${DATABASE_URL:-mariadb://build:build@build.invalid:3306/build} \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- 运行阶段 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Next.js standalone 产物：server.js + 精简 node_modules
# （自动包含 mariadb、@prisma/client、sharp 等 server 运行时依赖），
# 不再全量重装依赖，镜像体积大幅减小。
COPY --from=builder /app/.next/standalone/ ./
# 客户端静态资源（standalone/.next 不含 static，需单独复制）
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma 生成的 client（standalone tracing 未必收录 .prisma 生成物）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 仅额外安装运行时需要的工具：prisma CLI（db push 迁移）、http-proxy（管理端代理）、
# dotenv（prisma.config.ts 加载 .env 用）。
# 允许 prisma postinstall 下载 schema-engine 二进制（依赖树中不含 sharp，无 127 风险）。
# --no-save 不写入 package.json，--package-lock=false 不生成 lockfile。
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-save --package-lock=false prisma@7.9.1 http-proxy@1.18.1 dotenv

# 管理端代理与启动脚本
COPY admin-proxy.mjs ./admin-proxy.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# 非 root 运行
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 4000 4100
ENV PORT=4000

ENTRYPOINT ["./docker-entrypoint.sh"]
