#!/usr/bin/env bash
# Dev mode: FastAPI on :8000 with reload, Vite on :5173 with hot reload.
# Open http://localhost:5173 -- Vite proxies /api through to FastAPI.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT

(cd backend && python3 -m uvicorn app.main:app --reload --port 8000) &
(cd frontend && npm run dev) &
wait
