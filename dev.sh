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
#
# So under WSL this must use a WSL-native venv instead -- and it must live
# in WSL's own filesystem (~/.venvs), NOT under this repo on the E:\ drive.
# A venv placed on the drvfs-mounted repo path was created successfully,
# worked for a while, then silently vanished on its own (drvfs is a slow,
# occasionally lossy bridge for the tens of thousands of small files a
# venv is made of) -- reproducing this exact bug again with no edits here
# at all. ~/.venvs is genuine ext4, not drvfs: faster and it won't do that.
ROOT="$(pwd)"
WSL_VENV="$HOME/.venvs/tracker-backend/bin/python"
if grep -qi microsoft /proc/version 2>/dev/null && [ -x "$WSL_VENV" ]; then
  PYTHON="$WSL_VENV"
elif [ -x "$ROOT/backend/.venv/Scripts/python.exe" ]; then
  PYTHON="$ROOT/backend/.venv/Scripts/python.exe"
elif [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PYTHON="$ROOT/backend/.venv/bin/python"
else
  echo "No backend venv found." >&2
  echo "  Windows/native:  cd backend && python3 -m venv .venv && .venv/*/pip install -r requirements.txt" >&2
  echo "  WSL:             mkdir -p ~/.venvs && python3 -m venv ~/.venvs/tracker-backend && ~/.venvs/tracker-backend/bin/pip install -r backend/requirements.txt" >&2
  PYTHON="python3"
fi

trap 'kill 0' EXIT

# --reload-dir scopes the watcher to actual app code. Without it, uvicorn
# watches the whole cwd (backend/) by default -- which now also contains
# backend/.venv-wsl/, hundreds of thousands of interpreter/package files.
# On this drvfs-mounted repo that watch is slow to even establish, and any
# incidental touch inside the venv (a pip cache write, a .pyc rewrite) was
# triggering full reload cycles that made the API unreachable for tens of
# seconds at a time -- the actual cause of the app hanging on "loading...".
(cd backend && "$PYTHON" -m uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8000) &
(cd frontend && npm run dev) &
wait
