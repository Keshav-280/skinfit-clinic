# Queue service

BullMQ queues (Redis):

| Queue | Name | Producer | Consumer |
|-------|------|----------|----------|
| Scan analysis | `scan-analysis` | `POST /api/scans/submit` | `apps/ml-worker` |
| Notifications | `notifications` | `publishNotification()` | future worker |
| Report generation | `report-generation` | cron / API | future worker |

Shared implementation: `services/shared/src/queue/`
