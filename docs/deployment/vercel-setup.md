# Vercel Setup

Vercel hosts the Ballast web app in `apps/web`.

## Connect GitHub

1. Open Vercel.
2. Click **Add New Project**.
3. Import `richardrich999888-rgb/FOUNDER-OS`.
4. Set root directory:

```text
apps/web
```

5. Framework preset should be **Next.js**.

## Build Settings

Use:

```bash
cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @ballast/web build
```

The repo also includes `apps/web/vercel.json`.

## Environment Variables

Add:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_replace
CLERK_SECRET_KEY=sk_live_replace
NEXT_PUBLIC_API_URL=https://your-railway-api.up.railway.app
```

Use preview values for preview deployments and production values for production deployments.

## Automatic Deployments

- Push to `main`: production deployment.
- Pull request: preview deployment.
- Failed build: Vercel keeps the previous deployment live.

## Rollback

1. Open the Vercel project.
2. Go to **Deployments**.
3. Pick a known good deployment.
4. Click **Promote to Production**.

## Domain Setup

1. Go to **Settings > Domains**.
2. Add the domain.
3. Follow Vercel DNS instructions.
4. Update Clerk allowed redirect URLs after domain is live.

## Official Sources Checked

- Vercel pricing and deployment behavior: `https://vercel.com/pricing`
- Vercel Hobby plan docs: `https://vercel.com/docs/plans/hobby`
