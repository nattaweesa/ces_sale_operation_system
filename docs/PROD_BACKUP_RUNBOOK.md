# Production Backup Runbook (VPS)

## Current Design
- Schedule: Daily at 01:00 (server local time)
- Retention: Keep latest 3 backups only
- Scope: PostgreSQL dump + `/app/storage` + compose/env snapshot + app snapshot
- Notification: Telegram (success/failure)

## Script Paths on VPS
- `/root/backup-scripts/ces-prod-backup.sh`
- `/root/backup-scripts/ces-prod-restore.sh`
- `/root/backup-scripts/backup-notify.env`

## One-Time Install/Sync from Mac
Run from repository root on Mac:

```bash
chmod +x scripts/backup/install-vps-backup-cron.sh
./scripts/backup/install-vps-backup-cron.sh
```

## Telegram Setup
1. Message bot `@ces_sale_operation_bot` once (`/start`).
2. Put values in `/root/backup-scripts/backup-notify.env`:

```bash
TELEGRAM_BOT_TOKEN=<your_token>
TELEGRAM_CHAT_ID=<your_chat_id>
```

3. Test manually:

```bash
/root/backup-scripts/ces-prod-backup.sh
```

## Verify Cron
```bash
crontab -l | grep ces-prod-backup.sh
```
Expected:

```bash
0 1 * * * /root/backup-scripts/ces-prod-backup.sh >> /var/log/ces-prod-backup.log 2>&1
```

## Verify Backup Count (Should be 3)
```bash
find /root/ces_sale_operation_backups/production -mindepth 1 -maxdepth 1 -type d | wc -l
```

## Restore
Latest backup:

```bash
/root/backup-scripts/ces-prod-restore.sh latest
```

Specific timestamp:

```bash
/root/backup-scripts/ces-prod-restore.sh 20260409_010000
```

## Notes
- Do not commit real Telegram token/chat id into git.
- Keep only `scripts/backup/backup-notify.env.example` in repository.
- After emergency hotfixes on VPS, sync script/doc updates back to Mac repo immediately.
