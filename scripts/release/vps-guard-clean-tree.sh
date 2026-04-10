#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/ces_sale_operation_system}"

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
cd "$APP_DIR"

if [[ ! -d .git ]]; then
  echo "ERROR: $APP_DIR is not a git repository"
  exit 2
fi

# Guard only tracked file changes; untracked env/profile files are allowed.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree is dirty in $APP_DIR"
  git status --short
  echo "Resolve or stash tracked changes before deploy/rollback."
  exit 3
fi

echo "OK: working tree is clean"
