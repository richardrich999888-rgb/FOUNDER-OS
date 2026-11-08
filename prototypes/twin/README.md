# Twin — personal-agent prototype

A private, responsive web app for collecting user-provided personal context and turning it into reviewed memories and tasks. This is an early web prototype, not an App Store or Play Store release.

## Location in Founder OS

This is an independently installable source copy of the Twin web prototype under `prototypes/twin`. It is outside the root pnpm workspace and is not wired to Ballast’s web, mobile, FastAPI, Clerk or PostgreSQL services. Existing Founder OS applications are unchanged.

The original private Sites deployment is a separate deployment. Pushing this directory to GitHub does not update that live site. Its project ID, credentials, local state and account records are excluded. The checked-in hosting configuration retains only the local D1 binding. Associate a project ID through Sites before publishing a separate instance.

Hermes/OpenClaw integrations have not been implemented. The existing optional model adapter remains unconfigured; no API credentials are included.

Run the commands below from `prototypes/twin` using Node 24 for the test suite. Retained third-party license notices are alongside the vendored components and build support.

## Implemented

- JWT-verified Cloudflare Access identity, explicit owner authorization, per-user D1 state and optimistic concurrency checks. Deployment configuration and account mapping are required; see the security rollout notes below.
- Four generic onboarding examples, excluded from recall until the user confirms them. Private starter facts and account data are not included in this source export.
- Add, edit, confirm, forget and search memories with source and timestamps.
- Import plain-text and Markdown documents (60 KB / 60,000 characters maximum; 30 documents).
- Deterministic source-based recall with explicit abstention and source excerpts. This is labelled Memory mode, not LLM inference.
- Review-and-save memory/task proposals from explicit chat commands.
- Task completion and standards-based .ics export for dated tasks. No background notifications.
- Export personal data and delete active account data, with an explicit confirmation.
- Minimal activity records that do not copy forgotten memory text.
- Optional server-side OpenAI Responses adapter; requires both a server secret and a configured model ID plus per-user context-sharing consent. No browser API keys. The adapter is not configured in the initial deployment.

## Data flow

The user initiates setup and reviews starter suggestions. Imports and edits are explicit writes. A signed-in user ID is required for every data operation. All mutations check the request Origin. State is stored in one account-scoped row; updates require the current version. Imported text is treated as data, never execution instructions. The LLM adapter has no external-action tools.

Memory mode searches only confirmed memories and user-imported text. Chat messages are held in the current browser tab, not stored as a transcript. Optional AI mode shares the current message, up to 50 confirmed memories, 20 open tasks and 5 retrieved passages with OpenAI after consent. No connected email, contacts, calendar or phone data is collected.

## Run and verify

Node 22+ is supported by the starter; tests use Node 24 type stripping and built-in SQLite. API tests exercise the actual route handlers and JWT adapter with generated RSA keys and synthetic JWKS. A second suite runs the real handlers, Web Crypto and local D1 in workerd. These are not hosted login tests.

```sh
npm run install:ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:built
npm run eval:intelligence
```

D1 schema is in `db/schema.ts`; generated migrations are in `drizzle/`. Apply the three versioned migrations (0000, 0001, 0002) in order to the local D1 binding before previewing authenticated mutations. The existing live Sites deployment is separate and was not changed by this patch. This branch intentionally denies private API access until its verified authentication adapter is configured. The old loopback mock sign-in does not authenticate this branch.

## Security configuration and rollout

Read [P0-001 research and rollout](../../docs/security/p0-001-research.md), [threat model](../../docs/security/p0-001-threat-model.md), and [verification report](../../docs/security/p0-001-verification.md) before deploying.

Configure server bindings `TWIN_AUTH_PROVIDER=cloudflare-access`, `TWIN_AUTH_ISSUER=https://<team>.cloudflareaccess.com` and the exact `TWIN_AUTH_AUDIENCE` assigned to the Access application. Access must protect the chosen hostname and forward its signed `Cf-Access-Jwt-Assertion`. No unsigned Sites header fallback is available. Missing configuration returns 503; missing/invalid assertions under valid configuration return 401. Sign-in links reload `/` through the configured gateway.

Existing D1 IDs/state/version are preserved. New provider identities use a separate namespace. For legacy users, provide operator-verified, one-to-one links using server-only `TWIN_AUTH_ACCOUNT_LINKS`; never match by email. No live account migration, Access application setup, production deployment or identity change has been performed. Deploying before configuration/link validation would deny existing users access. Keep the current deployment intact until staged validation and explicit deployment approval.

The integrated local agent interface permits only explicitly granted read-only memory tools. It is not wired to a live model and enables no external actions or write approvals.

## Enable live AI

Configure `OPENAI_API_KEY` as a server-only secret and `OPENAI_MODEL` as an explicitly chosen supported model ID. Never commit the key. Redeploy to apply settings. The user must enable context sharing and select Live AI in Settings. The route has a 45-second timeout, an output-token cap and basic per-user request limits. A provider-side spend cap is still required before broad release. Live inference and billing were not tested without a key.

## Limits and next work

Voice capture, email/calendar OAuth, push scheduling, autonomous external actions, encrypted on-device storage, native store builds, backups/restore, formal security assessment and multi-user commercial onboarding remain future work. The manifest supports a standalone web-app presentation; it is not a full offline PWA. Deletion removes active database records; provider backups have separate retention. Imported documents can contain third-party personal data: users should choose only relevant material they are entitled to share.

A mobile-native implementation can reuse the state types and API contract, while replacing Sites identity with an explicitly designed mobile authentication flow. It cannot simply ship the current private-web authentication as a store app.

## P0-003 persistent intelligence

The existing Memory screen now includes evidence capture, proposal review, explicit legacy imports, commitment states and follow-up drafts, approved preference corrections, forgetting and reusable checklists. Existing account IDs and state are preserved. Export includes both legacy state and the intelligence records. Apply **all three** SQL migrations in order: `0000`, `0001`, then `0002_verified_agent_runtime.sql`; `0001_persistent_intelligence.sql` includes hand-authored transactional guards and invalidation triggers.

D1 is authoritative. Nothing automatically imports private accounts, activates procedures, sends communications or executes external actions. Extraction is deliberately narrow and deterministic; the app can also accept reviewed typed proposals. Every canonical fact starts proposed. Forgetting operates on a complete source and its derived records, as explained by the confirmation dialog.

Read [research and architecture](../../docs/intelligence/research-and-architecture.md), [verification and blockers](../../docs/intelligence/verification-report.md), [security findings](../../docs/intelligence/security-findings.md), [benchmark report](../../docs/intelligence/benchmark-report.md), and [acceptance demonstration](../../docs/intelligence/acceptance-demo.md).

Selected provider-neutral P0-002 runtime modules are now integrated through P0-001 verified identities, current account generation/epoch checks and D1 execution receipts. `POST /api/agent` runs one explicitly selected read-only tool with a deterministic local planner; it makes no model call. All five tools run through the real executor. The existing UI and `/api/chat` provider path are unchanged. Live-model orchestration still requires secure provider setup, adapter wiring and a real smoke test.

See [blocker remediation](../../docs/intelligence/blocker-remediation.md) for current evidence, the local API contract and exact remaining prerequisites. Hosted login validation and real-user productivity measurement remain unverified. Semantic embeddings are optional and deferred; lexical/structured retrieval is usable without them. No deployment is authorized by this branch.
