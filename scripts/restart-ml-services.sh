#!/usr/bin/env bash
# Restart ML containers without rebuilding images (fast — use after git pull when only web/JS changed).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml)

echo "==> Restart ML stack (no image rebuild)"
"${COMPOSE[@]}" up -d --no-build ml-worker ml-inference acne-detector

echo ""
"${COMPOSE[@]}" ps ml-worker ml-inference acne-detector
echo ""
echo "Logs: ${COMPOSE[*]} logs -f --tail=50 ml-worker ml-inference"
