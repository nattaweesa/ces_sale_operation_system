#!/usr/bin/env bash
set -euo pipefail

# Verify whether VPS commit matches origin/main.
# Exit codes:
#   0 = same commit
#   10 = behind/ahead/diverged
#   2+ = operational error

APP_DIR="${APP_DIR:-/root/ces_sale_operation_system}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
MAIN_REF="${MAIN_REF:-main}"

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
cd "$APP_DIR"

if [[ ! -d .git ]]; then
  echo "ERROR: $APP_DIR is not a git repository"
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "WORKTREE=DIRTY"
else
  echo "WORKTREE=CLEAN"
fi

git fetch "$REMOTE_NAME" "$MAIN_REF" >/dev/null

CURRENT="$(git rev-parse HEAD)"
REMOTE_MAIN="$(git rev-parse "$REMOTE_NAME/$MAIN_REF")"
BASE="$(git merge-base HEAD "$REMOTE_NAME/$MAIN_REF")"

echo "CURRENT=$CURRENT"
echo "ORIGIN_MAIN=$REMOTE_MAIN"

if [[ "$CURRENT" == "$REMOTE_MAIN" ]]; then
  echo "STATUS=SAME"
  exit 0
fi

if [[ "$CURRENT" == "$BASE" ]]; then
  echo "STATUS=BEHIND"
  exit 10
fi

if [[ "$REMOTE_MAIN" == "$BASE" ]]; then
  echo "STATUS=AHEAD"
  exit 10
fi

echo "STATUS=DIVERGED"
exit 10
