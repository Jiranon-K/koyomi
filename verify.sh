#!/usr/bin/env bash
# Baseline gate: lint, typecheck, tests, production build. Exits non-zero on the first failure.
set -euo pipefail
cd "$(dirname "$0")"
bun run lint
bun run typecheck
bun run test
bun run build
echo "verify: all checks passed"
