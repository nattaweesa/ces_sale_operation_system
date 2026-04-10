#!/usr/bin/env bash
set -euo pipefail

# Deploy V2 stack to new VPS path (does not touch V1)
# Usage:
#   ./scripts/deploy-v2.sh [build|quick]

MODE="${1:-quick}"
VPS_USER="root"
VPS_HOST="187.77.156.215"
VPS_PATH="/root/ces_sale_operation_v2"
COMPOSE_FILE="docker-compose.v2.yml"
ENV_FILE=".env.v2"
BRANCH="main"

if [[ "$MODE" != "build" && "$MODE" != "quick" ]]; then
  echo "Usage: $0 [build|quick]"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean. Commit or stash first."
  exit 1
fi

git push origin "$BRANCH"

ssh "$VPS_USER@$VPS_HOST" "bash -s" <<EOF
set -euo pipefail

mkdir -p "$VPS_PATH"
cd "$VPS_PATH"

if [[ ! -d .git ]]; then
  git init
  git remote add origin "$(git remote get-url origin)"
fi

git fetch origin
git checkout "$BRANCH" || git checkout -b "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE in $VPS_PATH"
  echo "Create it first from .env.v2.example with real secrets."
  exit 1
fi

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

if [[ "$MODE" == "build" ]]; then
  \$COMPOSE up -d --build
else
  \$COMPOSE up -d
fi

BACKEND_CONTAINER=\$(\$COMPOSE ps -q backend)
if [[ -z "\$BACKEND_CONTAINER" ]]; then
  echo "V2 backend container is not running"
  exit 1
fi

docker exec "\$BACKEND_CONTAINER" alembic upgrade head
curl -fsS http://localhost:8100/health >/dev/null

echo "V2 deploy success: http://$VPS_HOST:5175"
EOF
