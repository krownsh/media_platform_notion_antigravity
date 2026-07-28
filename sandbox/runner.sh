#!/usr/bin/env bash
# Sandbox POC Runner Wrapper

set -u

if [ "$#" -ne 1 ]; then
  echo "Usage: bash runner.sh runs/<run_id>/main.<js|py>" >&2
  exit 1
fi

RELATIVE_SCRIPT=$1
TIMEOUT_SECONDS=${POC_TIMEOUT_SECONDS:-20}

if ! [[ "$RELATIVE_SCRIPT" =~ ^runs/[a-zA-Z0-9_-]{1,80}/main\.(js|py)$ ]]; then
  echo "[Sandbox] Rejected unsafe script path: $RELATIVE_SCRIPT" >&2
  exit 2
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$TIMEOUT_SECONDS" -lt 1 ] || [ "$TIMEOUT_SECONDS" -gt 58 ]; then
  echo "[Sandbox] POC_TIMEOUT_SECONDS must be an integer between 1 and 58" >&2
  exit 2
fi

RUN_DIR=$(dirname "$RELATIVE_SCRIPT")
SCRIPT_NAME=$(basename "$RELATIVE_SCRIPT")

if [ ! -f "$RELATIVE_SCRIPT" ]; then
  echo "[Sandbox] Script not found: $RELATIVE_SCRIPT" >&2
  exit 2
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "[Sandbox] Docker Compose is not installed" >&2
  exit 127
fi

export POC_RUN_DIR="./$RUN_DIR"

echo "[Sandbox] Starting isolated ${SCRIPT_NAME} (network=none, read-only, timeout=${TIMEOUT_SECONDS}s)..."
echo "--------------------------------------------------------"

if [[ "$SCRIPT_NAME" == *.js ]]; then
  "${COMPOSE[@]}" run --rm --no-deps node-runner timeout "${TIMEOUT_SECONDS}s" node "/workspace/$SCRIPT_NAME"
  EXIT_CODE=$?
else
  "${COMPOSE[@]}" run --rm --no-deps python-runner timeout "${TIMEOUT_SECONDS}s" python "/workspace/$SCRIPT_NAME"
  EXIT_CODE=$?
fi

echo "--------------------------------------------------------"
echo "[Sandbox] Execution finished with exit code $EXIT_CODE"
exit $EXIT_CODE
