# Cost Optimization

Ballast should stay simple and cheap through alpha.

## Expected MVP Monthly Cost

For 100-1000 users:

- Vercel: `$0-$20+` unless usage grows or Pro is required.
- Railway: roughly `$5-$30+` early, depending on backend/database usage.
- Clerk: likely free during alpha.
- OpenAI: `$20-$100+`, depending on reflection volume, retrieval embeddings, and weekly synthesis.
- Sentry: free/dev tier may be enough during alpha.

Expected total without credits: `$25-$150/mo`.

## AI Cost Risks

Costs grow with:

- long reflections
- many embeddings
- repeated weekly insight generation
- voice transcription
- unnecessary retries

Guardrails:

- cap reflection length
- cap weekly reflections included in synthesis
- generate weekly insight on demand, not constantly
- use small embedding and synthesis models
- log token estimates through `ai_output_audits`

## Audio Cost

OpenAI's official pricing page has listed Whisper transcription at `$0.006 / minute`. One hour is about `$0.36`. Voice alpha can become expensive if users record long sessions.

Guardrails:

- cap recording length
- do not auto-transcribe background audio
- show users when upload/transcription starts

## Railway Risks

Railway is usage-based. Always-on services and databases cost money even with low traffic.

Guardrails:

- one backend service
- one PostgreSQL database
- no workers until needed
- monitor memory
- set billing alerts

## Vercel Risks

Vercel Hobby has usage caps, and Pro has included credit with usage beyond that billed. Keep the web app mostly static during alpha.

## Free-Tier Survival Strategy

1. Keep alpha small.
2. Avoid background jobs.
3. Avoid chat-style AI loops.
4. Avoid voice until text retention works.
5. Review AI output audit estimates weekly.
6. Set spend alerts everywhere.

## Official Sources Checked

- OpenAI pricing: `https://platform.openai.com/docs/pricing/`
- Vercel pricing: `https://vercel.com/pricing`
- Railway billing docs: `https://docs.railway.com/pricing/understanding-your-bill`
