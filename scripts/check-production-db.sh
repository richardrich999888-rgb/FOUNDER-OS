#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../apps/backend"
if [ ! -x ".venv/bin/python" ]; then
  echo "Backend virtual environment not found. Run pnpm setup first." >&2
  exit 1
fi

.venv/bin/python - <<'PY'
import asyncio
import json

from app.db.health import check_database
from app.db.session import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as session:
        result = await check_database(session)
    print(json.dumps(result, indent=2, default=str))
    if not result["pgvector_enabled"]:
        raise SystemExit("pgvector is not enabled")
    if not result["alembic_table"]:
        raise SystemExit("migrations have not been run")


asyncio.run(main())
PY
