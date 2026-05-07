# Production Backup Runbook (VPS)

## Current Design
- Schedule: Daily at 01:00 (server local time)
- Retention: Keep latest 3 backups only
- Scope: PostgreSQL dump + `/app/storage` + compose/env snapshot + app snapshot
- Notification: Telegram (success/failure)

## Current Notification Behavior
- Daily backup sends Telegram messages to the owner on success/failure.
- Success message format is similar to:

```text
CES Backup OK on <hostname> at <YYYY-MM-DD HH:MM:SS> dir=<backup-dir>
```

- A failure message is similar to:

```text
CES Backup FAILED on <hostname> at <YYYY-MM-DD HH:MM:SS> code=<exit-code>
```

- Screenshot evidence from 2026-05-05 through 2026-05-07 shows daily OK messages at about 01:00 server time, delivered to Telegram around 08:00 Thailand time.
- The observed Telegram messages currently show backup dirs under `/root/ces_sale_operation_backups/production/...`.
- Newer repository scripts default to `/srv/ces_sale_operation_backups/production`.
- Before changing backup paths or restore commands, always verify the actual VPS crontab and existing backup root. Do not delete or overwrite either backup root until the active cron path is confirmed.

## Script Paths on VPS
- App dir: `/srv/ces_sale_operation_system`
- Observed active backup script on 2026-05-07: `/root/backup-scripts/ces-prod-backup.sh`
- Observed active notification env on 2026-05-07: `/root/backup-scripts/backup-notify.env`
- Observed active daily backup root from Telegram and manual deploy backup: `/root/ces_sale_operation_backups/production`
- Observed active cron log: `/var/log/ces-prod-backup.log`
- Repository default backup root: `/srv/ces_sale_operation_backups/production`
- Repository backup scripts are under `scripts/backup/` in git. They may not be installed at `/srv/ces_sale_operation_backups/scripts` on the VPS.

Verify active cron:

```bash
ssh root@187.77.156.215
crontab -l | grep ces-prod-backup.sh
```

If cron points to `/root/backup-scripts`, use the `/root/...` restore paths for those backup sets. If cron points to `/srv/ces_sale_operation_backups/scripts`, use the `/srv/...` restore paths below.

Observed active cron on 2026-05-07:

```bash
0 1 * * * /root/backup-scripts/ces-prod-backup.sh >> /var/log/ces-prod-backup.log 2>&1
```

Manual pre-deploy backup created on 2026-05-07:

```text
/root/ces_sale_operation_backups/production/20260507_135711
```

## One-Time Install/Sync from Mac
Run from repository root on Mac:

```bash
chmod +x scripts/backup/install-vps-backup-cron.sh
./scripts/backup/install-vps-backup-cron.sh
```

## Telegram Setup
1. Message bot `@ces_sale_operation_bot` once (`/start`).
2. Put values in the active notification env. On the current VPS this is `/root/backup-scripts/backup-notify.env`:

```bash
TELEGRAM_BOT_TOKEN=<your_token>
TELEGRAM_CHAT_ID=<your_chat_id>
```

3. Test manually:

```bash
APP_DIR=/srv/ces_sale_operation_system \
BACKUP_ROOT=/root/ces_sale_operation_backups/production \
NOTIFY_ENV=/root/backup-scripts/backup-notify.env \
bash /root/backup-scripts/ces-prod-backup.sh
```

## Verify Cron
```bash
crontab -l | grep ces-prod-backup.sh
```
Expected for the currently observed VPS setup:

```bash
0 1 * * * /root/backup-scripts/ces-prod-backup.sh >> /var/log/ces-prod-backup.log 2>&1
```

## Verify Backup Count (Should be 3)
```bash
find /srv/ces_sale_operation_backups/production -mindepth 1 -maxdepth 1 -type d | wc -l
```

If the active Telegram path is still `/root`, verify that backup root instead:

```bash
find /root/ces_sale_operation_backups/production -mindepth 1 -maxdepth 1 -type d | wc -l
```

## Verify Latest Backup Contents
```bash
LATEST="$(find /srv/ces_sale_operation_backups/production -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -n | tail -n 1 | awk '{print $2}')"
echo "$LATEST"
ls -lh "$LATEST"
cat "$LATEST/metadata.env"
sha256sum -c "$LATEST/SHA256SUMS"
```

For the observed `/root` backup root:

```bash
LATEST="$(find /root/ces_sale_operation_backups/production -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -n | tail -n 1 | awk '{print $2}')"
echo "$LATEST"
ls -lh "$LATEST"
```

## Restore
Latest backup:

```bash
APP_DIR=/srv/ces_sale_operation_system \
BACKUP_ROOT=/root/ces_sale_operation_backups/production \
bash /root/backup-scripts/ces-prod-restore.sh latest
```

Specific timestamp:

```bash
APP_DIR=/srv/ces_sale_operation_system \
BACKUP_ROOT=/root/ces_sale_operation_backups/production \
bash /root/backup-scripts/ces-prod-restore.sh 20260507_135711
```

## Backup Contents
Each backup directory should contain:
- `db.dump` - PostgreSQL custom-format dump
- `storage.tgz` - `/app/storage`
- `config_snapshot.tgz` - compose/env files
- `app_snapshot.tgz` - app source snapshot
- `compose_ps.txt` - container status at backup time
- `metadata.env` - timestamp, host, app dir, compose/env names
- `SHA256SUMS` - checksums for backup archives

## Restore Safety Notes
- Prefer restore from a known-good backup over ad-hoc Alembic downgrades in production.
- Restoring runs `pg_restore --clean --if-exists`, so it replaces current DB objects.
- After restore, always verify:

```bash
cd /srv/ces_sale_operation_system
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl -fsS http://localhost:8000/health
docker exec \
  $(docker compose -f docker-compose.prod.yml --env-file .env.prod ps -q backend) \
  alembic current
```

## Notes
- Do not commit real Telegram token/chat id into git.
- Keep only `scripts/backup/backup-notify.env.example` in repository.
- After emergency hotfixes on VPS, sync script/doc updates back to Mac repo immediately.
