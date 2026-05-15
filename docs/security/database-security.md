# Database Security

## Current Controls

- PostgreSQL is the primary store.
- pgvector runs inside PostgreSQL, avoiding a second vector database.
- Production DB connections use SSL by default through `DATABASE_SSL=true`.
- Reflection, memory, feedback notes, and weekly insight text use field encryption.
- Logs redact reflection-like fields, auth headers, cookies, transcripts, and content.
- Startup checks verify database connectivity, pgvector, and migrations.

## Required Settings

Production backend:

```bash
ENVIRONMENT=production
DATABASE_SSL=true
RUN_STARTUP_DATABASE_CHECKS=true
FIELD_ENCRYPTION_KEY=...
```

## Migration Safety

Run migrations deliberately:

```bash
cd apps/backend
alembic upgrade head
```

Do not run destructive migrations during alpha without a database backup.

## Backups

Before inviting external testers:

1. Confirm Railway backup/export options.
2. Document restore process.
3. Test restore on a non-production database once.

## Remaining Security Risks

- Field encryption key rotation is not implemented.
- Export files need private storage and signed URLs before production use.
- Voice uploads need private object storage before enabling voice alpha.
- Admin dashboard authorization is only scaffolded and must not expose private content.
