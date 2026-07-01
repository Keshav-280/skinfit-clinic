#!/usr/bin/env bash
# Run on prod VM as root or with sudo for certbot only.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"

echo "==> Pulling latest code (skip if not a git repo)"
git pull 2>/dev/null || true

echo "==> Rebuild web only (ML images are large — not rebuilt here)"
$COMPOSE up -d --build web

echo "==> Data stores + ML (existing images, no build)"
$COMPOSE up -d --no-build redis postgres
$COMPOSE up -d --no-build ml-inference acne-detector
$COMPOSE up -d --no-build ml-worker
$COMPOSE up -d --no-build nginx

echo "==> Health check (nginx -> /healthz)"
sleep 2
curl -sf "http://127.0.0.1/healthz" >/dev/null && echo "OK: nginx /healthz"
curl -sfI "http://127.0.0.1/" | head -3 || echo "WARN: root URL check failed — inspect web logs"

echo ""
echo "Done. Open http://<your-elastic-ip>/ in a browser (port 80)."
echo "Update .env.local: NEXT_PUBLIC_APP_URL, AUTH_URL, PUBLIC_UPLOAD_BASE_URL to that URL."
echo "Then: $COMPOSE up -d --force-recreate web"
echo "See nginx/README.md for HTTPS (Cloudflare or certbot)."
