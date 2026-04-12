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
BUNDLE_GATE="${BUNDLE_GATE:-1}"
EXPORT_BUNDLE_ARTIFACT="${EXPORT_BUNDLE_ARTIFACT:-1}"
MAX_CHUNK_KB="${MAX_CHUNK_KB:-1200}"

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

FRONTEND_CONTAINER=\$(\$COMPOSE ps -q frontend)
if [[ -z "\$FRONTEND_CONTAINER" ]]; then
  echo "V2 frontend container is not running"
  exit 1
fi

docker exec "\$BACKEND_CONTAINER" alembic upgrade head
curl -fsS http://localhost:8100/health >/dev/null

if [[ "$BUNDLE_GATE" == "1" ]]; then
  echo "Running frontend bundle analysis and chunk gate (MAX_CHUNK_KB=$MAX_CHUNK_KB) ..."
  docker exec "\$FRONTEND_CONTAINER" sh -lc "cd /app && npm run build:analyze && MAX_CHUNK_KB=$MAX_CHUNK_KB npm run check:bundle"
fi

echo "V2 deploy success: http://$VPS_HOST:5175"
EOF

if [[ "$EXPORT_BUNDLE_ARTIFACT" == "1" ]]; then
  mkdir -p deploy_artifacts/bundle-reports
  TS="$(date +%Y%m%d_%H%M%S)"
  SHORT_SHA="$(git rev-parse --short HEAD)"
  REMOTE_STATS_PATH="$VPS_PATH/frontend/dist/stats.html"
  LOCAL_STATS_PATH="deploy_artifacts/bundle-reports/v2_stats_${TS}_${SHORT_SHA}.html"
  if scp "$VPS_USER@$VPS_HOST:$REMOTE_STATS_PATH" "$LOCAL_STATS_PATH" >/dev/null 2>&1; then
    echo "Bundle report saved: $LOCAL_STATS_PATH"
  else
    echo "Warning: could not export bundle report from $REMOTE_STATS_PATH"
  fi
fi
