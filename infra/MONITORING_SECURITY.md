# Monitoring + Alerts + Security (Phase 2)

This runbook covers:

1. Sentry for `web` + `ml-worker`
2. CloudWatch alarms (ALB 5xx, ECS CPU/memory, worker errors, Redis memory)
3. Secrets Manager migration from plain ECS env vars
4. Cloudflare WAF/rate limits

---

## 1) Sentry setup

Code-level support is in place for:

- Next.js (`@sentry/nextjs`) with:
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`
  - `instrumentation-client.ts`
- ML worker (`@sentry/node`) via `apps/ml-worker/src/sentry.ts`

### Required ECS env vars

Set on **web** and **ml-worker** task definitions:

| Variable | Example |
|---|---|
| `SENTRY_DSN` | `https://...@o000.ingest.sentry.io/000` |
| `SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` |

Also on **web** only:

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | same DSN (or project DSN) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.1` |
| `SENTRY_ORG` | your sentry org slug |
| `SENTRY_PROJECT` | your sentry project slug |

Redeploy `skinfit-web` and `skinfit-ml-worker-service-o26zxlzb`.

---

## 2) CloudWatch alarms

Create an SNS topic first (email/slack webhook target), then attach alarms.

```bash
export AWS_REGION=ap-south-1
export ALARM_TOPIC_ARN="arn:aws:sns:ap-south-1:417326870953:skinfit-alarms"
```

### ALB 5xx

```bash
aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "skinfit-alb-5xx-high" \
  --metric-name HTTPCode_ELB_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 5 \
  --threshold 10 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=LoadBalancer,Value=app/skinfit-alb/06d4cb03a734a4f4 \
  --alarm-actions "$ALARM_TOPIC_ARN"
```

### ECS service CPU / memory

```bash
aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "skinfit-web-cpu-high" \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --statistic Average \
  --period 60 \
  --evaluation-periods 5 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=skinfit-cluster Name=ServiceName,Value=skinfit-web \
  --alarm-actions "$ALARM_TOPIC_ARN"

aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "skinfit-web-memory-high" \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --statistic Average \
  --period 60 \
  --evaluation-periods 5 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=skinfit-cluster Name=ServiceName,Value=skinfit-web \
  --alarm-actions "$ALARM_TOPIC_ARN"
```

Repeat CPU/memory alarms for `skinfit-ml-worker-service-o26zxlzb`.

### Worker errors (log metric filter)

```bash
aws logs put-metric-filter \
  --region "$AWS_REGION" \
  --log-group-name /ecs/skinfit-ml-worker \
  --filter-name skinfit-worker-errors \
  --filter-pattern '"scan_job_failed"' \
  --metric-transformations \
    metricName=WorkerErrors,metricNamespace=Skinfit/Worker,metricValue=1

aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "skinfit-worker-errors-high" \
  --namespace Skinfit/Worker \
  --metric-name WorkerErrors \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions "$ALARM_TOPIC_ARN"
```

### Redis memory high

```bash
aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "skinfit-redis-memory-high" \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --statistic Average \
  --period 60 \
  --evaluation-periods 5 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=CacheClusterId,Value=skinfit-redis \
  --alarm-actions "$ALARM_TOPIC_ARN"
```

---

## 3) Move ECS secrets to AWS Secrets Manager

### A) Create secrets (one-time)

Example:

```bash
aws secretsmanager create-secret \
  --region ap-south-1 \
  --name skinfit/prod/SESSION_SECRET \
  --secret-string 'your-secret-here'
```

Do this for:

- `SESSION_SECRET`
- `AWS_RDS_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `CRON_SECRET`
- `FACE_ANALYSIS_SERVICE_SECRET`
- `SENTRY_DSN` (optional)

### B) Grant ECS task role access

Attach policy to task role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:ap-south-1:417326870953:secret:skinfit/prod/*"
    }
  ]
}
```

### C) Use ECS task `secrets` instead of plaintext `environment`

In container definition:

```json
{
  "name": "SESSION_SECRET",
  "valueFrom": "arn:aws:secretsmanager:ap-south-1:417326870953:secret:skinfit/prod/SESSION_SECRET"
}
```

Do this for web and worker where applicable.

---

## 4) Cloudflare WAF + rate limits

When DNS is in Cloudflare:

1. **Security > WAF > Managed rules**: enable default Cloudflare managed ruleset.
2. **Security > WAF > Custom rules**:
   - Block obvious bot abuse on `/api/auth/*`
   - Challenge high-frequency POST on `/api/scans/submit`
3. **Security > Rate limiting rules**:
   - `/api/auth/login`: e.g. 10 requests / 1 min / IP -> block 10 min
   - `/api/scans/submit`: e.g. 20 requests / 5 min / user/IP -> challenge
4. Keep app-level server rate limits in place (`checkRateLimit`) as second line.

---

## Validation checklist

- [ ] Sentry receives test event from web
- [ ] Sentry receives `scan_job_failed` event from worker (forced test)
- [ ] ALB 5xx alarm visible and `OK`
- [ ] ECS CPU/memory alarms visible and `OK`
- [ ] Worker error alarm visible and `OK`
- [ ] Redis memory alarm visible and `OK`
- [ ] Sensitive keys removed from ECS plaintext env vars
- [ ] Cloudflare WAF + rate limits active
