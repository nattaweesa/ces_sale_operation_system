#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/ces_sale_operation_system}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
NOTIFY_ENV="${NOTIFY_ENV:-/root/backup-scripts/backup-notify.env}"
STATE_DIR="${STATE_DIR:-/var/run/ces-prod-health}"
FAIL_COUNT_FILE="${STATE_DIR}/fail_count"
ACTION_LOCK_FILE="${STATE_DIR}/last_action"
LAST_NOTIFY_FILE="${STATE_DIR}/last_notify"
RESTART_THRESHOLD="${RESTART_THRESHOLD:-3}"
AUTOFIX_COOLDOWN_SECONDS="${AUTOFIX_COOLDOWN_SECONDS:-900}"
NOTIFY_COOLDOWN_SECONDS="${NOTIFY_COOLDOWN_SECONDS:-1800}"

mkdir -p "$STATE_DIR"

# Avoid overlapping runs from cron.
exec 9>"${STATE_DIR}/watchdog.lock"
if ! flock -n 9; then
  exit 0
fi

if [[ -f "$NOTIFY_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$NOTIFY_ENV"
fi

send_telegram() {
  local message="$1"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${message}" >/dev/null || true
  fi
}

COMPOSE="docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE}"

cd "$APP_DIR"

get_health() {
  local service="$1"
  local cid
  cid="$($COMPOSE ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$cid" ]]; then
    echo "missing"
    return
  fi

  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo "unknown"
}

backend_health="$(get_health backend)"
frontend_health="$(get_health frontend)"
db_health="$(get_health db)"

backend_http_ok=0
frontend_http_ok=0
if curl -fsS --max-time 5 http://localhost:8000/health >/dev/null; then
  backend_http_ok=1
fi
if curl -fsS --max-time 5 http://localhost:5173/ >/dev/null; then
  frontend_http_ok=1
fi

issues=()
backend_problem=0
frontend_problem=0
db_problem=0

if [[ "$backend_health" != "healthy" || $backend_http_ok -ne 1 ]]; then
  backend_problem=1
  issues+=("backend:${backend_health}/http:${backend_http_ok}")
fi

# Tolerate frontend warm-up while it is still marked as "starting" but already serves HTTP.
if [[ "$frontend_health" == "healthy" && $frontend_http_ok -eq 1 ]]; then
  frontend_problem=0
elif [[ "$frontend_health" == "starting" && $frontend_http_ok -eq 1 ]]; then
  frontend_problem=0
else
  frontend_problem=1
  issues+=("frontend:${frontend_health}/http:${frontend_http_ok}")
fi

if [[ "$db_health" != "healthy" ]]; then
  db_problem=1
  issues+=("db:${db_health}")
fi

current_fail=0
if [[ -f "$FAIL_COUNT_FILE" ]]; then
  current_fail="$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0)"
fi

if (( ${#issues[@]} > 0 )); then
  current_fail=$((current_fail + 1))
  echo "$current_fail" >"$FAIL_COUNT_FILE"

  if (( current_fail == 1 )); then
    send_telegram "CES Health WARNING on $(hostname): ${issues[*]}"
  fi

  if (( current_fail >= RESTART_THRESHOLD )); then
    now_epoch="$(date +%s)"
    last_action=0
    if [[ -f "$ACTION_LOCK_FILE" ]]; then
      last_action="$(cat "$ACTION_LOCK_FILE" 2>/dev/null || echo 0)"
    fi

    # Prevent restart loops: only one auto-fix attempt per cooldown window.
    if (( now_epoch - last_action >= AUTOFIX_COOLDOWN_SECONDS )); then
      restart_targets=()
      (( backend_problem == 1 )) && restart_targets+=("backend")
      (( frontend_problem == 1 )) && restart_targets+=("frontend")
      (( db_problem == 1 )) && restart_targets+=("db")

      if (( ${#restart_targets[@]} == 0 )); then
        exit 1
      fi

      if $COMPOSE up -d --no-deps --force-recreate "${restart_targets[@]}" >/dev/null 2>&1; then
        echo "$now_epoch" >"$ACTION_LOCK_FILE"
        last_notify=0
        if [[ -f "$LAST_NOTIFY_FILE" ]]; then
          last_notify="$(cat "$LAST_NOTIFY_FILE" 2>/dev/null || echo 0)"
        fi
        if (( now_epoch - last_notify >= NOTIFY_COOLDOWN_SECONDS )); then
          echo "$now_epoch" >"$LAST_NOTIFY_FILE"
          send_telegram "CES Health AUTO-FIX triggered on $(hostname): restarted ${restart_targets[*]} (fail_count=${current_fail})"
        fi
      else
        send_telegram "CES Health AUTO-FIX FAILED on $(hostname): ${issues[*]}"
      fi
    fi
  fi

  exit 1
fi

if (( current_fail > 0 )); then
  send_telegram "CES Health RECOVERED on $(hostname): all services healthy (previous_fail_count=${current_fail})"
fi

echo "0" >"$FAIL_COUNT_FILE"
exit 0
