#!/usr/bin/env bash
set -euo pipefail

# Roll back VPS deployment to a git tag.
# Usage:
#   REPO_URL=git@github.com:owner/repo.git ./scripts/release/vps-rollback-to-tag.sh <tag>

APP_DIR="${APP_DIR:-/srv/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
REPO_URL="${REPO_URL:-}"
TARGET_TAG="${1:-}"

if [[ -z "$TARGET_TAG" ]]; then
  echo "Usage: $0 <tag>"
  exit 1
fi

mkdir -p "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
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
TARGET_COMMIT="$(git rev-list -n 1 "$TARGET_TAG" 2>/dev/null || true)"
if [[ -z "$TARGET_COMMIT" ]]; then
  echo "ERROR: tag not found: $TARGET_TAG"
  exit 5
fi

echo "Rollback to tag $TARGET_TAG ($TARGET_COMMIT)"

git checkout --force --detach "$TARGET_COMMIT"

COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
$COMPOSE up -d --build

BACKEND_CID="$($COMPOSE ps -q backend)"
if [[ -z "$BACKEND_CID" ]]; then
  echo "ERROR: backend container not running"
  exit 6
fi

# If alembic_version is empty (pre-existing schema), stamp head first
if ! docker exec "$BACKEND_CID" alembic current 2>&1 | grep -qE '[a-f0-9]{8,}|\(head\)'; then
  echo "INFO: alembic_version empty — stamping head for pre-existing schema"
  docker exec "$BACKEND_CID" alembic stamp head
fi
docker exec "$BACKEND_CID" alembic upgrade heads
curl -fsS http://localhost:8000/health >/dev/null

echo "ROLLBACK_OK tag=$TARGET_TAG commit=$TARGET_COMMIT"
