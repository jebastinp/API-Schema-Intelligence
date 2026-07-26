#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
RUNTIME_DIR="${PROJECT_ROOT}/.runtime"
PID_DIR="${RUNTIME_DIR}/pids"
LOG_DIR="${RUNTIME_DIR}/logs"
COREPACK_HOME="${RUNTIME_DIR}/corepack"

BACKEND_HOST="127.0.0.1"
BACKEND_PORT="8000"
FRONTEND_HOST="127.0.0.1"
FRONTEND_PORT="3000"
BACKEND_HEALTH_URL="http://${BACKEND_HOST}:${BACKEND_PORT}/api/health"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"

mkdir -p "${PID_DIR}" "${LOG_DIR}" "${COREPACK_HOME}"

color() {
  local code="$1"
  shift
  printf "\033[%sm%s\033[0m\n" "${code}" "$*"
}

log_info() {
  color "34" "[INFO] $*"
}

log_success() {
  color "32" "[OK] $*"
}

log_warn() {
  color "33" "[WARN] $*"
}

log_error() {
  color "31" "[ERROR] $*"
}

require_command() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    log_error "Required tool '${name}' is not installed or not on PATH."
    exit 1
  fi
}

verify_base_tools() {
  require_command python3
  require_command node
  require_command corepack
  require_command curl
}

sha_file() {
  local target="$1"
  python3 - "$target" <<'PY'
from __future__ import annotations

import hashlib
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
print(hashlib.sha256(path.read_bytes()).hexdigest())
PY
}

ensure_env_files() {
  if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    log_warn "Created backend/.env from backend/.env.example."
  fi

  if [[ ! -f "${FRONTEND_DIR}/.env.local" ]]; then
    cp "${FRONTEND_DIR}/.env.example" "${FRONTEND_DIR}/.env.local"
    log_warn "Created frontend/.env.local from frontend/.env.example."
  fi

  sync_frontend_public_env
}

load_backend_env() {
  eval "$(
    python3 - "${BACKEND_DIR}/.env" <<'PY'
from __future__ import annotations

import pathlib
import shlex
import sys

path = pathlib.Path(sys.argv[1])
for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip().strip('"').strip("'")
    print(f"export {key}={shlex.quote(value)}")
PY
  )"
}

set_env_value_in_file() {
  local file="$1"
  local key="$2"
  local value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
from __future__ import annotations

import pathlib
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

lines = path.read_text(encoding="utf-8").splitlines()
updated = False
result: list[str] = []
for line in lines:
    if line.startswith(f"{key}="):
        result.append(f"{key}={value}")
        updated = True
    else:
        result.append(line)

if not updated:
    result.append(f"{key}={value}")

path.write_text("\n".join(result) + "\n", encoding="utf-8")
PY
}

sync_frontend_public_env() {
  load_backend_env
  local public_url="${SUPABASE_URL:-${SUPABASE_PROJECT_URL:-}}"
  local public_anon="${SUPABASE_ANON_KEY:-}"

  if [[ -n "${public_url}" ]]; then
    set_env_value_in_file "${FRONTEND_DIR}/.env.local" "NEXT_PUBLIC_SUPABASE_URL" "${public_url}"
  fi
  if [[ -n "${public_anon}" ]]; then
    set_env_value_in_file "${FRONTEND_DIR}/.env.local" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${public_anon}"
  fi
}

missing_backend_env_values() {
  load_backend_env
  local missing=()
  [[ -n "${SUPABASE_URL:-${SUPABASE_PROJECT_URL:-}}" ]] || missing+=("SUPABASE_URL")
  [[ -n "${SUPABASE_ANON_KEY:-}" ]] || missing+=("SUPABASE_ANON_KEY")
  [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || missing+=("SUPABASE_SERVICE_ROLE_KEY")
  [[ -n "${SUPABASE_JWT_SECRET:-}" ]] || missing+=("SUPABASE_JWT_SECRET")
  [[ -n "${DATABASE_URL:-${SUPABASE_DB_URL:-}}" ]] || missing+=("DATABASE_URL")
  printf '%s\n' "${missing[@]:-}"
}

require_backend_env_values() {
  local missing=()
  while IFS= read -r line; do
    [[ -n "${line}" ]] && missing+=("${line}")
  done < <(missing_backend_env_values)
  if [[ "${#missing[@]}" -gt 0 && -n "${missing[0]}" ]]; then
    log_error "Schema Studio cannot start until backend/.env is configured."
    printf 'Missing values:\n'
    printf '  - %s\n' "${missing[@]}"
    exit 1
  fi
}

ensure_backend_venv() {
  if [[ ! -d "${BACKEND_DIR}/.venv" ]]; then
    log_info "Creating backend virtual environment."
    python3 -m venv "${BACKEND_DIR}/.venv"
  fi
}

ensure_backend_dependencies() {
  local state_file="${BACKEND_DIR}/.venv/.schema_studio_backend_deps"
  local log_file="${LOG_DIR}/backend-deps.log"
  local desired_hash
  desired_hash="$(sha_file "${BACKEND_DIR}/pyproject.toml")"
  if [[ ! -f "${state_file}" || "$(cat "${state_file}")" != "${desired_hash}" ]]; then
    log_info "Installing backend dependencies."
    "${BACKEND_DIR}/.venv/bin/python" -m pip install --upgrade pip >"${log_file}" 2>&1
    "${BACKEND_DIR}/.venv/bin/python" -m pip install -e "${BACKEND_DIR}[dev]" >>"${log_file}" 2>&1
    printf '%s' "${desired_hash}" > "${state_file}"
    log_success "Backend dependencies are installed. Log: ${log_file}"
  fi
}

ensure_frontend_dependencies() {
  local state_file="${RUNTIME_DIR}/.schema_studio_frontend_deps"
  local log_file="${LOG_DIR}/frontend-deps.log"
  local desired_hash
  desired_hash="$(sha_file "${PROJECT_ROOT}/pnpm-lock.yaml")"
  if [[ ! -d "${PROJECT_ROOT}/node_modules" || ! -f "${state_file}" || "$(cat "${state_file}")" != "${desired_hash}" ]]; then
    log_info "Installing frontend dependencies."
    (
      cd "${PROJECT_ROOT}" &&
      CI=1 COREPACK_HOME="${COREPACK_HOME}" corepack pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false --reporter=append-only
    ) >"${log_file}" 2>&1 || {
      log_error "Frontend dependency installation failed. See ${log_file}."
      tail -n 40 "${log_file}" || true
      return 1
    }
    printf '%s' "${desired_hash}" > "${state_file}"
    log_success "Frontend dependencies are installed. Log: ${log_file}"
  fi
}

ensure_ports_available() {
  local port
  for port in "${BACKEND_PORT}" "${FRONTEND_PORT}"; do
    if command -v lsof >/dev/null 2>&1; then
      if lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
        log_error "Port ${port} is already in use. Run ./stop.sh or free the port before starting."
        exit 1
      fi
    fi
  done
}

run_backend_migrations() {
  log_info "Running Alembic migrations against Supabase."
  (
    cd "${BACKEND_DIR}"
    .venv/bin/alembic upgrade head >/dev/null
  )
  log_success "Alembic migrations are up to date."
}

start_backend_process() {
  log_info "Starting FastAPI backend."
  (
    cd "${BACKEND_DIR}"
    .venv/bin/python -m uvicorn app.main:app --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" --reload
  ) >"${LOG_DIR}/backend.log" 2>&1 &
  echo $! > "${PID_DIR}/backend.pid"
}

start_frontend_process() {
  log_info "Starting Next.js frontend."
  (
    cd "${FRONTEND_DIR}"
    COREPACK_HOME="${COREPACK_HOME}" corepack pnpm exec next dev --hostname "${FRONTEND_HOST}" --port "${FRONTEND_PORT}"
  ) >"${LOG_DIR}/frontend.log" 2>&1 &
  echo $! > "${PID_DIR}/frontend.pid"
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempt
  for attempt in $(seq 1 120); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log_success "${label} is healthy at ${url}."
      return 0
    fi
    sleep 1
  done
  log_error "${label} did not become healthy in time."
  return 1
}

open_browser() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "${url}" >/dev/null 2>&1 || true
    return
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${url}" >/dev/null 2>&1 || true
    return
  fi
}

stop_pid_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    return
  fi
  local pid
  pid="$(cat "${file}")"
  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    wait "${pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${file}"
}

stop_listener_port() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return
  fi

  local pids=()
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && pids+=("${pid}")
  done < <(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)

  if [[ "${#pids[@]}" -eq 0 ]]; then
    return
  fi

  log_warn "Stopping stale listener(s) on port ${port}: ${pids[*]}"
  kill "${pids[@]}" >/dev/null 2>&1 || true
  sleep 1

  local survivors=()
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && survivors+=("${pid}")
  done < <(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)

  if [[ "${#survivors[@]}" -gt 0 ]]; then
    kill -9 "${survivors[@]}" >/dev/null 2>&1 || true
  fi
}

stop_known_services() {
  stop_pid_file "${PID_DIR}/frontend.pid"
  stop_pid_file "${PID_DIR}/backend.pid"
  stop_listener_port "${FRONTEND_PORT}"
  stop_listener_port "${BACKEND_PORT}"
}

check_health_json() {
  python3 - "$1" <<'PY'
from __future__ import annotations

import json
import sys

payload = json.load(sys.stdin)
value = payload
for segment in sys.argv[1].split("."):
    value = value[segment]
print(value)
PY
}
