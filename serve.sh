#!/usr/bin/env bash
# Single-process mode: build the frontend, then let FastAPI serve both the API
# and the static bundle on one port. This is what you'd run on a small VPS or
# a Raspberry Pi so you and your friend can both hit the same URL.
set -e
cd "$(dirname "$0")"

# See dev.sh for why this prefers the project's own venv over a bare python3.
ROOT="$(pwd)"
if [ -x "$ROOT/backend/.venv/Scripts/python.exe" ]; then
  PYTHON="$ROOT/backend/.venv/Scripts/python.exe"
elif [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PYTHON="$ROOT/backend/.venv/bin/python"
else
  echo "No backend/.venv found -- run: cd backend && python3 -m venv .venv && .venv/*/pip install -r requirements.txt" >&2
  PYTHON="python3"
fi

(cd frontend && npm install && npm run build)
cd backend && "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
