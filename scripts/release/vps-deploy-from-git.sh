#!/usr/bin/env bash
set -euo pipefail

# Deploy a specific commit or tag on VPS.
# Usage:
#   REPO_URL=git@github.com:owner/repo.git ./scripts/release/vps-deploy-from-git.sh <commit-or-tag> [--no-build]

APP_DIR="${APP_DIR:-/root/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
REPO_URL="${REPO_URL:-}"
TARGET_REF="${1:-}"
BUILD_FLAG="${2:-}"

if [[ -z "$TARGET_REF" ]]; then
  echo "Usage: $0 <commit-or-tag> [--no-build]"
  exit 1
fi

if [[ "$BUILD_FLAG" != "" && "$BUILD_FLAG" != "--no-build" ]]; then
  echo "Usage: $0 <commit-or-tag> [--no-build]"
  exit 1
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [[ ! -d .git ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "ERROR: $APP_DIR has no .git; provide REPO_URL to bootstrap"
    exit 2
  fi
  git init
  git remote add "$REMOTE_NAME" "$REPO_URL"
fi

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  if [[ -z "$REPO_URL" ]]; then
    echo "ERROR: remote '$REMOTE_NAME' not set; provide REPO_URL"
    exit 2
  fi
  git remote add "$REMOTE_NAME" "$REPO_URL"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree has tracked changes in $APP_DIR"
  git status --short
  exit 3
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing env file $APP_DIR/$ENV_FILE"
  exit 4
fi

git fetch --tags "$REMOTE_NAME"
TARGET_COMMIT="$(git rev-parse --verify "$TARGET_REF^{commit}")"
CURRENT_COMMIT="$(git rev-parse --verify HEAD 2>/dev/null || echo none)"

echo "Current: $CURRENT_COMMIT"
echo "Target : $TARGET_COMMIT"

git checkout --force --detach "$TARGET_COMMIT"

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
if [[ "$BUILD_FLAG" == "--no-build" ]]; then
  $COMPOSE up -d
else
  $COMPOSE up -d --build
fi

BACKEND_CID="$($COMPOSE ps -q backend)"
if [[ -z "$BACKEND_CID" ]]; then
  echo "ERROR: backend container not running"
  exit 5
fi

docker exec "$BACKEND_CID" alembic upgrade head
curl -fsS http://localhost:8000/health >/dev/null

echo "DEPLOY_OK commit=$TARGET_COMMIT"
