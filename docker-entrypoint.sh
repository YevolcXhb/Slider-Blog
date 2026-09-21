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
  # 只更新本次真正缺失的键，绝不整文件覆盖。
  #
  # 旧实现用 `cat > "$CONFIG_FILE"` 重写整个文件，只写这 4 个键：一旦某些原因
  # 让 NEXTAUTH_SECRET / ADMIN_PROXY_SECRET 变空（手改文件、卷被部分清空等），
  # 容器重启就会把 /data/config.env 里其余所有键静默抹掉——而 lib/config.ts 的
  # saveConfig 是「读回 + 合并 + 写回」的增量语义，两边行为不一致会丢配置。
  #
  # 这里改为：先删掉待写键的旧行，再追加新值。写入的值本身不是自由文本
  # （AUTH_TRUST_HOST 是字面量、两个密钥是 base64、DATABASE_URL 由 setup 页拼装
  # 且经过 encodeURIComponent），因此不需要额外加引号；把整文件覆盖改成增量更新
  # 才是这里要解决的问题。
  tmp="${CONFIG_FILE}.tmp"
  if [ -f "$CONFIG_FILE" ]; then
    # grep 无匹配时退出码为 1，用 || true 兜住 set -e
    grep -v -E '^(AUTH_TRUST_HOST|NEXTAUTH_SECRET|ADMIN_PROXY_SECRET|DATABASE_URL)=' \
      "$CONFIG_FILE" > "$tmp" || true
  else
    : > "$tmp"
  fi
  echo "AUTH_TRUST_HOST=$AUTH_TRUST_HOST" >> "$tmp"
  echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> "$tmp"
  echo "ADMIN_PROXY_SECRET=$ADMIN_PROXY_SECRET" >> "$tmp"
  if [ -n "$DATABASE_URL" ]; then
    echo "DATABASE_URL=$DATABASE_URL" >> "$tmp"
  fi
  mv "$tmp" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE" 2>/dev/null || true
fi

# 把 /data/config.env 里的变量真正注入 node server.js 的环境。
# ⚠ AUTH_COOKIE_SECURE 必须在这里显式列出：上面第 9-11 行的 `. "$CONFIG_FILE"` 只是
# 把文件 source 进**当前 shell**，若不再 export，子进程（node server.js）根本
# 看不到它，写在 /data/config.env 里的开关会静默失效，表现为「明明配了却还是
# MissingCSRF」—— 排查成本极高。它同时也保证了 Next.js 路由与 Edge 中间件
# （src/proxy.ts 同样读这个变量推导 session cookie 名）读到同一个值，
# 不会出现「登录成功但中间件认为未登录」的跳转循环。
# 注意：它不该被自动生成，也不在上面那组「会被重新生成/覆盖」的键里 ——
# 这是管理员显式可选的逃生舱，未设置时 resolveUseSecureCookies() 走 NODE_ENV 默认分支。
export AUTH_TRUST_HOST NEXTAUTH_SECRET ADMIN_PROXY_SECRET DATABASE_URL AUTH_COOKIE_SECURE
# 提供 prisma CLI（migrate deploy 迁移），安装在独立前缀目录
export PATH="/opt/runtime/node_modules/.bin:$PATH"

# 兜底：数据库已配置但从未建过表时应用迁移（正常流程由 setup 页面完成）
# 生产只允许 prisma migrate deploy（按 prisma/migrations 有序应用、有记录、可回滚），
# 禁止使用 prisma db push：它不做变更审计，且可能执行破坏性变更。
if [ -n "$DATABASE_URL" ] && [ ! -f /data/.schema-ready ]; then
  echo "[entrypoint] Applying database migrations (prisma migrate deploy, first run)..."
  if command -v timeout >/dev/null 2>&1; then
    if timeout 60 prisma migrate deploy; then
      touch /data/.schema-ready
    else
      echo "[entrypoint] prisma migrate deploy failed; will retry on next start."
    fi
  else
    if prisma migrate deploy; then
      touch /data/.schema-ready
    else
      echo "[entrypoint] prisma migrate deploy failed; will retry on next start."
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
