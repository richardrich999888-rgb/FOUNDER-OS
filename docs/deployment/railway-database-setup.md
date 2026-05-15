# Railway Database Setup

This guide creates the production PostgreSQL database for Ballast on Railway and enables pgvector for semantic memory search.

## Why Railway

Railway keeps the MVP simple: backend and PostgreSQL live in one project, environment variables are easy to manage, and usage-based billing is understandable for an early alpha.

## Estimated Cost

Railway is usage-based. Railway's official billing docs describe a Hobby included usage credit of `$5.00 off` per month. Small MVP usage usually starts around low single digits to tens of dollars, depending on memory, CPU, storage, and uptime. Set a billing alert before inviting testers.

## Step 1: Create Account

1. Go to Railway.
2. Sign in with GitHub.
3. Create or choose a workspace.

Screenshot placeholder:

`[Screenshot: Railway sign-in with GitHub]`

## Step 2: Create Project

1. Click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select `richardrich999888-rgb/FOUNDER-OS`.
4. Create the project.

Screenshot placeholder:

`[Screenshot: New Railway project from GitHub]`

## Step 3: Add PostgreSQL

1. In the Railway project, click **New**.
2. Choose **Database**.
3. Select **PostgreSQL**.
4. Wait for Railway to provision the database.

Screenshot placeholder:

`[Screenshot: Railway PostgreSQL service]`

## Step 4: Enable pgvector

Ballast migrations run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run migrations after the database is connected:

```bash
cd apps/backend
alembic upgrade head
```

Verify pgvector:

```sql
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector');
```

## Step 5: Configure Backend Service

1. Add a backend service from the same GitHub repo.
2. Use Dockerfile path:

```text
apps/backend/Dockerfile
```

3. Set health check path:

```text
/api/v1/health
```

4. Set start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Step 6: Environment Variables

Add these to the backend service:

```bash
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=true
CLERK_ISSUER=https://your-clerk-domain.clerk.accounts.dev
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_SECRET_KEY=sk_live_replace
OPENAI_API_KEY=sk-replace
FIELD_ENCRYPTION_KEY=replace
RUN_STARTUP_DATABASE_CHECKS=true
```

Generate `FIELD_ENCRYPTION_KEY` locally:

```bash
scripts/generate-field-key.sh
```

## Step 7: Validate

Run:

```bash
scripts/check-production-db.sh
```

Then check:

```bash
curl https://your-railway-api.up.railway.app/api/v1/health
curl https://your-railway-api.up.railway.app/api/v1/health/db
```

Expected DB health:

```json
{
  "database": "ok",
  "pgvector_enabled": true,
  "alembic_table": true,
  "alembic_revision": "0003_ai_output_audits"
}
```

## Scaling Notes

For the first 100-1000 alpha users, keep one backend service and one PostgreSQL database. Do not add Redis, queues, or microservices unless slow weekly insight generation becomes a real user-facing problem.
