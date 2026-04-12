#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  echo "WARN: working tree has uncommitted changes"
  git -C "$ROOT_DIR" status --short
else
  echo "OK: working tree is clean"
fi

echo "\n== Git Branch =="
git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD

echo "\n== Recent Commits =="
git -C "$ROOT_DIR" --no-pager log --oneline -n 12

if [[ -x "$BACKEND_DIR/.venv/bin/alembic" ]]; then
  echo "\n== Alembic Heads =="
  (
    cd "$BACKEND_DIR"
    source .venv/bin/activate
    alembic heads || true
  )

  echo "\n== Alembic Current =="
  (
    cd "$BACKEND_DIR"
    source .venv/bin/activate
    alembic current || true
  )
else
  echo "\nWARN: backend/.venv/bin/alembic not found, skip alembic checks"
fi

echo "\n== Migration Files =="
ls -1 "$BACKEND_DIR/alembic/versions"/*.py | sed "s|$ROOT_DIR/||" | sort

echo "\n== Quick Conflict Hotspots =="
for f in \
  backend/app/models/deal.py \
  backend/app/models/__init__.py \
  backend/app/api/deals.py \
  backend/app/main.py \
  backend/app/schemas/deal.py \
  frontend/src/pages/DealsPage.tsx \
  frontend/src/App.tsx \
  frontend/src/components/AppLayout.tsx \
  frontend/src/api/index.ts; do
  if [[ -f "$ROOT_DIR/$f" ]]; then
    echo "- $f"
  fi
done

echo "\nDONE: preflight check complete"
