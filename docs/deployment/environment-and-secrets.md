# Environment and Secrets Management

## Local Files

Use `.env` files locally. Never commit real `.env` files.

Copy:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env
```

## Production Locations

- Railway: backend and database secrets.
- Vercel: web secrets.
- EAS: mobile build-time public config and sensitive Sentry DSN if used.
- Clerk: auth secrets and OAuth setup.

## Critical Secrets

Rotate immediately if exposed:

- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `FIELD_ENCRYPTION_KEY`
- `DATABASE_URL`

## Public Variables

These are safe to expose to clients:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

Public does not mean unimportant. Wrong public values can break login or connect alpha users to the wrong backend.

## Field Encryption Key Warning

If `FIELD_ENCRYPTION_KEY` is lost, encrypted reflections cannot be decrypted. Store it in a password manager and Railway only. Do not rotate it casually until key rotation is implemented.
