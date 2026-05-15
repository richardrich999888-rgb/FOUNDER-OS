# Ballast

Ballast is an MVP foundation for a private founder reflection product.

This repository is intentionally simple:

- `apps/mobile`: Expo + React Native mobile app.
- `apps/web`: Next.js web app for landing pages and dashboard.
- `apps/backend`: FastAPI API service.
- `packages/shared`: shared TypeScript contracts.
- `packages/ui`: shared web UI primitives.
- `packages/ai-core`: AI provider and retrieval scaffolding.
- `infra`: local and deployment configuration.
- `docs`: founder-friendly setup, deployment, architecture, and launch guides.

## Quick Start

1. Install prerequisites: Node 20, pnpm, Python 3.11+, Docker Desktop.
2. Run `pnpm setup`.
3. Copy `.env.example` files in the root, `apps/web`, `apps/mobile`, and `apps/backend`.
4. Start Postgres: `docker compose -f infra/docker-compose.yml up -d`.
5. Run migrations: `scripts/migrate.sh`.
6. Start backend: `scripts/dev-backend.sh`.
7. Start web: `pnpm dev:web`.
8. Start mobile: `pnpm dev:mobile`.

## Deployment Targets

- Web: Vercel, root directory `apps/web`.
- Backend: Railway, Dockerfile `apps/backend/Dockerfile`.
- Database: Railway PostgreSQL with pgvector enabled.
- Auth: Clerk for email, Google, and Apple login.
- Mobile distribution: Expo EAS for iOS and Android builds.

Read [docs/setup/local-development.md](docs/setup/local-development.md) first.

## Launch Posture

Ballast should launch as cognitive observability, not therapy, wellness, generic journaling, or productivity software.

The first MVP success signal is not downloads or signups. It is whether a founder says:

> This understood something about me.

Launch execution lives in [docs/launch](docs/launch). Start with [docs/launch/README.md](docs/launch/README.md).
