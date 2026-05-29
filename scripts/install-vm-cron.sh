#!/usr/bin/env bash
# Install all prod crons on the VM (replaces cron-job.org / Render schedulers).
# - Postgres backup (daily 03:00 UTC)
# - Appointment + routine reminders (hourly)
# - kAI weekly (Sunday 01:00 UTC)
# - kAI monthly (1st of month 02:00 UTC)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CALL="$REPO_ROOT/scripts/cron-http-call.sh"
BACKUP="$REPO_ROOT/scripts/pg-backup.sh"

if [[ ! -f "$REPO_ROOT/.env" ]] || ! grep -q '^CRON_SECRET=' "$REPO_ROOT/.env" 2>/dev/null; then
  echo "Add CRON_SECRET=... to $REPO_ROOT/.env before installing cron." >&2
  exit 1
fi

chmod +x "$CALL" "$BACKUP"

LOG_DIR="${LOG_DIR:-/var/log}"
for f in skinfit-pg-backup.log skinfit-cron-reminders.log skinfit-cron-kai-weekly.log skinfit-cron-kai-monthly.log; do
  touch "$LOG_DIR/$f" 2>/dev/null || sudo touch "$LOG_DIR/$f"
  sudo chown "$(whoami):$(whoami)" "$LOG_DIR/$f" 2>/dev/null || true
done

# Schedules align with vercel.json; reminders run hourly for due-window checks.
LINES="$(cat <<EOF
# skinfit-vm-cron (managed by scripts/install-vm-cron.sh)
0 3 * * * $BACKUP >> $LOG_DIR/skinfit-pg-backup.log 2>&1
0 * * * * $CALL appointment-reminders >> $LOG_DIR/skinfit-cron-reminders.log 2>&1
0 1 * * 0 $CALL kai-weekly >> $LOG_DIR/skinfit-cron-kai-weekly.log 2>&1
0 2 1 * * $CALL kai-monthly >> $LOG_DIR/skinfit-cron-kai-monthly.log 2>&1
EOF
)"

TMP="$(mktemp)"
(crontab -l 2>/dev/null \
  | grep -v 'skinfit-vm-cron' \
  | grep -v 'scripts/pg-backup.sh' \
  | grep -v 'cron-http-call.sh' \
  | grep -v 'cron-reminders-tick.sh' \
  || true
 echo "$LINES") >"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed VM crontab (skinfit-vm-cron):"
crontab -l | grep -A10 'skinfit-vm-cron' || crontab -l
echo ""
echo "Test HTTP crons:"
echo "  bash $CALL appointment-reminders"
echo "  bash $CALL kai-weekly"
echo "Backup test: bash $BACKUP"
