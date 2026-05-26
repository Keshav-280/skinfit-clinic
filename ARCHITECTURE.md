# Skinfit local infrastructure architecture

Production-shaped layout that runs **entirely on Docker Compose** until AWS + Cloudflare billing is ready.

## Layout

```
apps/
  web/          → Next.js (root today; see apps/web/README.md)
  ml-worker/    → BullMQ consumer (Node)
docker/         → Compose + Dockerfiles
infra/          → env templates
models/         → Offline ML weights (not in git)
services/
  shared/       → storage, queue, cache, logging, notifications
  uploads/      → docs → app/api/uploads
  queue/        → docs → services/shared/queue
uploads/        → local object store (gitignored)
```

## Doctor–patient data isolation

Each clinician only sees patients linked in `doctor_patient_care` (created when an appointment is approved or booked from the doctor portal). Per pair:

- **Doctor chat**: `chat_threads.doctor_id` — one thread per doctor–patient pair; messages stored as plain text in `chat_messages`.
- **Scans, visits, voice notes, reports**: scoped by `doctor_id` + `user_id` (legacy rows with `doctor_id` null remain visible to the assigned doctor after migration).
- **Written feedback / visited flag**: stored on `doctor_patient_care`, not globally on `users`.
- **Patient portal**: `users.assigned_doctor_id` selects which clinician’s data the patient sees.

Doctor signup: `/doctor/signup` with `secretKey` validated against `DOCTOR_REGISTRATION_SECRET_KEY`. Run `drizzle/0032_doctor_patient_isolation.sql` before deploy.

Scheduling UI and calendar modules are unchanged in this pass.

## Async scan flow

```mermaid
sequenceDiagram
  participant Client
  participant API as Next.js API
  participant Storage as Local uploads
  participant Redis as BullMQ
  participant Worker as ml-worker
  participant ML as FastAPI inference

  Client->>API: POST /api/scans/submit (images)
  API->>Storage: storage.upload() per angle
  API->>Redis: enqueue scan-analysis
  API-->>Client: 202 { jobId }
  Client->>API: GET /api/scans/status/jobId
  Worker->>Redis: claim job
  Worker->>ML: HTTP inference (file paths)
  Worker->>Storage: persist mask URLs
  Worker->>API: write scan row + job completed
  Client->>API: poll until completed
```

## Environment abstraction

| Now | Later |
|-----|-------|
| `LOCAL_POSTGRES_URL` | `AWS_RDS_URL` |
| `LOCAL_REDIS_URL` | `ELASTICACHE_URL` |
| `STORAGE_DRIVER=local` | `STORAGE_DRIVER=r2` |
| Console JSON logs | CloudWatch + Sentry |

## Quick start

```bash
cp infra/.env.local.example .env.local
docker compose -f docker/docker-compose.yml up -d postgres redis ml-inference
npm run db:migrate   # includes 0031_storage_urls_and_scan_jobs.sql
npm run worker:dev   # apps/ml-worker — loads .env.local; needs ml-inference on :8765
npm run dev
```

Face analysis auth: set the same value for `FACE_ANALYSIS_SERVICE_SECRET` (worker/web → `X-API-Key`) and `FACE_ANALYSIS_API_KEY` (ml-inference `api_server.py`). Docker Compose services read `../.env.local` via `env_file` and override inference URL to `http://ml-inference:8765` inside the stack.

Set `SCAN_ASYNC_MODE=1` and use `POST /api/scans/submit` instead of blocking `POST /api/scan`.

Async scan jobs use BullMQ **5 attempts** with exponential backoff (5s base). Transient inference/network errors retry; auth/validation errors fail immediately. The DB stays `processing` until retries are exhausted (web + mobile poll `GET /api/scans/status/[jobId]` every 8s). Restart `npm run worker:dev` after changing worker retry logic.
