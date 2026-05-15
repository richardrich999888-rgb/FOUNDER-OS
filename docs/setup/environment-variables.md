# Environment Variables

## Root

- `BACKEND_URL`: local or production API URL.
- `WEB_URL`: local or production web URL.

## Web

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk public browser key.
- `CLERK_SECRET_KEY`: Clerk server key.
- `NEXT_PUBLIC_API_URL`: API URL used by browser code.

## Mobile

- `EXPO_PUBLIC_API_URL`: backend API URL.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk public key for Expo.

## Backend

- `DATABASE_URL`: PostgreSQL connection string.
- `DATABASE_SSL`: use `true` for Railway public production URLs; local dev can use `false`.
- `DATABASE_POOL_SIZE`: base async SQLAlchemy connection pool size.
- `DATABASE_MAX_OVERFLOW`: extra temporary DB connections allowed during bursts.
- `RUN_STARTUP_DATABASE_CHECKS`: validates DB, pgvector, and migrations on API boot.
- `CLERK_ISSUER`: Clerk issuer URL.
- `CLERK_JWKS_URL`: Clerk JSON Web Key Set URL.
- `CLERK_SECRET_KEY`: Clerk backend secret.
- `OPENAI_API_KEY`: OpenAI API key.
- `ANTHROPIC_API_KEY`: optional Anthropic API key.
- `VOICE_STORAGE_BUCKET`: future secure voice file storage bucket.
- `FIELD_ENCRYPTION_KEY`: Fernet key used to encrypt reflection, memory, and insight text.

Never commit real `.env` files.

Generate the encryption key locally:

```bash
scripts/generate-field-key.sh
```
