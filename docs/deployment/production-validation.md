# Production Validation Checklist

Use this after Railway and Vercel are configured.

## Backend DB Validation

Run locally with Railway production env loaded:

```bash
scripts/check-production-db.sh
```

Expected:

```json
{
  "database": "ok",
  "pgvector_enabled": true,
  "alembic_table": true,
  "alembic_revision": "0003_ai_output_audits"
}
```

## API Validation

```bash
curl https://your-railway-api/api/v1/health
curl https://your-railway-api/api/v1/health/db
```

## Reflection Persistence

Use an authenticated mobile app session:

1. Save a reflection.
2. Reload the app.
3. Confirm the reflection appears on Home.

## Vector Persistence

1. Save at least three reflections.
2. Search your own mind.
3. Confirm results include prior reflections with similarity values.

## Encryption Validation

In the database, reflection text should not appear as readable plaintext in:

- `reflections.body_encrypted`
- `ai_memories.content_encrypted`
- `weekly_insights.summary_encrypted`
- `reflection_feedback.note_encrypted`

## Production Env Loading

Check Railway logs after deploy. You should see:

```text
database_startup_check_passed
```

Do not proceed to TestFlight until these checks pass.
