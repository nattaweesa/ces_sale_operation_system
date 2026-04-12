#!/bin/bash

set -euo pipefail

VPS_USER="${VPS_USER:-cesdeploy}"
VPS_HOST="${VPS_HOST:-187.77.156.215}"
VPS_PATH="${VPS_PATH:-/srv/ces_sale_operation_system}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/ces_sale_operation_backups/production}"
BACKUP_NAME="${1:-latest}"

ssh "$VPS_USER@$VPS_HOST" "bash -s" <<EOF
set -euo pipefail

VPS_PATH="$VPS_PATH"
COMPOSE_FILE="$COMPOSE_FILE"
ENV_FILE="$ENV_FILE"
BACKUP_ROOT="$BACKUP_ROOT"
BACKUP_NAME="$BACKUP_NAME"

if [[ "\$BACKUP_NAME" == "latest" ]]; then
  BACKUP_DIR=\$(find "\$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)
else
  BACKUP_DIR="\$BACKUP_ROOT/\$BACKUP_NAME"
fi

if [[ -z "\${BACKUP_DIR:-}" || ! -d "\$BACKUP_DIR" ]]; then
  echo "Backup directory not found." >&2
  exit 1
fi

source "\$BACKUP_DIR/metadata.env"
cd "\$VPS_PATH"

if [[ -f "\$BACKUP_DIR/config_snapshot.tgz" ]]; then
  tar -xzf "\$BACKUP_DIR/config_snapshot.tgz" -C "\$VPS_PATH"
fi

git fetch origin
git checkout --detach "\$commit"

COMPOSE="docker compose -f \$COMPOSE_FILE --env-file \$ENV_FILE"
\$COMPOSE up -d db
DB_CONTAINER=\$(\$COMPOSE ps -q db)
if [[ -z "\$DB_CONTAINER" ]]; then
  echo "Database container not available for restore." >&2
  exit 1
fi

cat "\$BACKUP_DIR/db.dump" | docker exec -i "\$DB_CONTAINER" pg_restore -U ces -d ces_sale_operation --clean --if-exists --no-owner --no-privileges
\$COMPOSE up -d --build
BACKEND_CONTAINER=\$(\$COMPOSE ps -q backend)
if [[ -n "\$BACKEND_CONTAINER" && -f "\$BACKUP_DIR/storage.tgz" ]]; then
  docker exec "\$BACKEND_CONTAINER" sh -c 'rm -rf /app/storage/*'
  cat "\$BACKUP_DIR/storage.tgz" | docker exec -i "\$BACKEND_CONTAINER" sh -c 'tar -xzf - -C /app'
fi
curl -fsS http://localhost:8000/health >/dev/null
printf '%s\n' "Rollback completed from \$BACKUP_DIR to commit \$commit"
EOF
