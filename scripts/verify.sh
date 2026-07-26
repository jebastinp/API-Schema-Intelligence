#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COREPACK_HOME="${PROJECT_ROOT}/.runtime/corepack"

corepack pnpm --dir "${PROJECT_ROOT}/frontend" lint
corepack pnpm --dir "${PROJECT_ROOT}/frontend" typecheck
corepack pnpm --dir "${PROJECT_ROOT}/frontend" build
"${PROJECT_ROOT}/backend/.venv/bin/python" -m compileall "${PROJECT_ROOT}/backend/app" "${PROJECT_ROOT}/backend/tests"
"${PROJECT_ROOT}/backend/.venv/bin/pytest" "${PROJECT_ROOT}/backend/tests"
