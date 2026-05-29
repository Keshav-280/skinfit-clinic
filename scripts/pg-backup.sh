#!/usr/bin/env bash
# Daily Postgres backup for Docker Compose stack on prod VM.
# Usage: bash scripts/pg-backup.sh
# Cron:  0 3 * * * /opt/skinfit/scripts/pg-backup.sh >> /var/log/skinfit-pg-backup.log 2>&1
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BACKUP_DIR="${BACKUP_DIR:-/opt/skinfit/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE=(docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml)

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/skinfit-${STAMP}.sql.gz"

echo "[$(date -Is)] Starting pg_dump -> $OUT"

"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U skinfit -d skinfit --no-owner --no-acl | gzip -9 >"$OUT"

find "$BACKUP_DIR" -name 'skinfit-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete

BYTES=$(wc -c <"$OUT" | tr -d ' ')
echo "[$(date -Is)] Done ($BYTES bytes), retention ${RETENTION_DAYS}d"
