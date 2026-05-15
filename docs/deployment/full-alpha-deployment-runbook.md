# Full Alpha Deployment Runbook

This is the non-technical founder checklist for deploying Ballast alpha.

## 1. Create GitHub Repo

Repo already exists:

```text
richardrich999888-rgb/FOUNDER-OS
```

## 2. Connect Vercel

1. Open Vercel.
2. Import the GitHub repo.
3. Set root directory to `apps/web`.
4. Add web environment variables.
5. Deploy.

## 3. Connect Railway

1. Open Railway.
2. Create a project.
3. Deploy from GitHub repo.
4. Select backend service.
5. Use Dockerfile path `apps/backend/Dockerfile`.

## 4. Create PostgreSQL DB

1. In Railway project, click **New**.
2. Select **PostgreSQL**.
3. Wait for provisioning.

## 5. Enable pgvector

Run migrations:

```bash
cd apps/backend
alembic upgrade head
```

Migration `0001_initial_schema` enables pgvector.

## 6. Configure Clerk

1. Create Clerk application.
2. Enable email login.
3. Enable Google login.
4. Enable Apple login.
5. Copy publishable keys to Vercel and EAS.
6. Copy secret key and JWKS URL to Railway.

## 7. Add Environment Variables

Railway backend:

```bash
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=true
CLERK_ISSUER=...
CLERK_JWKS_URL=...
CLERK_SECRET_KEY=...
OPENAI_API_KEY=...
FIELD_ENCRYPTION_KEY=...
RUN_STARTUP_DATABASE_CHECKS=true
```

Vercel web:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_API_URL=https://your-railway-api
```

EAS preview:

```bash
EXPO_PUBLIC_API_URL=https://your-railway-api
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=...
EXPO_PUBLIC_ALPHA_DISTRIBUTION=testflight
EXPO_PUBLIC_FEATURE_CRASH_REPORTING=true
EXPO_PUBLIC_SENTRY_DSN=...
```

## 8. Run Migrations

From a machine with backend env loaded:

```bash
cd apps/backend
alembic upgrade head
```

## 9. Deploy Backend

1. Push to GitHub.
2. Railway builds backend.
3. Check:

```bash
curl https://your-railway-api/api/v1/health
curl https://your-railway-api/api/v1/health/db
```

## 10. Deploy Frontend

1. Push to GitHub.
2. Vercel deploys web.
3. Open landing page.
4. Open `/dashboard/alpha`.

## 11. Build Expo App

```bash
cd apps/mobile
eas build --platform ios --profile preview --environment preview
eas build --platform android --profile preview --environment preview
```

## 12. Push TestFlight Build

```bash
eas submit --platform ios --profile production
```

Then invite testers in App Store Connect.

## 13. Push Play Store Internal/Closed Testing Build

1. Download Android `.aab` from EAS.
2. Open Play Console.
3. Create internal or closed testing release.
4. Upload `.aab`.
5. Add tester email list or Google Group.
6. Send opt-in link.

## Final Gate

Do not invite testers until:

- login works
- reflection persists
- retrieval works
- weekly insight works
- export/delete controls are visible
- privacy policy URL is live
- cost alerts are set
