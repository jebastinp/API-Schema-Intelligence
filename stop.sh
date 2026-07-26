#!/usr/bin/env bash

set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/scripts/lib.sh"

log_info "Stopping Schema Studio services."
stop_known_services
log_success "Schema Studio services stopped."
