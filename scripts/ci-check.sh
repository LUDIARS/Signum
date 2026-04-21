#!/usr/bin/env bash
# AIFormat CLAUDE.md guidance — single canonical CI check invoked by
# local pre-push hooks and GitHub Actions.
set -euo pipefail

here="$(cd "$(dirname "$0")"/.. && pwd)"
cd "$here"

echo "=== 1/4 backend: tsc build ==="
npm run build

echo "=== 2/4 backend: vitest ==="
npm test

echo "=== 3/4 frontend: lint ==="
(cd frontend && npm run lint)

echo "=== 4/4 frontend: build ==="
(cd frontend && npm run build)

echo "✓ all checks passed"
