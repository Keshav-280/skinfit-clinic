# Phase 4 — ECS Fargate (step-by-step)

Account: **417326870953** · Region: **ap-south-1**

## Progress checklist

- [ ] **Step 1** — ECR login + push `skinfit-web`
- [ ] **Step 2** — Push `skinfit-ml-worker`
- [ ] **Step 3** — Push `skinfit-ml-inference` (needs `face_analysis_tool` mount path at runtime on ECS — see Step 6)
- [ ] **Step 4** — ECS cluster + task execution IAM role
- [ ] **Step 5** — First service: `web` (Next.js)
- [ ] **Step 6** — Services: `ml-worker` + `ml-inference`
- [ ] **Step 7** — ALB + HTTPS

---

## Step 1 — Push `skinfit-web` to ECR

Run from repo root on your Mac (Docker Desktop running).

```bash
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=417326870953
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

cd /Users/sagnikdey/skinfit-clinic

docker build -f docker/Dockerfile.web -t skinfit-web:latest .

docker tag skinfit-web:latest "${ECR_REGISTRY}/skinfit-web:latest"

docker push "${ECR_REGISTRY}/skinfit-web:latest"
```

**Success:** last lines show `latest: digest: sha256:...`

**Verify in AWS:** ECR → Repositories → `skinfit-web` → Image count ≥ 1.

When Step 1 is done, continue to Step 2 in this file (or ask in chat).

---

## Step 2 — Push `skinfit-ml-worker`

```bash
cd /Users/sagnikdey/skinfit-clinic

docker build -f docker/Dockerfile.ml-worker -t skinfit-ml-worker:latest .

docker tag skinfit-ml-worker:latest "${ECR_REGISTRY}/skinfit-ml-worker:latest"

docker push "${ECR_REGISTRY}/skinfit-ml-worker:latest"
```

---

## Step 3 — Push `skinfit-ml-inference`

Build (large; may take several minutes):

```bash
cd /Users/sagnikdey/skinfit-clinic

docker build -f docker/Dockerfile.ml-inference -t skinfit-ml-inference:latest .

docker tag skinfit-ml-inference:latest "${ECR_REGISTRY}/skinfit-ml-inference:latest"

docker push "${ECR_REGISTRY}/skinfit-ml-inference:latest"
```

**Note:** Inference still expects `face_analysis_tool` and model weights at **runtime** (same as local Compose). Step 6 covers ECS options (EFS / baked image).

---

## Step 4+ (after all images pushed)

ECS cluster, IAM roles, task definitions, and services — follow chat guide or next sections when Steps 1–3 are complete.

### Production env vars (ECS tasks)

| Variable | web | ml-worker | ml-inference |
|----------|-----|-----------|----------------|
| `AWS_RDS_URL` | yes | yes | no |
| `ELASTICACHE_URL` | yes | yes | no |
| `SCAN_ASYNC_MODE` | `1` | — | — |
| `FACE_ANALYSIS_SERVICE_URL` | `http://ml-inference:8765` | same | — |
| `SESSION_SECRET` | yes | — | — |
| `LOCAL_POSTGRES_URL` | **no** | **no** | — |
| `LOCAL_REDIS_URL` | **no** | **no** | — |

Use Secrets Manager for passwords in production (recommended before go-live).
