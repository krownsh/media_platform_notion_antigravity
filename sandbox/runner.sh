#!/bin/bash
# Sandbox POC Runner Wrapper

if [ -z "$1" ]; then
  echo "Usage: bash runner.sh <script_name.js>"
  exit 1
fi

SCRIPT_NAME=$1

echo "[Sandbox] Initializing Docker container..."
docker-compose up -d poc-runner

echo "[Sandbox] Installing generic dependencies if any (npm install)..."
# Just a safe-guard for POCs that provide a package.json in the sandbox
docker-compose exec -T poc-runner sh -c "if [ -f package.json ]; then npm install; fi"

echo "[Sandbox] Executing $SCRIPT_NAME in isolated container..."
echo "--------------------------------------------------------"
docker-compose exec -T poc-runner node $SCRIPT_NAME
EXIT_CODE=$?
echo "--------------------------------------------------------"
echo "[Sandbox] Execution finished with exit code $EXIT_CODE"

echo "[Sandbox] Tearing down container..."
docker-compose down

exit $EXIT_CODE
