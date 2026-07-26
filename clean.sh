#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

printf '[INFO] Cleaning local caches and temporary files.\n'
rm -rf "${PROJECT_ROOT}/node_modules"
rm -rf "${PROJECT_ROOT}/frontend/.next"
rm -rf "${PROJECT_ROOT}/frontend/tsconfig.tsbuildinfo" "${PROJECT_ROOT}/frontend/tsconfig.typecheck.tsbuildinfo"
rm -rf "${PROJECT_ROOT}/backend/.pytest_cache" "${PROJECT_ROOT}/backend/.ruff_cache"
rm -rf "${PROJECT_ROOT}/.runtime"

find "${PROJECT_ROOT}" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "${PROJECT_ROOT}" -type d -name ".next" -prune -exec rm -rf {} +
find "${PROJECT_ROOT}" -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete

printf '[OK] Local caches removed. Supabase data was not modified.\n'
