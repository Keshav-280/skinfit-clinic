#!/usr/bin/env bash
# High-frequency RAM/CPU log for Skinfit Docker services (VM / local).
#
# Usage (from repo root on the host):
#   ./scripts/monitor-docker-resources.sh
#   ./scripts/monitor-docker-resources.sh --interval 0.2 --out /tmp/skinfit-mem.csv
#   ./scripts/monitor-docker-resources.sh --services ml-inference ml-worker web
#
# Press Ctrl+C to stop. Summary prints max RSS per container.

set -euo pipefail

INTERVAL=0.25
OUT=""
COMPOSE_FILES=(-f docker/docker-compose.yml -f docker/docker-compose.prod.yml)
SERVICES=(ml-inference ml-worker web)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval|-i)
      INTERVAL="${2:?}"
      shift 2
      ;;
    --out|-o)
      OUT="${2:?}"
      shift 2
      ;;
    --services|-s)
      shift
      SERVICES=()
      while [[ $# -gt 0 && "$1" != --* ]]; do
        SERVICES+=("$1")
        shift
      done
      ;;
    --local)
      COMPOSE_FILES=(-f docker/docker-compose.yml)
      shift
      ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found" >&2
  exit 1
fi

mapfile -t CIDS < <(
  docker compose "${COMPOSE_FILES[@]}" ps -q "${SERVICES[@]}" 2>/dev/null | grep -v '^$' || true
)

if [[ ${#CIDS[@]} -eq 0 ]]; then
  echo "No running containers for: ${SERVICES[*]}" >&2
  echo "Try: docker compose ${COMPOSE_FILES[*]} ps" >&2
  exit 1
fi

declare -A NAMES CGROUPS
HOST_CPUS="$(nproc 2>/dev/null || echo 1)"

cgroup_path() {
  local cid="$1"
  local pid
  pid="$(docker inspect -f '{{.State.Pid}}' "$cid" 2>/dev/null || echo 0)"
  if [[ "$pid" != "0" && -n "$pid" ]]; then
    if [[ -f "/proc/${pid}/cgroup" ]]; then
      local line path
      while IFS= read -r line; do
        if [[ "$line" == *"memory"* ]]; then
          path="${line#*:}"
          path="${path#*/}"
          if [[ -f "/sys/fs/cgroup/${path}/memory.current" ]]; then
            echo "/sys/fs/cgroup/${path}"
            return 0
          fi
          if [[ -f "/sys/fs/cgroup/memory/${path}/memory.usage_in_bytes" ]]; then
            echo "/sys/fs/cgroup/memory/${path}"
            return 0
          fi
        fi
      done <"/proc/${pid}/cgroup"
    fi
  fi
  local short="${cid:0:12}"
  for base in /sys/fs/cgroup /sys/fs/cgroup/system.slice; do
    for pattern in "docker-${cid}.scope" "docker-${short}.scope"; do
      if [[ -f "${base}/${pattern}/memory.current" ]]; then
        echo "${base}/${pattern}"
        return 0
      fi
      if [[ -f "${base}/${pattern}/memory.usage_in_bytes" ]]; then
        echo "${base}/${pattern}"
        return 0
      fi
    done
  done
  return 1
}

read_mem_bytes() {
  local cg="$1"
  if [[ -f "${cg}/memory.current" ]]; then
    cat "${cg}/memory.current"
  elif [[ -f "${cg}/memory.usage_in_bytes" ]]; then
    cat "${cg}/memory.usage_in_bytes"
  else
    echo 0
  fi
}

read_cpu_usec() {
  local cg="$1"
  if [[ -f "${cg}/cpu.stat" ]]; then
    awk '/^usage_usec / { print $2; exit }' "${cg}/cpu.stat"
  elif [[ -f "${cg}/cpuacct.usage" ]]; then
    awk '{ print int($1/1000) }' "${cg}/cpuacct.usage"
  else
    echo 0
  fi
}

for cid in "${CIDS[@]}"; do
  name="$(docker inspect -f '{{.Name}}' "$cid" | sed 's#^/##')"
  cg="$(cgroup_path "$cid" || true)"
  if [[ -z "$cg" ]]; then
    echo "warn: no cgroup for ${name} (${cid:0:12}) — skipping" >&2
    continue
  fi
  NAMES["$cid"]="$name"
  CGROUPS["$cid"]="$cg"
done

if [[ ${#NAMES[@]} -eq 0 ]]; then
  echo "Could not resolve cgroups for any container." >&2
  exit 1
fi

declare -A PREV_CPU PREV_TIME MAX_MEM

echo "Monitoring every ${INTERVAL}s — containers: ${NAMES[*]}"
echo "Host CPUs: ${HOST_CPUS} | Ctrl+C to stop"
echo ""

HEADER="epoch_iso,epoch_s,container,mem_mib,cpu_pct_host"
if [[ -n "$OUT" ]]; then
  echo "$HEADER" >"$OUT"
  echo "Writing: $OUT"
else
  echo "$HEADER"
fi

trap 'echo ""; echo "=== peak memory (MiB) ==="; for cid in "${!MAX_MEM[@]}"; do awk "BEGIN { printf \"%s\t%.2f\n\", \"${NAMES[$cid]}\", ${MAX_MEM[$cid]} / 1048576 }"; done; exit 0' INT TERM

while true; do
  NOW_EPOCH="$(date +%s.%N)"
  NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"

  for cid in "${!NAMES[@]}"; do
    cg="${CGROUPS[$cid]}"
    name="${NAMES[$cid]}"

    mem="$(read_mem_bytes "$cg" 2>/dev/null || echo 0)"
    cpu_usec="$(read_cpu_usec "$cg" 2>/dev/null || echo 0)"
    mem_mib="$(awk "BEGIN { printf \"%.2f\", $mem / 1048576 }")"

    cpu_pct=""
    if [[ -n "${PREV_CPU[$cid]:-}" && -n "${PREV_TIME[$cid]:-}" ]]; then
      dt="$(awk "BEGIN { print $NOW_EPOCH - ${PREV_TIME[$cid]} }")"
      if awk "BEGIN { exit !($dt > 0) }"; then
        du="$(awk "BEGIN { print $cpu_usec - ${PREV_CPU[$cid]} }")"
        # % of all host CPUs (same scale as `docker stats` CPU %)
        cpu_pct="$(awk "BEGIN { printf \"%.2f\", ($du / $dt) / 10000 / $HOST_CPUS }")"
      fi
    fi
    PREV_CPU[$cid]="$cpu_usec"
    PREV_TIME[$cid]="$NOW_EPOCH"

    if [[ -z "${MAX_MEM[$cid]:-}" || "$mem" -gt "${MAX_MEM[$cid]}" ]]; then
      MAX_MEM[$cid]="$mem"
    fi

    line="${NOW_ISO},${NOW_EPOCH},${name},${mem_mib},${cpu_pct}"
    [[ -n "$OUT" ]] && echo "$line" >>"$OUT" || echo "$line"
  done

  sleep "$INTERVAL"
done
