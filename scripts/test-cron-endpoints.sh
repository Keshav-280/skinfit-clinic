#!/usr/bin/env bash
# Smoke-test all /api/cron/* routes (prod VM or local with CRON_SECRET).
set -euo pipefail

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

PATHS=(
  appointment-reminders
  appointment-reminder
  kai-weekly
  kai-monthly
  kai-daily-focus
)

for p in "${PATHS[@]}"; do
  echo "== GET /api/cron/$p =="
  curl -fsS -H "Authorization: Bearer ${SECRET}" \
    "${BASE%/}/api/cron/${p}" | head -c 2000
  echo -e "\n"
done
