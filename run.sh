#!/usr/bin/env bash

set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/scripts/lib.sh"

cleanup() {
  log_info "Stopping Schema Studio services."
  stop_known_services
}

trap cleanup EXIT INT TERM

log_info "Preparing Schema Studio local development environment."
verify_base_tools
ensure_env_files
require_backend_env_values
ensure_ports_available
ensure_backend_venv
ensure_backend_dependencies
ensure_frontend_dependencies
run_backend_migrations
start_backend_process
wait_for_url "${BACKEND_HEALTH_URL}" "Backend"
start_frontend_process
wait_for_url "${FRONTEND_URL}" "Frontend"

log_success "Schema Studio is ready."
printf 'Frontend: %s\nBackend:  %s\nLogs:     %s\n' "${FRONTEND_URL}" "${BACKEND_HEALTH_URL}" "${LOG_DIR}"
open_browser "${FRONTEND_URL}"

wait
