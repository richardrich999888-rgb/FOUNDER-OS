# Deployment Guide

## Vercel Web Deployment

1. Connect GitHub repo `richardrich999888-rgb/FOUNDER-OS` to Vercel.
2. Set root directory to `apps/web`.
3. Add environment variables from `apps/web/.env.example`.
4. Deploy.

## Railway Backend Deployment

1. Create a Railway project.
2. Add PostgreSQL.
3. Enable pgvector by running the Alembic migration after deployment.
4. Add a backend service from GitHub.
5. Use Dockerfile path `apps/backend/Dockerfile`.
6. Add environment variables from `apps/backend/.env.example`.
7. Set the health check path to `/api/v1/health`.

## Database Migration

Run this from Railway shell or locally against the Railway database URL:

```bash
cd apps/backend
alembic upgrade head
```

## CI/CD Flow

GitHub Actions runs formatting, TypeScript checks, backend linting, and Python compilation on pushes and pull requests. Vercel and Railway can both auto-deploy from the default branch after CI passes.
