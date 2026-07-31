#!/usr/bin/env bash
# Pre-deploy typecheck for skinfit-clinic.
# Run this BEFORE every git push. `next build` only typechecks files in the
# build graph, so a bad type slips through until the ~2-min Docker build fails.
# This catches real source errors in seconds.
#
# Usage: bash predeploy.sh
#
# Exit 0 + "CLEAN" => safe to push/deploy.
# Exit 1 + error list => real errors that WILL fail the Docker build; fix first.

set -uo pipefail
cd "$(dirname "$0")"

echo "Running TypeScript check (app/, components/, src/)..."

# Ignore .test.ts (missing vitest types) and .next/types (stale local cache) —
# neither blocks the Docker `next build`.
ERRORS="$(node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 \
  | grep -vE "\.test\.ts|\.next/types" \
  | grep -E "^(app|components|src)/" || true)"

if [ -z "$ERRORS" ]; then
  echo "CLEAN — no source type errors. Safe to push and deploy."
  exit 0
else
  echo "TYPE ERRORS FOUND — these will fail the Docker build. Fix before pushing:"
  echo ""
  echo "$ERRORS"
  exit 1
fi
