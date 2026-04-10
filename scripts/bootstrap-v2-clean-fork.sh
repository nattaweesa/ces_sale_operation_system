#!/usr/bin/env bash
set -euo pipefail

# Create clean fork folder from current workspace without touching V1 runtime files
# Usage:
#   ./scripts/bootstrap-v2-clean-fork.sh /absolute/path/to/new-v2-project

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${1:-}"

if [[ -z "$DEST_DIR" ]]; then
  echo "Usage: $0 /absolute/path/to/new-v2-project"
  exit 1
fi

if [[ -e "$DEST_DIR" ]]; then
  echo "Destination already exists: $DEST_DIR"
  exit 1
fi

mkdir -p "$DEST_DIR"

rsync -a \
  --exclude ".git" \
  --exclude ".venv" \
  --exclude "node_modules" \
  --exclude "deploy_artifacts" \
  --exclude "Quotations" \
  --exclude "backend/storage" \
  --exclude "frontend/dist" \
  "$SRC_DIR/" "$DEST_DIR/"

cd "$DEST_DIR"

if [[ ! -f ".env.v2" ]]; then
  cp .env.v2.example .env.v2
fi

echo "Clean fork created: $DEST_DIR"
echo "Next steps:"
echo "1) cd $DEST_DIR"
echo "2) Edit .env.v2"
echo "3) docker compose -f docker-compose.v2.yml --env-file .env.v2 up -d --build"
echo "4) docker compose -f docker-compose.v2.yml --env-file .env.v2 exec backend alembic upgrade head"
