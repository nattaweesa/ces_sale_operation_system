#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/ces_sale_operation_backups/production}"
TARGET="${1:-latest}"

if [[ "$TARGET" == "latest" ]]; then
  BACKUP_DIR="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -n | tail -n 1 | awk '{print $2}')"
else
  BACKUP_DIR="${BACKUP_ROOT}/${TARGET}"
fi

if [[ -z "${BACKUP_DIR:-}" || ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: backup dir not found"
  exit 1
fi

cd "$APP_DIR"
tar -xzf "${BACKUP_DIR}/config_snapshot.tgz" -C "$APP_DIR"
tar -xzf "${BACKUP_DIR}/app_snapshot.tgz" -C "$APP_DIR"

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
$COMPOSE up -d db
DB_CONTAINER="$($COMPOSE ps -q db)"
cat "${BACKUP_DIR}/db.dump" | docker exec -i "$DB_CONTAINER" pg_restore -U ces -d ces_sale_operation --clean --if-exists --no-owner --no-privileges

$COMPOSE up -d --build
BACKEND_CONTAINER="$($COMPOSE ps -q backend)"
docker exec "$BACKEND_CONTAINER" sh -c 'rm -rf /app/storage/*'
cat "${BACKUP_DIR}/storage.tgz" | docker exec -i "$BACKEND_CONTAINER" sh -c 'tar -xzf - -C /app'

curl -fsS http://localhost:8000/health >/dev/null
echo "OK: restored from ${BACKUP_DIR}"
