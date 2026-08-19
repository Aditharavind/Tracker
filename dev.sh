#!/usr/bin/env bash
# Dev mode: FastAPI on :8000 with reload, Vite on :5173 with hot reload.
# Open http://localhost:5173 -- Vite proxies /api through to FastAPI.
set -e
cd "$(dirname "$0")"

# Prefer the project's own backend venv over whatever `python3` happens to
# resolve to on PATH -- a bare `python3` won't have fastapi/sqlmodel/etc
# installed unless it happens to be the same interpreter the venv was built
# with. Resolved to an absolute path since the backend command below runs
# with backend/ as its cwd (uvicorn needs that to find the app.main module).
#
# Under WSL, a Windows-built venv (backend/.venv/Scripts/python.exe) still
# *runs* via interop, but it runs as a real Windows process bound to the
# Windows network stack -- not WSL's own netns. Vite (a genuine WSL/Linux
# process, started right below) then can't reach 127.0.0.1:8000 at all
# (ECONNREFUSED on its proxy), and the app hangs forever on "loading...".
# So under WSL this must use a WSL-native venv (backend/.venv-wsl/bin/python)
# instead -- checked first, before the Windows layout.
ROOT="$(pwd)"
if grep -qi microsoft /proc/version 2>/dev/null && [ -x "$ROOT/backend/.venv-wsl/bin/python" ]; then
  PYTHON="$ROOT/backend/.venv-wsl/bin/python"
elif [ -x "$ROOT/backend/.venv/Scripts/python.exe" ]; then
  PYTHON="$ROOT/backend/.venv/Scripts/python.exe"
elif [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PYTHON="$ROOT/backend/.venv/bin/python"
else
  echo "No backend venv found -- run: cd backend && python3 -m venv .venv && .venv/*/pip install -r requirements.txt" >&2
  echo "(under WSL, name it .venv-wsl instead of .venv so it isn't shadowed by a Windows-built .venv)" >&2
  PYTHON="python3"
fi

trap 'kill 0' EXIT

(cd backend && "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
(cd frontend && npm run dev) &
wait
