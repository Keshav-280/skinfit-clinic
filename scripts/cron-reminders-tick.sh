#!/usr/bin/env bash
# Back-compat wrapper — use cron-http-call.sh or install-vm-cron.sh
exec "$(cd "$(dirname "$0")" && pwd)/cron-http-call.sh" appointment-reminders
