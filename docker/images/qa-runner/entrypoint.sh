#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${ARTIFACTS_DIR:-/app/artifacts}"
mkdir -p "${REPORTS_DIR:-/app/reports}"

exec pnpm run qa-bots -- "$@"
