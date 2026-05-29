# Skinfit Clinic — Cost-Optimized Migration Runbook

Move from the current managed AWS stack (ECS/RDS/Redis/ALB/NAT) to a cheaper
single-VM setup while preserving your Phase 1/2/partial 3 work.

Target audience: founder/solo operator launching with low-to-moderate traffic.

---

## 1) Why this migration

For early-stage usage, the current architecture is production-grade but has
high fixed monthly cost from:

- NAT Gateway
- ALB
- ECS Fargate always-on tasks
- Managed Redis + managed Postgres

This runbook consolidates runtime services on one VM and keeps your existing
application architecture (Docker, worker queue, async scans, caching logic).

---

## 2) What is NOT wasted (reuse list)

Keep all of these as-is:

- Async architecture: queue + worker + inference flow
- Dockerfiles and docker-compose model
- API design, scan routes, doctor/patient flows
- Redis cache keys and invalidation logic
- Storage abstraction (`local` / `r2`)
- CI/CD conventions and scripts
- Monitoring patterns and runbooks

Only infra runtime changes; core app/business logic remains reusable.

---

## 2.1) What features/capabilities will be reduced or removed

Your product features (scan flow, history, doctor portal, chat, caching) stay.
What changes are mostly infrastructure capabilities:

## Likely removed in cheap setup

- Managed autoscaling behavior from ECS/Fargate (min/max task scaling)
- Multi-AZ managed database resilience if you move off managed RDS
- Managed Redis durability/availability from ElastiCache
- ALB-native traffic distribution and health routing
- Private-subnet outbound model via NAT (you may use public VM egress instead)

## Likely reduced (but still possible with manual work)

- Zero-downtime deploy confidence (single VM deploys are riskier)
- Fault tolerance (single VM is a single point of failure)
- Automatic self-healing depth (fewer managed control-plane guarantees)
- Production observability depth (usually reduced to basic logs/alerts initially)
- Security isolation granularity (fewer SG/subnet boundaries vs full VPC design)

## Not removed (app-level features you implemented remain)

- Async scan pipeline (queue -> worker -> inference)
- Redis-backed caching + invalidation logic
- Scan report generation and tracker logic
- Doctor/patient chat and feedback workflows
- Storage abstraction and R2 compatibility
- CI workflow patterns (can be adapted to new runtime target)

---

## 3) Target cheaper architecture

## Core

- 1 VM (`t3.small` or `t3.medium`)
- Docker Compose running:
  - `web` (Next.js app/API)
  - `ml-worker`
  - `ml-inference`
  - `redis`
  - `postgres` (or external managed Postgres)
  - `nginx` reverse proxy

## Keep external where sensible

- Keep Cloudflare R2 (if already used)
- Keep Cloudflare DNS/proxy for TLS and basic protection
- Keep minimal error tracking (Sentry free tier)

---

## 4) Cost expectation

Typical low-cost launch target:

- VM: ~$15-45/mo
- Storage snapshots/backups/logging: ~$5-20/mo
- Optional managed DB/Redis add-ons: +$0-40/mo

Expected range: ~$20-80/month, depending on VM size and traffic.

---

## 5) Migration strategy (phased)

Use a parallel cutover to avoid downtime.

1. Build new cheap environment fully in parallel.
2. Verify functionality end-to-end.
3. Switch DNS/API traffic.
4. Observe stability for 24-48h.
5. Decommission expensive AWS services.

Never delete current production resources before successful cutover tests.

---

## 6) Pre-migration checklist

- [ ] Export current production env vars and secrets.
- [ ] DB backup/snapshot completed and verified.
- [ ] Queue drain plan ready (avoid losing in-flight jobs).
- [ ] Model files/weights paths documented.
- [ ] Domain/DNS access ready.
- [ ] Rollback path prepared (old infra remains available until sign-off).

---

## 7) Build the new stack

## 7.1 VM baseline

- Ubuntu LTS
- Install Docker + Docker Compose plugin
- Enable firewall: allow `22`, `80`, `443` only
- Enable automatic security updates
- Configure swap (for memory spikes)

## 7.2 Folder layout (example)

`/opt/skinfit`

- `docker-compose.prod.yml`
- `.env.prod` (not committed)
- `nginx/`
- `backups/` scripts
- `deploy/` scripts

## 7.3 Compose services (minimum)

- `web`: Next.js runtime container
- `ml-worker`: BullMQ worker
- `ml-inference`: FastAPI inference server
- `redis`: local Redis container
- `postgres`: local Postgres container (or external URL)
- `nginx`: public entrypoint reverse proxy

**Nginx setup (repo):** see [`nginx/README.md`](../nginx/README.md). On the VM:

```bash
cd /opt/skinfit && git pull
bash scripts/setup-nginx-prod.sh
```

Use `docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d`.

## 7.4 Persistence

Use named volumes for:

- Postgres data
- Redis persistence (if needed)
- Uploads/models/shared assets

---

## 8) Environment variable mapping

Example high-level mapping:

- `AWS_RDS_URL` -> `DATABASE_URL` (local postgres container or external managed DB)
- `ELASTICACHE_URL` -> local `redis://redis:6379`
- `SCAN_ASYNC_MODE=1` keep enabled
- `STORAGE_DRIVER` = `local` or `r2` (your choice)
- `FACE_ANALYSIS_SERVICE_URL` -> internal compose DNS (e.g. `http://ml-inference:8765`)

Keep secrets out of git:

- session secret
- OpenAI keys
- OAuth keys
- DB password
- R2 keys

---

## 9) Data migration plan

## 9.1 PostgreSQL

Preferred:

1. Take final snapshot/dump from current DB.
2. Restore into new Postgres target.
3. Run migrations against new target.
4. Validate table counts and key records.

## 9.2 Redis

No strict migration required for cache keys.
For queue jobs:

- stop new scan submissions temporarily during cutover window, OR
- drain outstanding jobs before final switch.

---

## 10) Functional verification before cutover

Run this full smoke test on new stack:

- [ ] Login / session works
- [ ] Patient dashboard loads
- [ ] Scan submit -> worker -> inference -> result complete
- [ ] History page + report pages render
- [ ] Doctor portal reads/writes notes
- [ ] Chat persistence works
- [ ] Cache keys populate and invalidate correctly
- [ ] File uploads/read paths are valid
- [ ] Background jobs survive container restart

---

## 11) Cutover steps (low downtime)

1. Set maintenance window for low-traffic hour.
2. Freeze write-heavy features briefly (scan submit/journal edits) if needed.
3. Take final DB backup.
4. Point DNS/API endpoint to new VM (or update reverse proxy upstream).
5. Re-enable writes.
6. Monitor logs/errors/latency for 24-48h.

Rollback:

- Re-point DNS back to old ALB endpoint.
- Re-enable old ECS services.

---

## 12) Decommission expensive AWS resources (after successful cutover)

Recommended order:

1. ECS services desired count -> `0`
2. Delete ALB
3. Delete NAT Gateway + release Elastic IP
4. Delete ElastiCache Redis
5. Stop or delete RDS (after verified backup)
6. Keep ECR/CloudWatch only if still needed

Warning: deleting NAT/ALB while old stack is active can break old environment.

---

## 13) Minimal operations for the new stack

## Daily

- container health check
- disk usage check
- error logs scan

## Weekly

- backup success verification
- restore drill (small subset)
- package/security updates

## Monthly

- infra cost review
- right-size VM
- prune old docker images/volumes/logs

---

## 14) Security baseline on cheap setup

- Cloudflare proxy + TLS
- strict firewall (22, 80, 443)
- disable password SSH; key-based only
- fail2ban (optional but recommended)
- rotate secrets every 60-90 days
- DB access local/private only (no public Postgres unless required)

---

## 15) When to move back to managed AWS

Return to ECS/RDS/Redis managed stack when one or more are true:

- sustained CPU > 60-70% on VM
- queue backlog consistently high
- frequent noisy-neighbor or memory pressure issues
- need high availability/SLA beyond single VM tolerance
- team bandwidth available for production hardening

---

## 16) Recommended decision for your current stage

Given Phase 1 + 2 complete and partial Phase 3, a cost-focused launch can use:

- Single VM + Docker Compose now
- Keep current AWS assets only as rollback for a short overlap window
- Decommission high fixed-cost resources after stable cutover

This preserves your engineering work and improves runway during validation.

---

## 17) Go/No-Go checklist (decide this week)

Use this quick checklist to decide whether to remain on managed AWS now or move
to the cheaper setup immediately.

## Go to cheaper setup now (recommended) if 5+ are true

- [ ] Monthly budget target is below ~$150
- [ ] Current or projected infra spend feels runway-threatening
- [ ] Single-VM downtime risk is acceptable for current stage
- [ ] Team can manage basic VM ops (updates, backups, restart procedures)
- [ ] You can tolerate reduced autoscaling and HA for 1-3 months
- [ ] You want fastest cost reduction over managed-service convenience
- [ ] Traffic is still low/moderate and burst behavior is manageable
- [ ] A rollback path to AWS is already documented

## Stay on AWS for now if 4+ are true

- [ ] Monthly budget can support ~$300-$500 comfortably
- [ ] Uptime/reliability expectations are high from day one
- [ ] You need managed autoscaling immediately
- [ ] You need VPC-grade network isolation/compliance posture now
- [ ] Team does not want VM maintenance overhead
- [ ] You expect sudden growth spikes that exceed one VM quickly

## Hard stop checks before any migration cutover

- [ ] Fresh DB backup completed and restore tested
- [ ] New stack passes full functional smoke tests
- [ ] Queue drain/freeze plan for in-flight jobs is ready
- [ ] DNS cutover and rollback steps are rehearsed
- [ ] Owner on-call during cutover window

## Decision output template (fill this in)

- Decision date:
- Decision owner:
- Chosen path: `Stay on AWS` / `Move to cheap setup`
- Top 3 reasons:
  1.
  2.
  3.
- Revisit date (2-6 weeks):
