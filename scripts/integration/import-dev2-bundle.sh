#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/integration/import-dev2-bundle.sh /absolute/path/dev2-department.bundle [remote_name]
# Example:
#   ./scripts/integration/import-dev2-bundle.sh ~/Downloads/dev2-department.bundle dev2

BUNDLE_PATH="${1:-}"
REMOTE_NAME="${2:-dev2}"

if [[ -z "$BUNDLE_PATH" ]]; then
  echo "ERROR: missing bundle path"
  echo "Usage: $0 /absolute/path/dev2-department.bundle [remote_name]"
  exit 1
fi

if [[ ! -f "$BUNDLE_PATH" ]]; then
  echo "ERROR: bundle file not found: $BUNDLE_PATH"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is not clean. Commit/stash changes first."
  git status --short
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
INTEGRATION_BRANCH="integration/deal-plus-department"

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "INFO: current branch is '$CURRENT_BRANCH' (recommended: main before creating integration branch)"
fi

if git show-ref --verify --quiet "refs/heads/$INTEGRATION_BRANCH"; then
  echo "INFO: integration branch exists: $INTEGRATION_BRANCH"
  git checkout "$INTEGRATION_BRANCH"
else
  echo "INFO: creating integration branch: $INTEGRATION_BRANCH"
  git checkout -b "$INTEGRATION_BRANCH"
fi

echo "INFO: fetching bundle into refs/remotes/$REMOTE_NAME/department"
git fetch "$BUNDLE_PATH" HEAD:"refs/remotes/$REMOTE_NAME/department"

echo "INFO: merging dev2 branch into integration branch"
git merge --no-ff "$REMOTE_NAME/department" -m "merge: dev2 department feature into integration branch"

echo "SUCCESS: merge completed on branch $INTEGRATION_BRANCH"
echo "NEXT: run ./scripts/integration/preflight-merge-checks.sh"
