#!/usr/bin/env bash
# Install daily 03:00 UTC Postgres backup cron on the prod VM.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_SCRIPT="$REPO_ROOT/scripts/pg-backup.sh"
LOG_FILE="${LOG_FILE:-/var/log/skinfit-pg-backup.log}"
CRON_LINE="0 3 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

chmod +x "$BACKUP_SCRIPT"

sudo touch "$LOG_FILE"
sudo chown "$(whoami):$(whoami)" "$LOG_FILE" 2>/dev/null || true

TMP="$(mktemp)"
(crontab -l 2>/dev/null | grep -v 'scripts/pg-backup.sh' || true; echo "$CRON_LINE") >"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed cron:"
crontab -l | grep pg-backup || true
echo "Log: $LOG_FILE"
echo "Test now: bash $BACKUP_SCRIPT"
