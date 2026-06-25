#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Skinfit Annotator — live colorful monitor (nginx + web + optional stats)
#
#  Usage (on EC2):
#    bash scripts/annotator-live-logs.sh
#    bash scripts/annotator-live-logs.sh access    # nginx access only
#    bash scripts/annotator-live-logs.sh errors    # nginx errors only
#    bash scripts/annotator-live-logs.sh web       # Next.js container only
#    bash scripts/annotator-live-logs.sh snapshot  # one-shot health (no tail)
#
#  From laptop:
#    ssh -i skinfit-key.pem ubuntu@13.234.166.154 'bash -s' < scripts/annotator-live-logs.sh
#
#  Env overrides:
#    NGINX_CONTAINER=docker-nginx-1  WEB_CONTAINER=docker-web-2
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

MODE="${1:-all}"
NGINX_CONTAINER="${NGINX_CONTAINER:-docker-nginx-1}"
WEB_CONTAINER="${WEB_CONTAINER:-}"
ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/skinfit.access.log}"
ERROR_LOG="${NGINX_ERROR_LOG:-/var/log/nginx/skinfit.error.log}"

# Auto-detect web container name (docker-web-1, docker-web-2, …)
if [[ -z "$WEB_CONTAINER" ]]; then
  WEB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^docker-web-' | head -1 || true)"
  WEB_CONTAINER="${WEB_CONTAINER:-docker-web-1}"
fi

# ── Colors (disabled when not a TTY) ─────────────────────────────────────────
if [[ -t 1 ]]; then
  R=$'\033[0m' B=$'\033[1m' D=$'\033[2m'
  RED=$'\033[31m' GRN=$'\033[32m' YEL=$'\033[33m' BLU=$'\033[34m'
  MAG=$'\033[35m' CYN=$'\033[36m' WHT=$'\033[37m'
  BG_RED=$'\033[41m' BG_GRN=$'\033[42m' BG_YEL=$'\033[43m'
else
  R= B= D= RED= GRN= YEL= BLU= MAG= CYN= WHT= BG_RED= BG_GRN= BG_YEL=
fi

banner() {
  printf '%b\n' "${CYN}${B}╔══════════════════════════════════════════════════════════════════╗${R}"
  printf '%b\n' "${CYN}${B}║${R}  ${WHT}${B}Skinfit Annotator Live Monitor${R}                                  ${CYN}${B}║${R}"
  printf '%b\n' "${CYN}${B}╠══════════════════════════════════════════════════════════════════╣${R}"
  printf '%b\n' "${CYN}${B}║${R}  nginx: ${NGINX_CONTAINER}   web: ${WEB_CONTAINER}                          ${CYN}${B}║${R}"
  printf '%b\n' "${CYN}${B}╠══════════════════════════════════════════════════════════════════╣${R}"
  printf '%b\n' "${CYN}${B}║${R}  ${GRN}SAVE${R} hydrate  ${GRN}SYNC${R} poll     ${MAG}PEER${R} shapes   ${BLU}IMG${R} files    ${YEL}LOCK${R} edits ${CYN}${B}║${R}"
  printf '%b\n' "${CYN}${B}║${R}  ${RED}429${R} rate     ${MAG}409${R} lock-busy ${RED}5xx${R} crash    ${BLU}304${R} cached           ${CYN}${B}║${R}"
  printf '%b\n' "${CYN}${B}╚══════════════════════════════════════════════════════════════════╝${R}"
  printf '\n'
}

snapshot() {
  banner
  printf '%b%s%b\n' "$B" "─── Snapshot $(date -u '+%Y-%m-%d %H:%M:%S UTC') ───" "$R"

  printf '\n%bDocker services%b\n' "$B" "$R"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' \
    | grep -E 'NAMES|nginx|postgres|redis|web' || true

  printf '\n%bResource usage%b\n' "$B" "$R"
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' \
    2>/dev/null | grep -E 'NAME|nginx|postgres|redis|web' || true

  printf '\n%bHost%b\n' "$B" "$R"
  uptime
  free -h | head -2
  df -h / | tail -1

  printf '\n%bLast 30 annotator requests (nginx)%b\n' "$B" "$R"
  docker exec "$NGINX_CONTAINER" tail -n 2000 "$ACCESS_LOG" 2>/dev/null \
    | grep -E '/annotator|/api/annotator' | tail -n 30 \
    | awk '
function fmt_bytes(b) {
  if (b >= 1048576) return sprintf("%.2fMB", b/1048576)
  if (b >= 1024) return sprintf("%.1fKB", b/1024)
  return sprintf("%dB", b)
}
{
  gsub(/\[/, "", $4); gsub(/\]/, "", $5)
  ts = substr($4 " " $5, 1, 19)
  method = $6; gsub(/"/, "", method)
  path = $7; status = $9; bytes = $10+0
  printf "  %s  %-6s  %3s  %8s  %s\n", ts, method, status, fmt_bytes(bytes), path
}' || true

  printf '\n%bRecent errors (nginx + web)%b\n' "$B" "$R"
  docker exec "$NGINX_CONTAINER" tail -n 100 "$ERROR_LOG" 2>/dev/null \
    | grep -iE 'annotator|upstream|timeout|error' | tail -5 \
    | sed 's/^/  /' || echo "  (none)"
  docker logs --tail 80 "$WEB_CONTAINER" 2>&1 \
    | grep -iE 'error|annotator|OOM|ENOMEM|killed|429|504' | tail -5 \
    | sed 's/^/  [web] /' || echo "  [web] (none)"

  printf '\n%bStatus breakdown (last 500 annotator hits)%b\n' "$B" "$R"
  docker exec "$NGINX_CONTAINER" tail -n 2000 "$ACCESS_LOG" 2>/dev/null \
    | grep -E '/annotator|/api/annotator' | tail -n 500 | awk '{
      s=$9; c[s]++; total++
      if (s>=500) err++
      else if (s==429) rl++
      else if (s==409) lk++
      else if (s==200 || s==201 || s==204) ok++
      else if (s==304) cache++
    } END {
      printf "  total=%d  ok=%d  cache=%d  lock409=%d  rate429=%d  5xx=%d\n",
        total+0, ok+0, cache+0, lk+0, rl+0, err+0
    }'

  printf '\n%bTip:%b run without arguments for live color tail.\n\n' "$D" "$R"
}

# Shared awk formatter (stdin = nginx combined log lines)
read -r -d '' AWK_FORMATTER <<'AWK' || true
BEGIN {
  if (ENVIRON["AWK_MODE"] == "snapshot") exit
  # stats
  ok=0; cache=0; rl=0; lk=0; err=0; n=0
}
function fmt_bytes(b) {
  if (b >= 1048576) return sprintf("%.2fMB", b/1048576)
  if (b >= 1024) return sprintf("%.1fKB", b/1024)
  return sprintf("%dB", b)
}
function classify(path, method,    p) {
  if (path ~ /^\/annotator\?/ || path == "/annotator") return "PAGE"
  if (path ~ /^\/api\/annotator\/files\//) {
    if (path ~ /[?&]w=/) return "THUMB"
    return "IMAGE"
  }
  if (path ~ /^\/api\/annotator\/images/) {
    if (method == "POST") return "UPLOAD"
    if (method == "DELETE") return "DEL-IMG"
    return "LIST"
  }
  if (path ~ /^\/api\/annotator\/locks/) {
    if (method == "DELETE") return "UNLOCK"
    return "LOCK"
  }
  if (path ~ /^\/api\/annotator\/import/) return "IMPORT"
  if (path ~ /^\/api\/annotator\/state/) {
    if (method == "PUT") return "SAVE"
    if (path ~ /hydrate=1/) return "HYDRATE"
    if (path ~ /sync=1/) return "SYNC"
    if (path ~ /merged=1/) return "EXPORT"
    if (path ~ /peers=1/) return "PEER"
    if (path ~ /imageIndex=/) return "LOAD"
    return "STATE"
  }
  return "OTHER"
}
function tag_color(tag) {
  if (tag == "SAVE") return "\033[32;1m"
  if (tag == "HYDRATE" || tag == "SYNC") return "\033[36m"
  if (tag == "PEER" || tag == "LOAD") return "\033[35m"
  if (tag == "EXPORT" || tag == "MERGED") return "\033[35;1m"
  if (tag == "LOCK" || tag == "UNLOCK") return "\033[33;1m"
  if (tag == "IMAGE") return "\033[34m"
  if (tag == "THUMB") return "\033[34;2m"
  if (tag == "PAGE") return "\033[37m"
  if (tag == "UPLOAD" || tag == "IMPORT") return "\033[32m"
  if (tag == "429" || tag == "RATE") return "\033[31;1m"
  return "\033[37m"
}
function status_style(s,    st) {
  st = s + 0
  if (st == 200 || st == 201 || st == 204) return "\033[32m"
  if (st == 304) return "\033[34m"
  if (st == 409) return "\033[35;1m"
  if (st == 429) return "\033[31;1m"
  if (st >= 500) return "\033[41;37;1m"
  if (st >= 400) return "\033[31m"
  return "\033[33m"
}
function method_color(m) {
  if (m == "GET") return "\033[36m"
  if (m == "POST") return "\033[32m"
  if (m == "PUT") return "\033[33;1m"
  if (m == "DELETE") return "\033[31m"
  return "\033[37m"
}
function bump_stats(s) {
  n++
  if (s == 200 || s == 201 || s == 204) ok++
  else if (s == 304) cache++
  else if (s == 429) rl++
  else if (s == 409) lk++
  else if (s >= 500) err++
  if (n % 40 == 0) print_stats()
}
function print_stats() {
  printf "\033[2m── stats: hits=%d ok=%d cache=%d lock409=%d rate429=%d 5xx=%d ──\033[0m\n",
    n, ok, cache, lk, rl, err > "/dev/stderr"
}
{
  gsub(/\[/, "", $4)
  gsub(/\]/, "", $5)
  ts = substr($4 " " $5, 1, 19)
  ip = $1
  method = $6; gsub(/"/, "", method)
  path = $7
  status = $9 + 0
  bytes = $10 + 0
  tag = classify(path, method)
  if (status == 429) tag = "RATE"
  bump_stats(status)

  tc = tag_color(tag)
  mc = method_color(method)
  sc = status_style(status)
  reset = "\033[0m"
  dim = "\033[2m"

  # shorten path for display
  short = path
  if (length(short) > 72) short = substr(short, 1, 69) "..."

  printf "%s[%s]%s %s%-19s%s %s%-14s%s %s%-6s%s %s%3d%s %s%8s%s %s%-6s%s %s%s%s\n",
    dim, "ACCESS", reset,
    dim, ts, reset,
    dim, ip, reset,
    mc, method, reset,
    sc, status, reset,
    dim, fmt_bytes(bytes), reset,
    tc, tag, reset,
    dim, short, reset
  fflush()
}
AWK

tail_access() {
  docker exec "$NGINX_CONTAINER" tail -n 0 -F "$ACCESS_LOG" 2>/dev/null \
    | grep --line-buffered -E '/annotator|/api/annotator' \
    | awk "$AWK_FORMATTER"
}

tail_errors() {
  docker exec "$NGINX_CONTAINER" tail -n 0 -F "$ERROR_LOG" 2>/dev/null \
    | grep --line-buffered -iE 'annotator|upstream|timeout|refused|error' \
    | while IFS= read -r line; do
        printf '%b[%s]%b %b%s%b\n' "$D" "NGINX-ERR" "$R" "$RED" "$line" "$R"
      done
}

tail_web() {
  docker logs -f --tail 0 "$WEB_CONTAINER" 2>&1 \
    | grep --line-buffered -iE '/api/annotator|/annotator|error|warn|OOM|ENOMEM|killed|ECONNRESET|ETIMEDOUT|429|504|heap|FATAL' \
    | while IFS= read -r line; do
        if [[ "$line" =~ [Ee]rror|OOM|FATAL|killed ]]; then
          printf '%b[%s]%b %b%s%b\n' "$D" "WEB" "$R" "$BG_RED$WHT" "$line" "$R"
        elif [[ "$line" =~ [Ww]arn ]]; then
          printf '%b[%s]%b %b%s%b\n' "$D" "WEB" "$R" "$YEL" "$line" "$R"
        else
          printf '%b[%s]%b %s%s%b\n' "$D" "WEB" "$R" "$D" "$line" "$R"
        fi
      done
}

print_header() {
  banner
  printf '%b%-8s %-19s %-14s %-6s %3s %8s %-6s  %s%b\n' \
    "$D" "SRC" "TIME (UTC)" "IP" "METHOD" "ST" "SIZE" "KIND" "PATH" "$R"
  printf '%b%s%b\n' "$D" "────────────────────────────────────────────────────────────────────────────────────────────" "$R"
}

case "$MODE" in
  snapshot|snap|status)
    snapshot
    ;;
  access|nginx)
    print_header
    tail_access
    ;;
  errors|err)
    print_header
    tail_errors
    ;;
  web|app)
    print_header
    tail_web
    ;;
  all|live|"")
    print_header
    trap 'kill 0 2>/dev/null; exit 0' INT TERM
    tail_access &
    p1=$!
    tail_errors &
    p2=$!
    tail_web &
    p3=$!
    wait "$p1" "$p2" "$p3"
    ;;
  help|-h|--help)
    banner
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    printf 'Unknown mode: %s (try: all, access, errors, web, snapshot)\n' "$MODE" >&2
    exit 1
    ;;
esac
