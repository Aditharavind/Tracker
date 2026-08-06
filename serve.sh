#!/usr/bin/env bash
# Single-process mode: build the frontend, then let FastAPI serve both the API
# and the static bundle on one port. This is what you'd run on a small VPS or
# a Raspberry Pi so you and your friend can both hit the same URL.
set -e
cd "$(dirname "$0")"

(cd frontend && npm install && npm run build)
cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
