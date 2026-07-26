#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck disable=SC1091
source "${PROJECT_ROOT}/scripts/lib.sh"

verify_base_tools
ensure_env_files
ensure_backend_venv
ensure_backend_dependencies
