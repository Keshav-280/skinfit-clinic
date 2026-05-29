#!/usr/bin/env bash
# Back-compat — installs full VM cron set (backup + all HTTP crons).
exec "$(cd "$(dirname "$0")" && pwd)/install-vm-cron.sh"
