#!/usr/bin/env bash
# Run on prod VM: cd /opt/skinfit && bash scripts/vm-logs-and-r2-check.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml)
LOG_LINES="${LOG_LINES:-120}"
OUT_DIR="${OUT_DIR:-/tmp/skinfit-logs-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUT_DIR"

echo "==> Compose status -> $OUT_DIR/status.txt"
"${COMPOSE[@]}" ps -a >"$OUT_DIR/status.txt" 2>&1
cat "$OUT_DIR/status.txt"

SERVICES=(nginx web ml-worker ml-inference postgres redis)
for svc in "${SERVICES[@]}"; do
  echo "==> Logs: $svc (last $LOG_LINES lines) -> $OUT_DIR/${svc}.log"
  "${COMPOSE[@]}" logs --no-color --tail="$LOG_LINES" "$svc" >"$OUT_DIR/${svc}.log" 2>&1 || true
done

echo "==> Combined tail -> $OUT_DIR/all-services.log"
cat "$OUT_DIR"/*.log >"$OUT_DIR/all-services.log" 2>/dev/null || true

mask_secret() {
  sed -E 's/(SECRET|KEY|PASSWORD|TOKEN)(=.*)/\1=***masked***/i'
}

echo ""
echo "==> Storage env (web container, secrets masked)"
"${COMPOSE[@]}" exec -T web printenv 2>/dev/null | grep -E '^(STORAGE_DRIVER|R2_|PUBLIC_UPLOAD|LOCAL_STORAGE)' | mask_secret || echo "(web not running)"

echo ""
echo "==> Storage env (.env.local on host, secrets masked)"
grep -E '^(STORAGE_DRIVER|R2_|PUBLIC_UPLOAD)' .env.local 2>/dev/null | mask_secret || echo "(no .env.local or no matches)"
grep -E '^(STORAGE_DRIVER|R2_|PUBLIC_UPLOAD)' .env 2>/dev/null | mask_secret || true

# shellcheck disable=SC1091
set -a
[ -f .env ] && . ./.env
[ -f .env.local ] && . ./.env.local
set +a

DRIVER="${STORAGE_DRIVER:-local}"
echo ""
echo "==> STORAGE_DRIVER=${DRIVER}"

if [ "$DRIVER" != "r2" ]; then
  echo "WARN: STORAGE_DRIVER is not 'r2'. Scans use local volume /uploads unless you set R2 in .env.local"
  echo "      See infra/R2.md and infra/.env.r2.example"
  echo ""
  echo "Logs saved under: $OUT_DIR"
  exit 0
fi

missing=0
for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME; do
  if [ -z "${!v:-}" ]; then
    echo "MISSING: $v"
    missing=1
  else
    echo "OK: $v is set"
  fi
done

if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Fix .env / .env.local then recreate web + ml-worker:"
  echo "  ${COMPOSE[*]} up -d --force-recreate web ml-worker"
  echo "Logs saved under: $OUT_DIR"
  exit 1
fi

ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
echo ""
echo "==> R2 connectivity test (list bucket via AWS CLI container)"
if docker run --rm \
  -e AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  -e AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli:2.15.0 \
  s3 ls "s3://${R2_BUCKET_NAME}" --endpoint-url "$ENDPOINT" >"$OUT_DIR/r2-list.txt" 2>&1; then
  echo "OK: R2 bucket reachable (${R2_BUCKET_NAME})"
  head -20 "$OUT_DIR/r2-list.txt"
else
  echo "FAIL: could not list R2 bucket. See $OUT_DIR/r2-list.txt"
  cat "$OUT_DIR/r2-list.txt"
  echo ""
  echo "Common fixes:"
  echo "  - Regenerate R2 API token (Object Read & Write on bucket)"
  echo "  - Match R2_BUCKET_NAME to Cloudflare dashboard"
  echo "  - PUBLIC_UPLOAD_BASE_URL=http://<your-ip-or-domain>/api/files"
  echo "  - ${COMPOSE[*]} up -d --force-recreate web ml-worker"
  exit 1
fi

echo ""
echo "==> In-app R2 smoke test (PUT + read via web container)"
"${COMPOSE[@]}" exec -T web node <<'NODE' >"$OUT_DIR/r2-smoke.txt" 2>&1 || true
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET_NAME?.trim();
const endpoint =
  process.env.R2_ENDPOINT?.trim() ||
  (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("FAIL: missing R2_* env inside web container");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

const key = `healthcheck/${Date.now()}-vm-smoke.txt`;
const body = Buffer.from("skinfit-r2-ok");

(async () => {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" })
  );
  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const c of got.Body) chunks.push(c);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text !== "skinfit-r2-ok") throw new Error("read mismatch");
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("OK: PUT/GET/DELETE", key, "bucket=", bucket);
})().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
NODE

if grep -q "^OK:" "$OUT_DIR/r2-smoke.txt" 2>/dev/null; then
  cat "$OUT_DIR/r2-smoke.txt"
  echo ""
  echo "R2 is working from the web container."
else
  echo "R2 smoke test failed:"
  cat "$OUT_DIR/r2-smoke.txt"
  echo ""
  echo "Recreate web after fixing .env:"
  echo "  ${COMPOSE[*]} up -d --force-recreate web ml-worker"
fi

echo ""
echo "All logs saved under: $OUT_DIR"
echo "  tail -f: ${COMPOSE[*]} logs -f web ml-worker"
