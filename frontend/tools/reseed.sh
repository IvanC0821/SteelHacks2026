#!/usr/bin/env bash
# Re-seed the local Verity backend with the fictional 21-241 course used for frontend development.
# Never kills, restarts, or touches the backend process -- it must already be running
# (see the repo root README: `PYTHONPATH=backend:. .venv/bin/python -m uvicorn verity.api:create_app
# --factory --host 127.0.0.1 --port 8026`). This script only checks health, then reseeds.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="${VERITY_API:-http://127.0.0.1:8026}"
SESSION_FILE="$ROOT/frontend/.dev/session.json"

if ! curl -fsS "$API/health" >/dev/null 2>&1; then
  echo "error: backend is not responding at $API/health" >&2
  echo "start it first, from the repo root:" >&2
  echo "  PYTHONPATH=backend:. .venv/bin/python -m uvicorn verity.api:create_app --factory --host 127.0.0.1 --port 8026" >&2
  exit 1
fi
echo "backend healthy at $API"

cd "$ROOT"
echo "seeding the fictional course (writes frontend/.dev/session.json)..."
PYTHONPATH="backend:." VERITY_API="$API" .venv/bin/python -m tools.seed_dev

echo
echo "identities:"
.venv/bin/python - "$SESSION_FILE" <<'PY'
import json
import sys

with open(sys.argv[1]) as f:
    data = json.load(f)

print(f"  api:            {data['api']}")
print(f"  course_id:      {data['course_id']}")
print(f"  assignment_id:  {data['assignment_id']}")
print()
for name, user in data["users"].items():
    print(f"  {name:<16} {user['role']:<10} {user['id']}")
PY
