# Skinfit Clinic — Master CTO Plan (AWS Production)

Living roadmap for moving from **local Docker** to **AWS production**.  
Status as of stack `skinfit-infrastructure` RDS update (May 2026).

---

## Executive summary

| Layer | Status |
|-------|--------|
| App (Next.js, doctor portal, scans, OAuth) | Done locally + Docker |
| Async pipeline (BullMQ, ml-worker, ml-inference) | Done locally + Docker |
| AWS network (VPC, subnets, NAT, security groups) | **Deployed** |
| AWS ECR repos (web, ml-worker, ml-inference) | **Deployed** |
| AWS RDS PostgreSQL 16 | **In progress** (`UPDATE_IN_PROGRESS`) |
| DB migrations on RDS | **Blocked** until private DB reachable |
| Cloudflare R2 uploads | **Deferred** (keep `STORAGE_DRIVER=local` / volume) |
| ElastiCache Redis | Not started |
| ECS Fargate + ALB | Not started |
| **IAM roles for running apps** | **Not yet** — see [IAM timing](#iam-roles-when-first-vs-later) |

---

## What you already built (before AWS account)

These are in the repo and working on Docker — no AWS required:

1. **Monorepo layout** — `apps/ml-worker`, `services/shared`, `docker/`
2. **Postgres + Redis** — `docker/docker-compose.yml` (host ports `5433` / `6380`)
3. **BullMQ async scans** — `POST /api/scans/submit` → worker → FastAPI `:8765`
4. **Storage abstraction** — `STORAGE_DRIVER=local` under `./uploads` (R2 stub exists, not enabled)
5. **Env abstraction** — `LOCAL_POSTGRES_URL` → `AWS_RDS_URL`, `LOCAL_REDIS_URL` → `ELASTICACHE_URL`
6. **Doctor–patient isolation** — migration `0032`, portal APIs
7. **CI** — lint, typecheck, Docker image builds (`.github/workflows/ci.yml`)
8. **OAuth (Google)** — web + mobile paths (separate from AWS)

Commit anchor: `28088f8` — *local Docker infra, async scan pipeline*; later fixes for Docker/OAuth/scans.

---

## AWS progress (today)

CloudFormation: [`cloudformation.yaml`](./cloudformation.yaml) → stack **`skinfit-infrastructure`**

| Resource | Purpose |
|----------|---------|
| VPC `10.0.0.0/16` | Isolated network |
| Public subnets ×2 | ALB, NAT (future) |
| Private subnets ×2 | ECS tasks, RDS, Redis (future) |
| NAT Gateway | Outbound from private subnets |
| Security groups | ALB, Next.js, Postgres, Redis, ML worker, ML inference |
| ECR | `skinfit-web`, `skinfit-ml-worker`, `skinfit-ml-inference` |
| RDS `skinfit-db` | Postgres 16, `db.t4g.micro`, **private**, user `skinfit` |

After `UPDATE_COMPLETE` → **Outputs** tab → copy **`RDSEndpoint`**.

---

## IAM roles: when first vs later

### Do **not** configure these on the CloudFormation “IAM role” dropdown now

That field is only “which role may CloudFormation use to create resources.” Leaving it blank means CloudFormation uses **your admin user** — correct for a solo founder setup.

### Configure application IAM roles **later**, at ECS deploy (Phase 4)

| Role | When | Why |
|------|------|-----|
| **ECS task execution role** | First ECS service create | Pull images from ECR, send logs to CloudWatch |
| **ECS task role** | Same time (if app needs AWS APIs) | Read Secrets Manager, S3, etc. — only if the app uses AWS SDK |
| **GitHub Actions OIDC role** | Optional, when CI pushes to ECR/ECS | Deploy without long-lived AWS keys on laptop |
| **RDS / Postgres** | Never uses IAM | Username + password (`AWS_RDS_URL`) |
| **Cloudflare R2** | Never uses AWS IAM | Access key + secret in env vars |

**Order:** Network + RDS (now) → migrations → Redis → build/push images → **then** ECS + IAM roles.  
**Not first:** IAM roles are irrelevant until something runs *inside* AWS (ECS/Lambda).

---

## Phased roadmap

### Phase 0 — Local production shape ✅

- [x] Docker Compose full stack
- [x] Drizzle schema + migrations
- [x] BullMQ worker + inference service
- [x] `ARCHITECTURE.md` env mapping

### Phase 1 — AWS foundation 🔄

- [x] CloudFormation: VPC, subnets, NAT, SGs, ECR
- [ ] CloudFormation: RDS `UPDATE_COMPLETE`
- [ ] Save `DBPassword` securely (not only template default)
- [ ] Record `RDSEndpoint` in password manager / `.env.aws` (gitignored)

### Phase 2 — Database on RDS (next after Phase 1 completes)

RDS is in **private subnets** with **no public IP** — your laptop cannot run `npm run db:migrate` directly.

Pick one path:

| Option | Security | Effort | Recommendation |
|--------|----------|--------|----------------|
| **A. One-off ECS task** | Best fit for private RDS | Medium | **Preferred** — run migrate inside VPC |
| **B. Bastion + SSH tunnel** | Strong | Higher | **Chosen** — see [`BASTION.md`](./BASTION.md) |
| **C. Temporary public RDS** | Weakest | Low | Only short window; revert after migrate |

**Steps (all options need `AWS_RDS_URL`):**

```bash
# From CloudFormation Output RDSEndpoint + stack DBPassword parameter you set:
# postgresql://skinfit:<password>@<RDSEndpoint>:5432/skinfit
export AWS_RDS_URL='postgresql://skinfit:YOUR_PASSWORD@YOUR_ENDPOINT:5432/skinfit'

npm run db:migrate
npm run db:seed    # optional, non-production only
```

See [`/.env.aws.example`](./.env.aws.example) (copy to repo root as `.env.aws`, never commit).

### Phase 3 — Redis on AWS

- [ ] Stack update with ElastiCache resources — see [`ELASTICACHE.md`](./ELASTICACHE.md)
- [x] Security group allows 6379 from Next.js + ML worker SGs (already in template)
- [ ] Copy `ElastiCacheUrl` from CloudFormation Outputs after deploy
- [ ] Set `ELASTICACHE_URL` on ECS tasks (Phase 4); keep `LOCAL_REDIS_URL` for local dev only

Until then: keep using local Redis for dev; production ECS will need ElastiCache before async scans work in cloud.

### Phase 4 — Containers on ECS Fargate

- [ ] Build and push images to ECR (`docker/Dockerfile.web`, etc.)
- [ ] **Create IAM roles here** (execution + task)
- [ ] ECS services: `web`, `ml-worker`, `ml-inference` in private subnets
- [ ] ALB → Next.js (public subnets)
- [ ] Secrets Manager or SSM for `SESSION_SECRET`, `DBPassword`, API keys
- [ ] Wire env: `AWS_RDS_URL`, `ELASTICACHE_URL`, `SCAN_ASYNC_MODE=1`

### Phase 5 — DNS, TLS, observability

- [ ] Route 53 or Cloudflare DNS → ALB
- [ ] ACM certificate on ALB (HTTPS)
- [ ] CloudWatch alarms + Sentry
- [ ] Monitoring runbook: [`MONITORING_SECURITY.md`](./MONITORING_SECURITY.md)

### Phase 6 — Deferred (your choice)

- [ ] Cloudflare R2 (`STORAGE_DRIVER=r2`, presigned uploads)
- [ ] Mobile production `EXPO_PUBLIC_*` pointing to live API
- [ ] Multi-AZ RDS, deletion protection, backup retention tuning

---

## What to do right now

1. Wait for stack **`UPDATE_COMPLETE`** (RDS ~5–7 min).
2. Open **Outputs** → copy **`RDSEndpoint`**.
3. Create root `.env.aws` from [`.env.aws.example`](./.env.aws.example) with real password.
4. Deploy bastion via stack update — [`BASTION.md`](./BASTION.md) (needs your IP + `skinfit-key.pem`).
5. Continue local dev with Docker; **skip R2** until Phase 6.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Default `DBPassword` in template | Change in stack parameters; rotate after first login |
| RDS not reachable from laptop | Expected; use Phase 2 option A or B |
| ML model volume on ECS | EFS or bake models into `ml-inference` image / S3 pull at start |
| `PubliclyAccessible: false` | Correct for production; do not open to `0.0.0.0/0` without a plan |

---

## File map

| File | Role |
|------|------|
| `infra/cloudformation.yaml` | AWS network + RDS + ECR |
| `infra/.env.local.example` | Local Docker dev |
| `infra/.env.aws.example` | Production DB URL template |
| `docker/docker-compose.yml` | Local full stack |
| `services/shared/src/env/index.ts` | URL resolution for cloud |
| `ARCHITECTURE.md` | Async scan + env table |

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-05 | Postpone Cloudflare R2; stay on local/volume storage |
| 2026-05 | Deploy VPC + RDS via single CloudFormation stack |
| 2026-05 | IAM for ECS deferred until Fargate deploy |
