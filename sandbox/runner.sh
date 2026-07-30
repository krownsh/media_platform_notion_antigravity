#!/usr/bin/env bash
# Sandbox POC Runner Wrapper

set -u

if [ "$#" -ne 1 ] && [ "$#" -ne 2 ]; then
  echo "Usage: bash runner.sh runs/<run_id>/main.<js|py>" >&2
  echo "   or: bash runner.sh <javascript|python> <job_id/main.js|job_id/main.py>" >&2
  exit 1
fi

TIMEOUT_SECONDS=${POC_TIMEOUT_SECONDS:-20}

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$TIMEOUT_SECONDS" -lt 1 ] || [ "$TIMEOUT_SECONDS" -gt 58 ]; then
  echo "[Sandbox] POC_TIMEOUT_SECONDS must be an integer between 1 and 58" >&2
  exit 2
fi

if [ "$#" -eq 1 ]; then
  RELATIVE_SCRIPT=$1
  if ! [[ "$RELATIVE_SCRIPT" =~ ^runs/[a-zA-Z0-9_-]{1,80}/main\.(js|py)$ ]]; then
    echo "[Sandbox] Invalid generated script path: $RELATIVE_SCRIPT" >&2
    exit 2
  fi
  RUN_DIR=$(dirname "$RELATIVE_SCRIPT")
  SCRIPT_NAME=$(basename "$RELATIVE_SCRIPT")
  case "$SCRIPT_NAME" in
    main.js) SERVICE=node-runner; COMMAND=node ;;
    main.py) SERVICE=python-runner; COMMAND=python ;;
  esac
else
  RUNTIME=$1
  RELATIVE_SCRIPT=$2
  case "$RUNTIME" in
    javascript) SERVICE=node-runner; COMMAND=node; EXPECTED_FILE=main.js ;;
    python) SERVICE=python-runner; COMMAND=python; EXPECTED_FILE=main.py ;;
    *)
      echo "[Sandbox] Unsupported runtime: $RUNTIME" >&2
      exit 2
      ;;
  esac
  if ! [[ "$RELATIVE_SCRIPT" =~ ^[a-zA-Z0-9_-]{1,120}/$EXPECTED_FILE$ ]]; then
    echo "[Sandbox] Invalid generated script path: $RELATIVE_SCRIPT" >&2
    exit 2
  fi
  RUN_DIR="jobs/$(dirname "$RELATIVE_SCRIPT")"
  SCRIPT_NAME=$(basename "$RELATIVE_SCRIPT")
fi

if [ ! -f "$RUN_DIR/$SCRIPT_NAME" ]; then
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

"${COMPOSE[@]}" run --rm --no-deps "$SERVICE" timeout "${TIMEOUT_SECONDS}s" "$COMMAND" "/workspace/$SCRIPT_NAME"
EXIT_CODE=$?

echo "--------------------------------------------------------"
echo "[Sandbox] Execution finished with exit code $EXIT_CODE"
exit $EXIT_CODE
