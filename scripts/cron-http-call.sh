#!/usr/bin/env bash
# Call a /api/cron/* route on the local nginx stack (prod VM).
# Usage: cron-http-call.sh <path-suffix>
# Example: cron-http-call.sh appointment-reminders
set -euo pipefail

PATH_SUFFIX="${1:-}"
if [[ -z "$PATH_SUFFIX" ]]; then
  echo "Usage: $0 <cron-path-suffix>" >&2
  echo "Example: $0 kai-weekly  # -> GET /api/cron/kai-weekly" >&2
  exit 1
fi

PATH_SUFFIX="${PATH_SUFFIX#/}"
PATH_SUFFIX="${PATH_SUFFIX#api/cron/}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SECRET="${CRON_SECRET:-}"
BASE="${CRON_BASE_URL:-http://127.0.0.1}"

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET is not set in .env" >&2
  exit 1
fi

echo "[$(date -Is)] GET /api/cron/${PATH_SUFFIX}"
curl -fsS -H "Authorization: Bearer ${SECRET}" \
  "${BASE%/}/api/cron/${PATH_SUFFIX}"
echo
