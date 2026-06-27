# Acne Detector v1 — ECS Deployment (automated)

YOLO-based acne detection service. During a scan, the ml-worker calls this
service with the **centre** image and replaces **only** the acne score + acne
annotated image in the report. Wrinkles, pigmentation, skin quality, sagging,
etc. still come from the DINOv2 face_analysis model.

```
ml-worker ──POST /analyze (centre.jpg)──▶ acne-detector.skinfit.local:8000
          └─ existing face analysis ────▶ ml-inference.skinfit.local:8765
```

## Fully automated — nothing manual

Everything runs from the existing GitHub Actions deploy (`deploy-ecs.yml`) on
push to `main`:

1. **Model** — `models/acne-detector/best.pt` (50 MB YOLO weights) is tracked
   via **Git LFS** and baked into the image. No EFS setup needed.
2. **ECR repo** — auto-created if missing (`Ensure acne-detector ECR repo` step).
3. **Image** — built + pushed (`skinfit-acne-detector:latest` + SHA).
4. **ECS service** — `infra/ecs/deploy-acne-detector.sh` provisions it:
   - copies subnets + security group + execution role from the ml-worker service
   - adds a self-referencing SG rule on :8000 so the worker can reach it
   - creates a Cloud Map entry `acne-detector.skinfit.local`
   - injects `ACNE_DETECTOR_SERVICE_URL` into the ml-worker task def (first run only)
   - idempotent: re-runs just force a new deployment

### Prerequisites (already in place from ECS_4C.md)
- Cloud Map private DNS namespace `skinfit.local` (created with ml-inference).
- ml-worker service running (the script copies its network config).

## Manual run (optional)

```bash
export ECR_REGISTRY="417326870953.dkr.ecr.ap-south-1.amazonaws.com"
export IMAGE_TAG=latest
bash infra/ecs/deploy-acne-detector.sh
```

## Toggle off

Set `ACNE_DETECTOR_DISABLED=1` on the ml-worker task def — scans fall back to
the DINO acne score/mask. The detector is also soft-fail: if the service is
unreachable, the scan completes with the DINO acne output and logs
`acne_detector_skipped`.

## Verify

```bash
# From any host/container in the VPC:
curl -X POST http://acne-detector.skinfit.local:8000/analyze -F "file=@face.jpg"
```

Logs: CloudWatch `/ecs/skinfit-acne-detector`.

## Retiring the old VM systemd service

Once ECS scans show the new acne grade, the legacy `acne-api.service` on the VM
(`13.234.166.154`, systemd, port 8000) can be stopped:

```bash
sudo systemctl disable --now acne-api
```

The nginx `/acne-detector-v1/` route on the VM now points at the
`acne-detector` compose container (see `docker/docker-compose.prod.yml`).
