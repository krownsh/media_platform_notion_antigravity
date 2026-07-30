#!/bin/bash
# Sandbox POC Runner Wrapper. It accepts only generated files in jobs/<job-id>/.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if [ "$#" -ne 2 ]; then
  echo "Usage: bash runner.sh <javascript|python> <job-id/main.js|job-id/main.py>"
  exit 1
fi

RUNTIME=$1
SCRIPT_PATH=$2

case "$RUNTIME" in
  javascript)
    SERVICE=poc-node
    COMMAND=node
    EXPECTED_FILE=main.js
    ;;
  python)
    SERVICE=poc-python
    COMMAND=python
    EXPECTED_FILE=main.py
    ;;
  *)
    echo "[Sandbox] Unsupported runtime: $RUNTIME" >&2
    exit 1
    ;;
esac

case "$SCRIPT_PATH" in
  */"$EXPECTED_FILE") ;;
  *)
    echo "[Sandbox] Invalid generated script path" >&2
    exit 1
    ;;
esac

JOB_ID=${SCRIPT_PATH%/*}
case "$JOB_ID" in
  *[!A-Za-z0-9_-]*|'')
    echo "[Sandbox] Invalid job id" >&2
    exit 1
    ;;
esac

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "[Sandbox] Docker Compose is required" >&2
  exit 127
fi

echo "[Sandbox] Running $RUNTIME POC in an isolated, network-disabled container..."
# shellcheck disable=SC2086
$COMPOSE run --rm --no-deps "$SERVICE" "$COMMAND" "/workspace/$SCRIPT_PATH"
