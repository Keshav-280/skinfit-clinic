#!/usr/bin/env bash
# Call a /api/cron/* route on prod.
#
# Default (auto): hit Next.js inside the `web` container on :3000 — bypasses nginx
# HTTP→HTTPS redirects that break host curl (301 on http://127.0.0.1).
#
# Override with CRON_MODE=http and CRON_BASE_URL=https://your-domain.com when needed.
#
# Usage: cron-http-call.sh <path-suffix>
# Example: cron-http-call.sh kai-weekly  # -> GET /api/cron/kai-weekly
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
CRON_MODE="${CRON_MODE:-auto}"

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET is not set in .env" >&2
  exit 1
fi

COMPOSE=(docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml)
CRON_PATH="/api/cron/${PATH_SUFFIX}"

web_container_running() {
  [[ -n "$("${COMPOSE[@]}" ps -q web 2>/dev/null | head -n1 || true)" ]]
}

call_via_docker() {
  echo "[$(date -Is)] GET ${CRON_PATH} (via web container)"
  "${COMPOSE[@]}" exec -T \
    -e "CRON_SECRET=${SECRET}" \
    -e "CRON_PATH=${CRON_PATH}" \
    web node -e '
const secret = process.env.CRON_SECRET;
const path = process.env.CRON_PATH;
fetch("http://127.0.0.1:3000" + path, {
  headers: { Authorization: "Bearer " + secret },
})
  .then(async (res) => {
    const body = await res.text();
    process.stdout.write(body);
    if (!body.endsWith("\n")) process.stdout.write("\n");
    if (!res.ok) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
'
}

call_via_http() {
  local base="${CRON_BASE_URL:-http://127.0.0.1}"
  local curl_opts=(-fsS -L)
  if [[ "${CRON_INSECURE:-}" == "1" ]]; then
    curl_opts+=(-k)
  fi
  echo "[$(date -Is)] GET ${CRON_PATH} (via ${base})"
  curl "${curl_opts[@]}" -H "Authorization: Bearer ${SECRET}" \
    "${base%/}${CRON_PATH}"
  echo
}

if [[ "$CRON_MODE" == "docker" ]] || { [[ "$CRON_MODE" == "auto" ]] && web_container_running; }; then
  call_via_docker
elif [[ "$CRON_MODE" == "http" ]] || [[ "$CRON_MODE" == "auto" ]]; then
  call_via_http
else
  echo "Unknown CRON_MODE=${CRON_MODE} (use auto, docker, or http)" >&2
  exit 1
fi
