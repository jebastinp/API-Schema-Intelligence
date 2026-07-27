#!/usr/bin/env sh
set -eu

export PORT="${PORT:-8080}"
export APP_PORT="${APP_PORT:-8000}"

mkdir -p /run/nginx
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

cd /app

cd /app/backend
"${VIRTUAL_ENV:-/opt/venv}/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port "${APP_PORT}" &
BACKEND_PID=$!

cd /app
NEXT_SERVER_PATH="/app/frontend/server.js"
if [ ! -f "${NEXT_SERVER_PATH}" ] && [ -f "/app/frontend/frontend/server.js" ]; then
  NEXT_SERVER_PATH="/app/frontend/frontend/server.js"
fi

NEXT_SERVER_DIR=$(dirname "${NEXT_SERVER_PATH}")
cd "${NEXT_SERVER_DIR}"
HOSTNAME=0.0.0.0 PORT=3000 node ./server.js &
FRONTEND_PID=$!

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

nginx -g 'daemon off;' &
NGINX_PID=$!

EXIT_CODE=0
while true; do
  if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
    wait "${BACKEND_PID}" || EXIT_CODE=$?
    break
  fi

  if ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    wait "${FRONTEND_PID}" || EXIT_CODE=$?
    break
  fi

  if ! kill -0 "${NGINX_PID}" 2>/dev/null; then
    wait "${NGINX_PID}" || EXIT_CODE=$?
    break
  fi

  sleep 1
done

cleanup
exit "${EXIT_CODE}"
