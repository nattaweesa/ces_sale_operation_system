#!/usr/bin/env bash
set -euo pipefail

VPS_USER="${VPS_USER:-cesdeploy}"
VPS_HOST="${VPS_HOST:-187.77.156.215}"
VPS_SCRIPTS_DIR="${VPS_SCRIPTS_DIR:-/srv/ces_sale_operation_backups/scripts}"

echo "[1/3] Upload backup scripts to ${VPS_USER}@${VPS_HOST}:${VPS_SCRIPTS_DIR}"
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${VPS_SCRIPTS_DIR}'"
scp scripts/backup/ces-prod-backup.sh "${VPS_USER}@${VPS_HOST}:${VPS_SCRIPTS_DIR}/ces-prod-backup.sh"
scp scripts/backup/ces-prod-restore.sh "${VPS_USER}@${VPS_HOST}:${VPS_SCRIPTS_DIR}/ces-prod-restore.sh"
scp scripts/backup/backup-notify.env.example "${VPS_USER}@${VPS_HOST}:${VPS_SCRIPTS_DIR}/backup-notify.env.example"


echo "[2/3] Set permissions and install daily cron"
ssh "${VPS_USER}@${VPS_HOST}" "bash -s" <<EOF
set -euo pipefail
SCRIPTS_DIR="$VPS_SCRIPTS_DIR"
chmod +x "${SCRIPTS_DIR}/ces-prod-backup.sh" "${SCRIPTS_DIR}/ces-prod-restore.sh"
if [[ ! -f "${SCRIPTS_DIR}/backup-notify.env" ]]; then
  cp "${SCRIPTS_DIR}/backup-notify.env.example" "${SCRIPTS_DIR}/backup-notify.env"
fi
chmod 600 "${SCRIPTS_DIR}/backup-notify.env"
( crontab -l 2>/dev/null | grep -v 'ces-prod-backup.sh' ; echo "0 1 * * * APP_DIR=/srv/ces_sale_operation_system BACKUP_ROOT=/srv/ces_sale_operation_backups/production NOTIFY_ENV=${SCRIPTS_DIR}/backup-notify.env ${SCRIPTS_DIR}/ces-prod-backup.sh >> /srv/ces_sale_operation_backups/ces-prod-backup.log 2>&1" ) | crontab -
EOF


echo "[3/3] Run one backup test"
ssh "${VPS_USER}@${VPS_HOST}" "APP_DIR=/srv/ces_sale_operation_system BACKUP_ROOT=/srv/ces_sale_operation_backups/production NOTIFY_ENV=${VPS_SCRIPTS_DIR}/backup-notify.env ${VPS_SCRIPTS_DIR}/ces-prod-backup.sh"
ssh "${VPS_USER}@${VPS_HOST}" "echo -n 'backup_count='; find /srv/ces_sale_operation_backups/production -mindepth 1 -maxdepth 1 -type d | wc -l"

echo "Done. Edit ${VPS_SCRIPTS_DIR}/backup-notify.env on VPS to set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID."