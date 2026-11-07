# Twin — personal-agent prototype

A private, responsive web app for collecting user-provided personal context and turning it into reviewed memories and tasks. This is an early web prototype, not an App Store or Play Store release.

## Location in Founder OS

This is an independently installable source copy of the Twin web prototype under `prototypes/twin`. It is outside the root pnpm workspace and is not wired to Ballast’s web, mobile, FastAPI, Clerk or PostgreSQL services. Existing Founder OS applications are unchanged.

The original private Sites deployment is a separate deployment. Pushing this directory to GitHub does not update that live site. Its project ID, credentials, local state and account records are excluded. The checked-in hosting configuration retains only the local D1 binding. Associate a project ID through Sites before publishing a separate instance.

Hermes/OpenClaw integrations have not been implemented. The existing optional model adapter remains unconfigured; no API credentials are included.

Run the commands below from `prototypes/twin` using Node 24 for the test suite. Retained third-party license notices are alongside the vendored components and build support.

## Implemented

- Request-authenticated, per-user D1 state with optimistic concurrency checks.
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

Node 22+ is supported by the starter; tests use Node 24 type stripping and built-in SQLite. API tests exercise the actual route handlers with an in-memory D1 adapter and simulated dispatch identity, not a hosted browser session.

```sh
npm run install:ci
node --experimental-strip-types --test tests/core.test.mjs
node --test tests/api.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

D1 schema is in `db/schema.ts`; generated migrations are in `drizzle/`. Apply the generated migration to the local D1 binding before previewing authenticated mutations. Hosted deployment applies migrations through Sites. Authentication for the published private app is handled by Sites; do not expose it as a public Worker without a replacement authentication boundary.

## Enable live AI

Configure `OPENAI_API_KEY` as a server-only secret and `OPENAI_MODEL` as an explicitly chosen supported model ID. Never commit the key. Redeploy to apply settings. The user must enable context sharing and select Live AI in Settings. The route has a 45-second timeout, an output-token cap and basic per-user request limits. A provider-side spend cap is still required before broad release. Live inference and billing were not tested without a key.

## Limits and next work

Voice capture, email/calendar OAuth, push scheduling, autonomous external actions, encrypted on-device storage, native store builds, backups/restore, formal security assessment and multi-user commercial onboarding remain future work. The manifest supports a standalone web-app presentation; it is not a full offline PWA. Deletion removes active database records; provider backups have separate retention. Imported documents can contain third-party personal data: users should choose only relevant material they are entitled to share.

A mobile-native implementation can reuse the state types and API contract, while replacing Sites identity with an explicitly designed mobile authentication flow. It cannot simply ship the current private-web authentication as a store app.
