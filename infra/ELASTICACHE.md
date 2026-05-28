# Phase 3 — ElastiCache Redis (BullMQ)

## Why you need this

Your async scan pipeline uses **BullMQ** on top of **Redis**:

```text
Patient submits scan
    → Next.js API enqueues job (Redis)
    → ml-worker picks job (Redis)
    → calls ml-inference, writes results to Postgres
```

| Environment | Redis |
|-------------|--------|
| **Local Docker** | `redis` container → `LOCAL_REDIS_URL=redis://127.0.0.1:6380` |
| **AWS production** | ElastiCache in private VPC → `ELASTICACHE_URL=redis://…` |

Without ElastiCache on AWS, the web app and worker have nowhere to store queues when running on ECS.

---

## How your code already supports it

`services/shared/src/env/index.ts`:

```typescript
getRedisUrl() → LOCAL_REDIS_URL || REDIS_URL || ELASTICACHE_URL || localhost
```

- **Docker / laptop:** keep `LOCAL_REDIS_URL` in `.env.local`
- **ECS tasks:** set only `ELASTICACHE_URL` (do **not** set `LOCAL_REDIS_URL`)

Used by:

- `services/shared/src/queue/queues.ts` — BullMQ
- `apps/ml-worker/src/worker.ts` — consumer
- `services/shared/src/cache/redis.ts` — optional cache

---

## What CloudFormation adds

Already in `infra/cloudformation.yaml` (after stack update):

| Resource | Purpose |
|----------|---------|
| `RedisSecurityGroup` | Port 6379 from Next.js + ML worker only |
| `RedisSubnetGroup` | Private subnets (same as RDS) |
| `RedisCluster` | Single-node Redis 7.1, `cache.t4g.micro` |

**Outputs:**

- `RedisEndpoint` — hostname
- `RedisPort` — usually `6379`
- `ElastiCacheUrl` — full `redis://host:6379` for env vars

Redis is **not** public. Only containers in your VPC (with the right security groups) can connect.

---

## Deploy (AWS Console)

1. **Update stack** → upload `infra/cloudformation.yaml` (same as RDS/bastion).
2. Keep existing parameters (`DBPassword`, `BastionKeyName`, `BastionAllowedIp`).
3. Wait **~10–15 minutes** (ElastiCache is slower than RDS).
4. **Outputs** → copy `ElastiCacheUrl` (e.g. `redis://skinfit-redis.xxxxx.cache.amazonaws.com:6379`).

---

## Wire into production (ECS — Phase 4)

On each ECS task definition (web + ml-worker):

```bash
ELASTICACHE_URL=redis://skinfit-redis.xxxxx.0001.aps1.cache.amazonaws.com:6379
AWS_RDS_URL=postgresql://skinfit:...@skinfit-db....:5432/skinfit
SCAN_ASYNC_MODE=1
# no LOCAL_REDIS_URL, no LOCAL_POSTGRES_URL
```

BullMQ will use the same queue names as locally; jobs enqueued in AWS stay in AWS Redis.

---

## Cost (rough)

- `cache.t4g.micro` — on the order of ~$12–15/month in `ap-south-1` (check AWS pricing).
- No NAT charges for Redis traffic inside the VPC.

---

## BullMQ: set `noeviction` (required)

Default ElastiCache often uses **`volatile-lru`**. BullMQ logs:

`IMPORTANT! Eviction policy is volatile-lru. It should be "noeviction"`

Under memory pressure, **`volatile-lru` can delete queue jobs**. Use **`noeviction`** so Redis returns errors instead of silently dropping work.

### Fix on existing cluster (Console — ~5 min)

1. **ElastiCache** → **Parameter groups** → **Create parameter group**
   - **Name:** `skinfit-redis-noeviction`
   - **Engine:** Redis 7.x → family **`redis7`**
   - **Description:** BullMQ noeviction
2. Open the new group → **Edit parameters** → find **`maxmemory-policy`** → set **`noeviction`** → **Save**
3. **ElastiCache** → **Redis OSS caches** → cluster **`skinfit-redis`** (or your cluster id)
4. **Modify**
   - **Parameter group:** `skinfit-redis-noeviction`
   - Apply **immediately** (or next maintenance window)
5. If prompted, **reboot** the node (policy change often needs one reboot).
6. Redeploy **ml-worker** (optional) → check `/ecs/skinfit-ml-worker` — the eviction warning should disappear.

**Verify (from bastion or any host in VPC with `redis-cli`):**

```bash
redis-cli -h <RedisEndpoint> -p 6379 CONFIG GET maxmemory-policy
# → noeviction
```

### Fix via CloudFormation (next stack update)

`infra/cloudformation.yaml` includes `RedisParameterGroup` with `maxmemory-policy: noeviction` on `RedisCluster`. Updating stack `skinfit-infrastructure` may reboot Redis during apply — prefer a short maintenance window.

---

## Optional later

- **AUTH token** — `TransitEncryptionEnabled` + `AuthToken` on ReplicationGroup (more secure, slightly more setup).
- **Multi-AZ replica** — for HA (not required for early production).
- **Memory alarm** — with `noeviction`, a full `cache.t4g.micro` rejects writes; watch `BytesUsedForCache`.

---

## Local dev unchanged

Keep using Docker Compose Redis. You do **not** need ElastiCache on your laptop.

```bash
docker compose -f docker/docker-compose.yml up -d redis
npm run worker:dev
```
