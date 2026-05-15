# Startup and Free-Tier Strategy

Do not assume credits are guaranteed. Apply only through official program pages and keep payment alerts enabled.

## Vercel

Vercel has a Startup Program page advertising up to `$30,000` in credits for eligible startups connected to accepted partners. This is application/eligibility based, not guaranteed.

MVP use:

- Start on Hobby for non-commercial experiments if allowed.
- Use Pro for commercial launch or team workflows.
- Apply startup credits if eligible.

## Railway

Railway documents credits and promotions as available through unique promotion links for new signups. Railway billing docs also describe Hobby included usage as `$5.00 off`.

MVP use:

- One backend service.
- One PostgreSQL database.
- Monitor memory and uptime.
- Set billing alerts before inviting testers.

## GitHub Student Developer Pack

GitHub documents Student Developer Pack eligibility for students aged 13+ enrolled in a degree or diploma-granting course, requiring school email or proof of enrollment. Use only if actually eligible.

## Clerk

Clerk's official pricing page lists a free Hobby plan with up to 50,000 monthly retained users per app, plus limits and branding. This is enough for Ballast alpha.

## OpenAI

OpenAI has an official Startups page for resources and community. Public credit availability depends on program eligibility and partner routes. Do not budget as if credits are guaranteed.

## Anthropic

Anthropic has official Startup Program terms stating selected awardees may receive API credits, rate limits, and resources. This is optional for Ballast because OpenAI is the primary provider.

## Supabase Alternative

Supabase is a reasonable backup if Railway Postgres becomes limiting, but moving early adds operational churn. Stay on Railway unless Railway cost, performance, or reliability becomes a real blocker.

## Render and Fly.io Backup

Render and Fly.io are reasonable backend hosting backups. Render publicly advertises startup/migration credits. Do not migrate unless Railway creates a concrete problem.

## Expected Runway

For 100-1000 alpha users:

- Vercel: free to `$20+/mo`, lower if credits apply.
- Railway: roughly `$5-$30+/mo` depending on database/backend usage.
- Clerk: likely free for alpha.
- OpenAI: usage-based; budget `$20-$100/mo` until real usage is known.
- Sentry: free/dev tier may be enough for alpha depending on volume.

Most likely early MVP total: `$25-$150/mo` without credits, mostly driven by AI and Railway uptime.

## Official Sources Checked

- Vercel for Startups: `https://vercel.com/startups/credits`
- Railway credits docs: `https://docs.railway.com/pricing/credits`
- Railway billing docs: `https://docs.railway.com/pricing/understanding-your-bill`
- GitHub Education Students: `https://github.com/education/students`
- Clerk pricing: `https://clerk.com/pricing`
- OpenAI for Startups: `https://openai.com/solutions/startups/`
- Anthropic Startup Program terms: `https://www.anthropic.com/startup-program-official-terms`
- Render pricing/startup credits: `https://render.com/pricing`
