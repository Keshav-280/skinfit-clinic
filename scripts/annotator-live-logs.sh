#!/usr/bin/env bash
# Live annotator nginx access log — readable columns + human byte sizes.
# Usage (on EC2):
#   bash scripts/annotator-live-logs.sh
# Or from laptop:
#   ssh -i skinfit-key.pem ubuntu@13.234.166.154 'bash -s' < scripts/annotator-live-logs.sh

set -euo pipefail

CONTAINER="${NGINX_CONTAINER:-docker-nginx-1}"
LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/skinfit.access.log}"

printf '%s\n' \
  "TIME (UTC)           IP              METHOD  STATUS   BYTES        PATH" \
  "───────────────────  ──────────────  ──────  ───────  ───────────  ─────────────────────────────"

docker exec "$CONTAINER" tail -f "$LOG" | grep --line-buffered annotator | awk '
function fmt_bytes(b,    u) {
  if (b >= 1048576) { u = b / 1048576; return sprintf("%.2f MB", u) }
  if (b >= 1024)    { u = b / 1024;    return sprintf("%.1f KB", u) }
  return sprintf("%d B", b)
}
function status_label(s) {
  if (s == 200 || s == 201 || s == 204) return "OK"
  if (s == 304) return "CACHE"
  if (s == 409) return "LOCK"
  if (s == 429) return "RATE"
  if (s == 499) return "CLIENT-TO"
  if (s == 502) return "WEB-DOWN"
  if (s == 504) return "TIMEOUT"
  return "ERR"
}
{
  gsub(/\[/, "", $4)
  gsub(/\]/, "", $5)
  ts = substr($4 " " $5, 1, 19)
  ip = $1
  method = $6
  gsub(/"/, "", method)
  path = $7
  status = $9
  bytes = $10 + 0
  printf "%-19s  %-14s  %-6s  %s %-5s  %10s  %s\n",
    ts, ip, method, status_label(status), status, fmt_bytes(bytes), path
  fflush()
}
'
