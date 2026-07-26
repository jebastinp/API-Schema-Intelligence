#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
"${PROJECT_ROOT}/stop.sh"
"${PROJECT_ROOT}/run.sh"
