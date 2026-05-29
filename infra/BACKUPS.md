# Postgres backups (prod VM)

## Manual backup

```bash
cd /opt/skinfit
bash scripts/pg-backup.sh
```

Files: `/opt/skinfit/backups/postgres/skinfit-YYYYMMDD-HHMMSS.sql.gz`  
Retention: **14 days** (override with `RETENTION_DAYS=30`).

## Install daily cron (03:00 UTC)

```bash
cd /opt/skinfit
bash scripts/install-pg-backup-cron.sh
```

Log: `/var/log/skinfit-pg-backup.log`

## Restore (disaster recovery)

```bash
cd /opt/skinfit
gunzip -c backups/postgres/skinfit-XXXX.sql.gz | \
  docker compose -f docker/docker-compose.yml exec -T postgres \
  psql -U skinfit -d skinfit
```

Stop `web` and `ml-worker` before a full restore on a live DB.

## Optional: copy off-server

```bash
# Example: rsync to another machine (set up SSH keys first)
rsync -av /opt/skinfit/backups/postgres/ user@backup-host:/backups/skinfit/
```
