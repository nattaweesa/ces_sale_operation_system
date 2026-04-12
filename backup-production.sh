#!/bin/bash

set -euo pipefail

VPS_USER="${VPS_USER:-cesdeploy}"
VPS_HOST="${VPS_HOST:-187.77.156.215}"
VPS_PATH="${VPS_PATH:-/srv/ces_sale_operation_system}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/ces_sale_operation_backups/production}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="${1:-$TIMESTAMP}"

ssh "$VPS_USER@$VPS_HOST" "bash -s" <<EOF
set -euo pipefail

VPS_PATH="$VPS_PATH"
COMPOSE_FILE="$COMPOSE_FILE"
ENV_FILE="$ENV_FILE"
BACKUP_ROOT="$BACKUP_ROOT"
BACKUP_NAME="$BACKUP_NAME"
BACKUP_DIR="\$BACKUP_ROOT/\$BACKUP_NAME"

mkdir -p "\$BACKUP_DIR"
cd "\$VPS_PATH"

COMPOSE="docker compose -f \$COMPOSE_FILE --env-file \$ENV_FILE"
DB_CONTAINER=\$(\$COMPOSE ps -q db)
BACKEND_CONTAINER=\$(\$COMPOSE ps -q backend)
CURRENT_COMMIT=\$(git rev-parse HEAD)
CURRENT_BRANCH=\$(git rev-parse --abbrev-ref HEAD)

if [[ -z "\$DB_CONTAINER" || -z "\$BACKEND_CONTAINER" ]]; then
  echo "Production containers are not running; cannot create backup." >&2
  exit 1
fi

printf '%s\n' "timestamp=\$BACKUP_NAME" > "\$BACKUP_DIR/metadata.env"
printf '%s\n' "branch=\$CURRENT_BRANCH" >> "\$BACKUP_DIR/metadata.env"
printf '%s\n' "commit=\$CURRENT_COMMIT" >> "\$BACKUP_DIR/metadata.env"
printf '%s\n' "compose_file=\$COMPOSE_FILE" >> "\$BACKUP_DIR/metadata.env"
printf '%s\n' "env_file=\$ENV_FILE" >> "\$BACKUP_DIR/metadata.env"

\$COMPOSE ps > "\$BACKUP_DIR/compose_ps.txt"
git status --short > "\$BACKUP_DIR/git_status.txt"
git log -1 --oneline > "\$BACKUP_DIR/git_commit.txt"

tar -czf "\$BACKUP_DIR/config_snapshot.tgz" "\$COMPOSE_FILE" "\$ENV_FILE"
docker exec "\$DB_CONTAINER" pg_dump -U ces -d ces_sale_operation -Fc > "\$BACKUP_DIR/db.dump"
docker exec "\$BACKEND_CONTAINER" sh -c 'tar -czf - -C /app storage' > "\$BACKUP_DIR/storage.tgz"

printf '%s\n' "Backup created at \$BACKUP_DIR"
EOF
