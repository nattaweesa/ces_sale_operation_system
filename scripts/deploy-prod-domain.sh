#!/usr/bin/env bash
set -euo pipefail

# One-command deploy from Mac to production behind domain reverse proxy.
# Usage:
#   ./scripts/deploy-prod-domain.sh [build|quick]

MODE="${1:-build}"
VPS_USER="${VPS_USER:-cesdeploy}"
VPS_HOST="${VPS_HOST:-187.77.156.215}"
VPS_PATH="${VPS_PATH:-/srv/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-ces.msoftthai.com}"
MIN_AXIOS_VERSION="${MIN_AXIOS_VERSION:-1.15.0}"

version_ge() {
  local v1="$1"
  local v2="$2"
  [[ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" == "$v2" ]]
}

if [[ "$MODE" != "build" && "$MODE" != "quick" ]]; then
  echo "Usage: $0 [build|quick]"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash before production deploy."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "Refusing deploy from branch '$CURRENT_BRANCH'. Switch to '$BRANCH' first."
  exit 1
fi

LOCAL_AXIOS_VERSION="$(awk '/node_modules\/axios/{flag=1;next} flag&&/"version"/{gsub(/[", ]/,"",$2);print $2;flag=0}' frontend/package-lock.json)"
if [[ -z "$LOCAL_AXIOS_VERSION" ]]; then
  echo "Unable to read axios version from frontend/package-lock.json"
  exit 1
fi
if ! version_ge "$LOCAL_AXIOS_VERSION" "$MIN_AXIOS_VERSION"; then
  echo "Refusing deploy: axios lockfile version '$LOCAL_AXIOS_VERSION' is lower than required '$MIN_AXIOS_VERSION'"
  exit 1
fi

echo "[1/6] Push latest $BRANCH"
git push origin "$BRANCH"

echo "[2/6] Create pre-deploy backup on VPS"
VPS_USER="$VPS_USER" VPS_HOST="$VPS_HOST" VPS_PATH="$VPS_PATH" BACKUP_ROOT="/srv/ces_sale_operation_backups/production" ./backup-production.sh

echo "[3/6] Pull latest code and start containers"
ssh "$VPS_USER@$VPS_HOST" "bash -s" <<EOF
set -euo pipefail
cd "$VPS_PATH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing deploy on VPS: tracked changes present in $VPS_PATH"
  git status --short
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE in $VPS_PATH"
  exit 1
fi

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

REMOTE_AXIOS_VERSION="\$(awk '/node_modules\/axios/{flag=1;next} flag&&/"version"/{gsub(/[", ]/,"",\$2);print \$2;flag=0}' frontend/package-lock.json)"
if [[ -z "\$REMOTE_AXIOS_VERSION" ]]; then
  echo "Unable to read axios version on VPS from frontend/package-lock.json"
  exit 1
fi
if [[ "\$(printf '%s\n' "$MIN_AXIOS_VERSION" "\$REMOTE_AXIOS_VERSION" | sort -V | head -n1)" != "$MIN_AXIOS_VERSION" ]]; then
  echo "Refusing deploy on VPS: axios lockfile version '\$REMOTE_AXIOS_VERSION' is lower than required '$MIN_AXIOS_VERSION'"
  exit 1
fi

if [[ "$MODE" == "build" ]]; then
  \$COMPOSE up -d --build
else
  \$COMPOSE up -d
fi

BACKEND_CONTAINER="\$(\$COMPOSE ps -q backend)"
if [[ -z "\$BACKEND_CONTAINER" ]]; then
  echo "Backend container is not running"
  exit 1
fi

docker exec "\$BACKEND_CONTAINER" alembic upgrade heads
curl -fsS http://localhost:8000/health >/dev/null
EOF

echo "[4/6] Verify login page via domain"
curl -fsSI --max-time 20 "https://$DOMAIN/login" >/dev/null

echo "[5/6] Verify API health via domain"
curl -fsS --max-time 20 "https://$DOMAIN/api/health" >/dev/null

echo "[6/6] Verify no direct :8000 leak in frontend bundle"
ssh "$VPS_USER@$VPS_HOST" "bash -s" <<'EOF'
set -euo pipefail
if docker exec ces_sale_operation_system-frontend-1 sh -c "grep -R -n ':8000' /app/dist" >/tmp/ces_frontend_8000_check.log 2>&1; then
  echo "Found ':8000' in frontend bundle. Check /tmp/ces_frontend_8000_check.log"
  cat /tmp/ces_frontend_8000_check.log
  exit 1
fi
EOF

echo "Deploy complete."
echo "- Login: https://$DOMAIN/login"
echo "- API health: https://$DOMAIN/api/health"
echo "If needed, rollback on VPS: APP_DIR=$VPS_PATH BACKUP_ROOT=/srv/ces_sale_operation_backups/production $VPS_PATH/scripts/backup/ces-prod-restore.sh latest"
