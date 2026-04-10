#!/usr/bin/env bash
set -euo pipefail

# One-command deploy from Mac to production behind domain reverse proxy.
# Usage:
#   ./scripts/deploy-prod-domain.sh [build|quick]

MODE="${1:-build}"
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-187.77.156.215}"
VPS_PATH="${VPS_PATH:-/root/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-ces.msoftthai.com}"

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

echo "[1/6] Push latest $BRANCH"
git push origin "$BRANCH"

echo "[2/6] Create pre-deploy backup on VPS"
ssh "$VPS_USER@$VPS_HOST" "bash -s" <<'EOF'
set -euo pipefail
if [[ -x /root/backup-scripts/ces-prod-backup.sh ]]; then
  /root/backup-scripts/ces-prod-backup.sh
else
  echo "Backup script not found at /root/backup-scripts/ces-prod-backup.sh"
  exit 1
fi
EOF

echo "[3/6] Pull latest code and start containers"
ssh "$VPS_USER@$VPS_HOST" "bash -s" <<EOF
set -euo pipefail
cd "$VPS_PATH"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE in $VPS_PATH"
  exit 1
fi

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

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

docker exec "\$BACKEND_CONTAINER" alembic upgrade head
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
echo "If needed, rollback on VPS: /root/backup-scripts/ces-prod-restore.sh latest"
