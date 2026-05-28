# ECS autoscaling (Phase 1 completion — Problem #3)

Default: **1 task** per service. Scale when CPU or queue depth grows.

## Prerequisites

- Cluster: `skinfit-cluster`
- Services: `skinfit-web`, `skinfit-ml-worker-service-o26zxlzb`
- Region: `ap-south-1`

---

## 1) Web — scale on CPU

**Console**

1. ECS → **Clusters** → `skinfit-cluster` → service **`skinfit-web`**
2. **Service auto scaling** → **Create**
3. Policy: **Target tracking** → metric **ECSServiceAverageCPUUtilization**
4. Target: **70%**, min **1**, max **4**
5. Save

**CLI** (replace `SERVICE_NAME` and get resource ID from describe):

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/skinfit-cluster/skinfit-web \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 4 \
  --region ap-south-1

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/skinfit-cluster/skinfit-web \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name skinfit-web-cpu-70 \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }' \
  --region ap-south-1
```

---

## 2) ML worker — scale on BullMQ queue depth (custom metric)

BullMQ queue name: **`scan-analysis`**.

**Simple approach (Phase 1):** scale worker on **CPU** like web (min 1, max 3) until custom CloudWatch metric is wired.

**Better (Phase 3):** publish `ApproximateNumberOfMessagesVisible` from Redis/ElastiCache or a Lambda that runs `LLEN` on BullMQ keys → target **5 pending jobs** per worker.

---

## 3) ML inference

Usually **fixed at 1** task (GPU/EFS weights). Scale workers, not inference, unless you run multiple inference replicas behind Cloud Map.

---

## Cost note

Each extra Fargate task adds ~$15–40/mo depending on CPU/RAM. Start with **max 2** until you load-test.
