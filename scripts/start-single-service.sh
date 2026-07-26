#!/usr/bin/env sh
set -eu

export PORT="${PORT:-8080}"
export APP_PORT="${APP_PORT:-8000}"

mkdir -p /run/nginx
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

cd /app

cd /app/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${APP_PORT}" &
BACKEND_PID=$!

cd /app
pnpm --dir frontend exec next start --hostname 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

nginx -g 'daemon off;'
