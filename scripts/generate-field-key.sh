#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../apps/backend"
if [ ! -x ".venv/bin/python" ]; then
  echo "Backend virtual environment not found. Run pnpm setup first." >&2
  exit 1
fi

.venv/bin/python - <<'PY'
from app.services.security.encryption import generate_field_encryption_key

print(generate_field_encryption_key())
PY
