#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/ces_sale_operation_backups/production}"
KEEP_COUNT="${KEEP_COUNT:-3}"
NOTIFY_ENV="${NOTIFY_ENV:-/srv/ces_sale_operation_backups/backup-notify.env}"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TS}"

if [[ -f "$NOTIFY_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$NOTIFY_ENV"
fi

send_telegram() {
  local message="$1"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${message}" >/dev/null || true
  fi
}

on_error() {
  local exit_code=$?
  send_telegram "CES Backup FAILED on $(hostname) at $(date '+%Y-%m-%d %H:%M:%S') code=${exit_code}"
  exit "$exit_code"
}
trap on_error ERR

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
DB_CONTAINER="$($COMPOSE ps -q db)"
BACKEND_CONTAINER="$($COMPOSE ps -q backend)"

if [[ -z "${DB_CONTAINER}" || -z "${BACKEND_CONTAINER}" ]]; then
  echo "ERROR: db/backend container not running"
  exit 1
fi

{
  echo "timestamp=${TS}"
  echo "host=$(hostname)"
  echo "app_dir=${APP_DIR}"
  echo "compose_file=${COMPOSE_FILE}"
  echo "env_file=${ENV_FILE}"
} > "${BACKUP_DIR}/metadata.env"

$COMPOSE ps > "${BACKUP_DIR}/compose_ps.txt"

docker exec "$DB_CONTAINER" pg_dump -U ces -d ces_sale_operation -Fc > "${BACKUP_DIR}/db.dump"
docker exec "$BACKEND_CONTAINER" sh -c 'tar -czf - -C /app storage' > "${BACKUP_DIR}/storage.tgz"
tar -czf "${BACKUP_DIR}/config_snapshot.tgz" "$COMPOSE_FILE" "$ENV_FILE"
tar --exclude='backend/__pycache__' --exclude='frontend/node_modules' --exclude='frontend/dist' \
  -czf "${BACKUP_DIR}/app_snapshot.tgz" backend frontend docker-compose.prod.yml docker-compose.staging.yml docker-compose.yml

(cd "${BACKUP_DIR}" && sha256sum db.dump storage.tgz config_snapshot.tgz app_snapshot.tgz > SHA256SUMS)

# Keep only latest KEEP_COUNT backups by modified time.
mapfile -t dirs < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -n | awk '{print $2}')
if (( ${#dirs[@]} > KEEP_COUNT )); then
  delete_count=$(( ${#dirs[@]} - KEEP_COUNT ))
  for ((i=0; i<delete_count; i++)); do
    rm -rf "${dirs[$i]}"
  done
fi

send_telegram "CES Backup OK on $(hostname) at $(date '+%Y-%m-%d %H:%M:%S') dir=${BACKUP_DIR}"
echo "OK: backup created at ${BACKUP_DIR}"
