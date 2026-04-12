#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.v2.yml"
ENV_FILE="$ROOT_DIR/.env.home"
ARTIFACT_DIR="$ROOT_DIR/deploy_artifacts/security"
TS="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$ARTIFACT_DIR"

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

curl_with_retry() {
  local url="$1"
  local attempts="${2:-10}"
  local delay_secs="${3:-2}"
  local i code
  for ((i=1; i<=attempts; i++)); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)
    if [[ "$code" == "200" ]]; then
      echo "$code"
      return 0
    fi
    sleep "$delay_secs"
  done
  echo "$code"
  return 1
}

echo "[1/7] Verifying stack status"
"${COMPOSE[@]}" ps | tee "$ARTIFACT_DIR/${TS}_compose_ps.txt"

echo "[2/7] Checking runtime health"
FRONT_HTTP=$(curl_with_retry "http://localhost:5185" 5 1 || true)
BACK_HTTP=$(curl_with_retry "http://localhost:8200/health" 15 2 || true)
echo "frontend_http=$FRONT_HTTP" | tee "$ARTIFACT_DIR/${TS}_health.txt"
echo "backend_health_http=$BACK_HTTP" | tee -a "$ARTIFACT_DIR/${TS}_health.txt"

echo "[3/7] Capturing security headers"
curl -sSI http://localhost:8200/health > "$ARTIFACT_DIR/${TS}_backend_headers.txt" || true

echo "[4/7] Frontend dependency vulnerability scan"
"${COMPOSE[@]}" exec -T frontend npm audit --json > "$ARTIFACT_DIR/${TS}_frontend_npm_audit.json" || true

echo "[5/7] Backend package integrity check"
"${COMPOSE[@]}" exec -T backend sh -lc "python -m pip check" > "$ARTIFACT_DIR/${TS}_backend_pip_check.txt" || true

echo "[6/7] Backend dependency vulnerability scan"
BACKEND_PIP_AUDIT_JSON="$ARTIFACT_DIR/${TS}_backend_pip_audit.json"
BACKEND_PIP_AUDIT_LOG="$ARTIFACT_DIR/${TS}_backend_pip_audit.log"
"${COMPOSE[@]}" exec -T backend sh -lc "python -m pip install --disable-pip-version-check -q pip-audit >/dev/null 2>&1 || true; python -m pip_audit -f json" > "$BACKEND_PIP_AUDIT_JSON" 2> "$BACKEND_PIP_AUDIT_LOG" || true
if [[ ! -s "$BACKEND_PIP_AUDIT_JSON" ]]; then
  echo "{}" > "$BACKEND_PIP_AUDIT_JSON"
fi

echo "[7/7] Hardening configuration checks"
{
  echo "backend_reload_flag=$(grep -n -- '--reload' "$ROOT_DIR/docker-compose.v2.yml" || true)"
  echo "frontend_dev_server=$(grep -n 'command: npm run dev' "$ROOT_DIR/docker-compose.v2.yml" || true)"
  echo "backend_bind_mount=$(grep -n ' - ./backend:/app' "$ROOT_DIR/docker-compose.v2.yml" || true)"
  echo "frontend_bind_mount=$(grep -n ' - ./frontend:/app' "$ROOT_DIR/docker-compose.v2.yml" || true)"
} > "$ARTIFACT_DIR/${TS}_hardening_checks.txt"

echo "VA scan artifacts saved under: $ARTIFACT_DIR"
echo "Timestamp prefix: $TS"
