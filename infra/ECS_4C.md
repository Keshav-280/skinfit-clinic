# Step 4c — ML worker + inference on ECS

Prerequisites: **4b done** (web on ALB), images in ECR built with **`--platform linux/amd64`**.

## What 4c adds

```text
Web (already running) → Redis (ElastiCache) → ml-worker → ml-inference
                              ↑                    ↑
                           same RDS            reads images from
                                                shared /uploads
```

| Service | Public? | Needs |
|---------|---------|--------|
| `ml-inference` | No (private only) | Model weights + `face_analysis_tool` on disk |
| `ml-worker` | No | Redis, RDS, inference URL, **same `/uploads` as web** |

---

## Part 0 — Re-push amd64 images (if not done after web fix)

```bash
export ECR_REGISTRY="417326870953.dkr.ecr.ap-south-1.amazonaws.com"
cd /Users/sagnikdey/skinfit-clinic

docker build --platform linux/amd64 -f docker/Dockerfile.ml-worker -t skinfit-ml-worker:latest .
docker tag skinfit-ml-worker:latest "${ECR_REGISTRY}/skinfit-ml-worker:latest"
docker push "${ECR_REGISTRY}/skinfit-ml-worker:latest"

docker build --platform linux/amd64 -f docker/Dockerfile.ml-inference -t skinfit-ml-inference:latest .
docker tag skinfit-ml-inference:latest "${ECR_REGISTRY}/skinfit-ml-inference:latest"
docker push "${ECR_REGISTRY}/skinfit-ml-inference:latest"
```

---

## Part 1 — Shared EFS volume (required)

Web and worker must share **`/uploads`**. Inference needs **`/models`** and **`face_analysis_tool`**.

### 1a) Create EFS

1. **EFS** → **Create file system**
2. **Name:** `skinfit-shared`
3. **VPC:** `skinfit-vpc`
4. **Mount targets:** all **private** subnets (`skinfit-private-1`, `skinfit-private-2`)
5. Create → note **File system ID** (e.g. `fs-0abc123...`)

### 1b) EFS security group

1. **EC2** → **Security groups** → **Create**
2. **Name:** `skinfit-efs-sg`
3. **VPC:** `skinfit-vpc`
4. **Inbound:** NFS, port **2049**, source = security groups:
   - `skinfit-nextjs-sg`
   - `skinfit-ml-worker-sg`
   - `skinfit-ml-inference-sg`
5. Edit EFS mount targets → attach **`skinfit-efs-sg`** (or add rule to default mount SG)

### 1c) Copy files onto EFS (one-time)

From **bastion** (SSH as before), install EFS utils and mount:

```bash
sudo yum install -y amazon-efs-utils
sudo mkdir -p /mnt/efs
sudo mount -t efs -o tls fs-YOUR_EFS_ID:/ /mnt/efs
sudo mkdir -p /mnt/efs/uploads /mnt/efs/models /mnt/efs/face_analysis
```

Copy from your Mac (examples — adjust paths):

```bash
# On Mac — upload to bastion first, then on bastion move into /mnt/efs
scp -i skinfit-key.pem -r ./models/checkpoints ec2-user@35.154.90.105:/tmp/models
scp -i skinfit-key.pem -r /path/to/face_analysis_tool ec2-user@35.154.90.105:/tmp/face_analysis
```

On bastion:

```bash
sudo cp -r /tmp/models/* /mnt/efs/models/
sudo cp -r /tmp/face_analysis/* /mnt/efs/face_analysis/
```

Required on EFS (match local layout):

- `/mnt/efs/models/checkpoints/face_analyzer_v13.pt`
- `/mnt/efs/models/dinov2_vitl14_reg.pth` (if used)
- `/mnt/efs/face_analysis/` (full repo for inference)

---

## Part 2 — Service discovery (worker finds inference)

1. **Cloud Map** → **Namespaces** → **Create**
2. **Type:** **DNS private**
3. **Name:** `skinfit.local`
4. **VPC:** `skinfit-vpc`
5. Create

Inference will register as **`ml-inference.skinfit.local:8765`**.

---

## Part 3 — Task definition: `skinfit-ml-inference`

**ECS** → **Task definitions** → **Create**

| Field | Value |
|-------|--------|
| Family | `skinfit-ml-inference` |
| Fargate | 2 vCPU, 4 GB (inference is heavy) |
| Execution role | `skinfitEcsTaskExecutionRole` |

**Container `inference`:**

- Image: `417326870953.dkr.ecr.ap-south-1.amazonaws.com/skinfit-ml-inference:latest`
- Port: **8765**
- Env:

| Key | Value |
|-----|--------|
| `FACE_ANALYSIS_CHECKPOINT` | `/models/checkpoints/face_analyzer_v13.pt` |
| `DINO_LOCAL_WEIGHTS` | **optional** — omit on ECS; first start downloads DINOv2 via `torch.hub` (~1 GB, needs NAT) |
| `FACE_ANALYSIS_API_KEY` | same as local `FACE_ANALYSIS_API_KEY` |

**DINO weights:** You do not need `dinov2_vitl14_reg.pth` on EFS. The inference image uses `backbone_offline.py`, which falls back to hub download when the file is missing. First task start may take **5–15 minutes** while weights download; later restarts use the hub cache in the container (ephemeral — re-download if task replaced unless you add the `.pth` to EFS later).

- **Volumes:** EFS → filesystem `skinfit-shared`
  - Container path `/models` → EFS path `/models`
  - Container path `/app/face_analysis` → EFS path `/face_analysis`
- Logs: `/ecs/skinfit-ml-inference`

**Service discovery (when creating service):** register as `ml-inference` in namespace `skinfit.local`.

---

## Part 4 — Service: `ml-inference`

**ECS** → `skinfit-cluster` → **Create service**

| Setting | Value |
|---------|--------|
| Task def | `skinfit-ml-inference` |
| Desired | 1 |
| Subnets | private |
| SG | `skinfit-ml-inference-sg` |
| Public IP | Off |
| Load balancer | **None** |
| Service discovery | Namespace `skinfit.local`, name **`ml-inference`**, port **8765** |

Wait until **Running**.

---

## Part 5 — Task definition: `skinfit-ml-worker`

| Field | Value |
|-------|--------|
| Family | `skinfit-ml-worker` |
| Fargate | 1 vCPU, 2 GB |
| Execution role | `skinfitEcsTaskExecutionRole` |

**Container `worker`:**

- Image: `.../skinfit-ml-worker:latest`
- No port mapping
- Env:

| Key | Value |
|-----|--------|
| `AWS_RDS_URL` | same as web (RDS host, encoded password) |
| `ELASTICACHE_URL` | from stack Outputs |
| `FACE_ANALYSIS_SERVICE_URL` | `http://ml-inference.skinfit.local:8765` |
| `FACE_ANALYSIS_SERVICE_SECRET` | same as web |
| `STORAGE_DRIVER` | `local` |
| `LOCAL_STORAGE_ROOT` | `/uploads` |

- **EFS mount:** container `/uploads` → EFS `/uploads`
- Logs: `/ecs/skinfit-ml-worker`

---

## Part 6 — Service: `ml-ml-worker`

Same as inference: private subnet, `skinfit-ml-worker-sg`, no ALB, desired **1**.

---

## Part 7 — Update `skinfit-web` (shared uploads)

1. New revision of **`skinfit-web`**
2. Add EFS volume: mount **`/uploads`** → EFS `/uploads`
3. Ensure `SCAN_ASYNC_MODE=1` and `FACE_ANALYSIS_SERVICE_SECRET` set
4. **Update service** → force new deployment

---

## Test async scan

1. Open ALB URL → submit a scan (async mode).
2. **ECS** → `ml-worker` logs → should show job processing.
3. **ECS** → `ml-inference` logs → inference requests.
4. UI polls until scan **completed**.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Worker `Missing image path` | Web/worker not sharing EFS `/uploads` |
| Inference crash on start | Models or `face_analysis` missing on EFS |
| Worker cannot reach inference | Service discovery DNS / SG port 8765 |
| `linux/amd64` pull error | Rebuild with `--platform linux/amd64` |
