#!/usr/bin/env bash
# Run multi-user annotator load test on EC2 (6 virtual annotators by default).
# Usage: bash scripts/run-annotator-load-test.sh [users] [seconds]
set -euo pipefail

USERS="${1:-6}"
SECONDS="${2:-90}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NET="$(docker inspect docker-web-2 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || docker ps --format '{{.Names}}' | grep docker-web | head -1 | xargs docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"

echo "Simulating ${USERS} annotators for ${SECONDS}s (app + DB + locks + saves)…"
docker run --rm --network "$NET" \
  -v "$ROOT:/app" -w /app \
  --env-file .env.local \
  -e BASE_URL=http://web:3000 \
  node:22-bookworm-slim bash -lc \
  "npm install --no-save tsx jose pg >/dev/null 2>&1 && npx tsx scripts/annotator-load-test.ts --users ${USERS} --duration ${SECONDS} --writes"

echo ""
echo "Host after test:"
uptime
free -h | head -2
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' \
  docker-web-2 docker-postgres-1 docker-nginx-1 2>/dev/null || true
