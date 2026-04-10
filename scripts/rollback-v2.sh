#!/usr/bin/env bash
set -euo pipefail

VPS_USER="root"
VPS_HOST="187.77.156.215"
VPS_PATH="/root/ces_sale_operation_v2"
COMPOSE_FILE="docker-compose.v2.yml"
ENV_FILE=".env.v2"
BACKUP_ROOT="/root/ces_sale_operation_backups/v2"
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
  echo "V2 backup directory not found." >&2
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
  echo "V2 database container not available for restore." >&2
  exit 1
fi

cat "\$BACKUP_DIR/db.dump" | docker exec -i "\$DB_CONTAINER" pg_restore -U ces -d "\$db_name" --clean --if-exists --no-owner --no-privileges
\$COMPOSE up -d --build
BACKEND_CONTAINER=\$(\$COMPOSE ps -q backend)
if [[ -n "\$BACKEND_CONTAINER" && -f "\$BACKUP_DIR/storage_v2.tgz" ]]; then
  docker exec "\$BACKEND_CONTAINER" sh -c 'rm -rf /app/storage_v2/*'
  cat "\$BACKUP_DIR/storage_v2.tgz" | docker exec -i "\$BACKEND_CONTAINER" sh -c 'tar -xzf - -C /app'
fi

curl -fsS http://localhost:8100/health >/dev/null
printf '%s\n' "V2 rollback completed from \$BACKUP_DIR to commit \$commit"
EOF
