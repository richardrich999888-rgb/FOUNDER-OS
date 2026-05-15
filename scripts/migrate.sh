#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../apps/backend"
source .venv/bin/activate
alembic upgrade head
