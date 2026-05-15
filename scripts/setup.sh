#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Installing JavaScript dependencies..."
if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi
pnpm install

echo "Creating backend virtual environment..."
cd apps/backend
PYTHON_BIN="${PYTHON_BIN:-python3.12}"
"$PYTHON_BIN" -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"

echo "Setup complete."
echo "Next: copy .env.example files, start Postgres with docker compose -f infra/docker-compose.yml up -d, then run migrations."
