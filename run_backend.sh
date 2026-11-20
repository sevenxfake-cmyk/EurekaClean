#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$PROJECT_ROOT"

HOST="${APP_HOST:-0.0.0.0}"
PORT="${APP_PORT:-${PORT:-8000}}"

export APP_HOST="$HOST"
export APP_PORT="$PORT"

echo "Backend iniciado en http://$APP_HOST:$APP_PORT"
echo "Health: http://$APP_HOST:$APP_PORT/api/health"
exec python3 server.py
