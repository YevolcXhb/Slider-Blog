#!/bin/sh
set -e

if [ -z "${ADMIN_PROXY_SECRET}" ]; then
  echo "[entrypoint] ADMIN_PROXY_SECRET is required to start the admin proxy." >&2
  exit 1
fi

echo "[entrypoint] Starting Next.js frontend on port ${PORT:-4000}..."
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

wait
