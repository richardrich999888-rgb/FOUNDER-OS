# Local Development Guide

## Install Tools

Install:

- Node.js 20
- pnpm
- Python 3.11 or newer
- Docker Desktop
- Expo Go on your phone, or Xcode/Android Studio for simulators

## Setup

Run:

```bash
pnpm setup
```

Copy each example env file:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/backend/.env.example apps/backend/.env
```

Start the local database:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Run migrations:

```bash
scripts/migrate.sh
```

Start services:

```bash
scripts/dev-backend.sh
pnpm dev:web
pnpm dev:mobile
```

Backend health check:

```bash
curl http://localhost:8000/api/v1/health
```
