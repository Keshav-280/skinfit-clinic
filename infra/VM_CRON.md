# Prod cron on the VM (no cron-job.org)

All scheduled work uses the **ubuntu user crontab** on the EC2 box, same style as Postgres backups.

## Install once

```bash
cd /opt/skinfit

# Required in .env
# CRON_SECRET='long-random-string'

bash scripts/install-vm-cron.sh
```

## What runs

| Schedule (UTC) | Script | API route |
|----------------|--------|-----------|
| Daily 03:00 | `scripts/pg-backup.sh` | (local `pg_dump`) |
| Every 2 min | `scripts/cron-http-call.sh appointment-reminders` | `/api/cron/appointment-reminders` |
| Sun 01:00 | `scripts/cron-http-call.sh kai-weekly` | `/api/cron/kai-weekly` |
| 1st 02:00 | `scripts/cron-http-call.sh kai-monthly` | `/api/cron/kai-monthly` |

Calls go to `http://127.0.0.1` (nginx → `web`) with `Authorization: Bearer $CRON_SECRET`.

## Logs

- `/var/log/skinfit-pg-backup.log`
- `/var/log/skinfit-cron-reminders.log`
- `/var/log/skinfit-cron-kai-weekly.log`
- `/var/log/skinfit-cron-kai-monthly.log`

## Verify

```bash
crontab -l
bash scripts/cron-http-call.sh appointment-reminders
tail -20 /var/log/skinfit-cron-reminders.log
```

## Disable external cron

Pause or delete jobs on **cron-job.org** and Render so reminders/kAI are not double-fired.

## kai-monthly runtime

Heavy if `KAI_MONTHLY_CRON_RAG=1`. VM cron has no 30s HTTP limit (unlike cron-job.org). Still cap with `KAI_MONTHLY_CRON_MAX_PATIENTS` to control cost.

## Optional: change timezone

Crontab uses the server timezone (`timedatectl`). For IST schedules, either set `CRON_TZ=Asia/Kolkata` in crontab lines or adjust hour fields in `scripts/install-vm-cron.sh` and re-run install.
