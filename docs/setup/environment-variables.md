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
