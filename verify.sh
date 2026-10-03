#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
echo "verify: all checks passed"
