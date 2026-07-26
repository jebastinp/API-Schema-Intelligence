#!/usr/bin/env bash

set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/scripts/lib.sh"

verify_base_tools
ensure_env_files

printf '\nSchema Studio Health Check\n'
printf '==========================\n'

missing=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && missing+=("${line}")
done < <(missing_backend_env_values)
if [[ "${#missing[@]}" -gt 0 && -n "${missing[0]}" ]]; then
  log_error "Environment variables are incomplete."
  printf 'Missing values:\n'
  printf '  - %s\n' "${missing[@]}"
else
  log_success "Environment variables are configured."
fi

if curl -fsS "${BACKEND_HEALTH_URL}" >/tmp/schema_studio_backend_health.json 2>/dev/null; then
  log_success "Backend endpoint is reachable."
  backend_status="$(python3 - <<'PY' < /tmp/schema_studio_backend_health.json
import json, sys
payload = json.load(sys.stdin)
print(payload["status"])
print(payload["database"]["status"])
print("true" if payload["environment_variables"]["configured"] else "false")
PY
)"
  backend_app_status="$(printf '%s\n' "${backend_status}" | sed -n '1p')"
  backend_db_status="$(printf '%s\n' "${backend_status}" | sed -n '2p')"
  backend_env_status="$(printf '%s\n' "${backend_status}" | sed -n '3p')"
  printf '  Backend status: %s\n' "${backend_app_status}"
  printf '  Supabase status: %s\n' "${backend_db_status}"
  printf '  Backend env configured: %s\n' "${backend_env_status}"
else
  log_warn "Backend endpoint is not reachable at ${BACKEND_HEALTH_URL}."
fi

if curl -fsS "${FRONTEND_URL}" >/dev/null 2>&1; then
  log_success "Frontend endpoint is reachable."
else
  log_warn "Frontend endpoint is not reachable at ${FRONTEND_URL}."
fi

rm -f /tmp/schema_studio_backend_health.json
