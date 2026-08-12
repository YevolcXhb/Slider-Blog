#!/bin/sh
set -e

CONFIG_FILE="/data/config.env"
RESTART_GUARD="${RESTART_GUARD:-3}"
RESTART_WINDOW="${RESTART_WINDOW:-5}"

# 1. 加载持久化配置（若存在）
if [ -f "$CONFIG_FILE" ]; then
  . "$CONFIG_FILE"
fi

# 2. 自动生成缺失密钥并持久化，用户无需手动配置环境变量
changed=0
if [ -z "$AUTH_TRUST_HOST" ]; then
  AUTH_TRUST_HOST=true
  changed=1
fi
if [ -z "$NEXTAUTH_SECRET" ]; then
  NEXTAUTH_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")
  changed=1
fi
if [ -z "$ADMIN_PROXY_SECRET" ]; then
  ADMIN_PROXY_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")
  changed=1
fi
if [ "$changed" -eq 1 ]; then
  umask 077
  mkdir -p "$(dirname "$CONFIG_FILE")"
  cat > "$CONFIG_FILE" <<EOF
AUTH_TRUST_HOST=$AUTH_TRUST_HOST
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ADMIN_PROXY_SECRET=$ADMIN_PROXY_SECRET
DATABASE_URL=$DATABASE_URL
EOF
fi

export AUTH_TRUST_HOST NEXTAUTH_SECRET ADMIN_PROXY_SECRET DATABASE_URL
# 提供 prisma CLI（db push 迁移），安装在独立前缀目录
export PATH="/opt/runtime/node_modules/.bin:$PATH"

# 兜底：数据库已配置但从未建过表时补一次建表（正常流程由 setup 页面完成）
if [ -n "$DATABASE_URL" ] && [ ! -f /data/.schema-ready ]; then
  echo "[entrypoint] Applying database schema (prisma db push, first run)..."
  if command -v timeout >/dev/null 2>&1; then
    if timeout 60 prisma db push --skip-generate; then
      touch /data/.schema-ready
    else
      echo "[entrypoint] prisma db push failed; will retry on next start."
    fi
  else
    if prisma db push --skip-generate; then
      touch /data/.schema-ready
    else
      echo "[entrypoint] prisma db push failed; will retry on next start."
    fi
  fi
fi

echo "[entrypoint] Starting Next.js on port ${PORT:-4000}..."
PORT="${PORT:-4000}" node server.js &
APP_PID=$!

echo "[entrypoint] Starting admin proxy on port ${ADMIN_PROXY_PORT:-4100}..."
ADMIN_PROXY_PORT="${ADMIN_PROXY_PORT:-4100}" \
ADMIN_PROXY_TARGET="${ADMIN_PROXY_TARGET:-http://127.0.0.1:4000}" \
node admin-proxy.mjs &
PROXY_PID=$!

shutdown() {
  kill "$APP_PID" "$PROXY_PID" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

# 等待应用进程；数据库配置保存后会以 0 退出，容器据此重启并加载新配置
wait "$APP_PID"
APP_EXIT=$?

if [ "$APP_EXIT" -ne 0 ]; then
  # 崩溃循环保护：仅统计非零退出，避免配置重启被误判
  GUARD_FILE="${CONFIG_FILE}.restart"
  now=$(date +%s)
  tmp="${GUARD_FILE}.tmp"
  : > "$tmp"
  if [ -f "$GUARD_FILE" ]; then
    while IFS= read -r ts; do
      [ -n "$ts" ] && [ $((now - ts)) -lt "$RESTART_WINDOW" ] && echo "$ts" >> "$tmp"
    done < "$GUARD_FILE"
  fi
  echo "$now" >> "$tmp"
  mv "$tmp" "$GUARD_FILE"
  count=$(wc -l < "$GUARD_FILE" | tr -d ' ')
  if [ "$count" -ge "$RESTART_GUARD" ]; then
    echo "[entrypoint] Too many restarts in ${RESTART_WINDOW}s, stopping." >&2
    exit 1
  fi
fi

exit "$APP_EXIT"
