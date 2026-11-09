# Executable staging-security validation

## Safe local execution

Node >=22.13 is required (`node:sqlite` is used only in local tests). From the repository root:

```sh
cd prototypes/twin
npm run install:ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:built
npm run eval:intelligence
npm run eval:challenge
npm run test:staging -- --local --report ../../docs/assurance/evidence/local-staging-security.json
TWIN_ASSURANCE_REPORT=../../docs/assurance/evidence/deterministic-e2e.json npm run test:assurance
node scripts/benchmark-assurance.mjs ../../docs/assurance/evidence/benchmark-local.json
```

The package manager and lockfile are unchanged. `install:ci` uses the repository's pinned pnpm flow. The application is independent of the older root monorepo scripts. The synthetic intelligence evaluation writes its existing benchmark output; preserve earlier evidence rather than overwrite it in a delivery commit.

The local staging command reuses `security.test`, `worker-security.test`, `agent-integration.test` and `remediation.test`, then adds assurance, migration and harness preflight tests. It does not duplicate the JWT verifier or fake a hosted identity result. Local workerd uses real Web Crypto and D1 semantics with a synthetic JWKS endpoint. The test fixture also replaces a Worker isolate while retaining D1 and exercises two signed identities, migration preservation, concurrent transitions and rollback.

| Exit | Interpretation |
|---|---|
| 0 | The finite suite named in the report passed in that mode. |
| 1 | At least one check failed. Keep the failed evidence. |
| 2 | Blocked: required staging/model inputs are absent or invalid. No passing hosted result is emitted. |

## Hosted prerequisites — no deployment is performed by the runner

Do not run against production. The user has not authorized deployment or production identity changes. Obtain separate explicit approval for any candidate staging deployment/migration, then supply:

1. A restricted staging Worker and dedicated synthetic D1 database, attributed by an operator to the reviewed commit. Record the deployment evidence reference. The manifest's expected SHA is an input/attestation; the harness cannot independently prove which code Cloudflare deployed.
2. The gateway HTTPS origin and a separately authorized direct Worker origin with the same reviewed application/identity configuration. If direct ingress is disabled, this runner intentionally remains blocked; independently document and review that boundary instead of counting a redirect as Worker validation.
3. Exact Access issuer and audience; reachable pinned JWKS; actual signed assertion forwarding. Keep the P0-001 settings, never substitute unsigned Sites headers.
4. Two distinct synthetic Access identities with **empty/uninitialized accounts**, plus fresh post-login tokens for both. The runner refuses to mutate pre-existing accounts. It initializes and erases only accounts it created in that run.
5. A separately operator-provisioned legacy synthetic account, an independently verified one-to-one account link, and its distinctive `TWIN-STAGING-LEGACY-...` marker. The runner only reads this fixture.
6. Actual expired, wrong-issuer and wrong-audience signed test assertions. These must be acquired through authorized test applications/tenants; do not mint substitutes and call them hosted Access evidence.
7. A scoped Cloudflare credential sufficient to query the **dedicated staging D1**. The runner issues fixed read-only SQL only; no migration or identity API calls. Read permissions for this API must be confirmed by the staging operator.
8. Human authorization to create/erase those two synthetic fixture accounts. Set `authorizedSyntheticWrites` only after the target and accounts are independently checked.

Copy `prototypes/twin/scripts/staging-manifest.example.json` to a private, untracked local path and replace every placeholder. Use `suite: "p0-003"` for its three-migration candidate, or `p0-004` for the four-migration candidate. Load tokens through a secret manager or non-echoing environment injection; never paste token literals into shell history or commit them.

Required secret environment names:

```text
TWIN_STAGING_JWT_A
TWIN_STAGING_JWT_B
TWIN_STAGING_JWT_A_REFRESH
TWIN_STAGING_JWT_B_REFRESH
TWIN_STAGING_JWT_LEGACY
TWIN_STAGING_JWT_EXPIRED
TWIN_STAGING_JWT_WRONG_ISSUER
TWIN_STAGING_JWT_WRONG_AUDIENCE
TWIN_STAGING_CF_API_TOKEN
```

After staging approval and secret injection, the executable command is:

```sh
TWIN_STAGING_CONFIG=/absolute/private/staging-manifest.json \
  npm run test:staging -- --hosted --report /absolute/private/hosted-security-result.json
```

Without those inputs, this exact command returns `BLOCKED`, exit 2, and makes no requests. The report contains case IDs/status/codes and migration filenames, not JWTs, account identifiers, memory text or API credentials. HTTP redirects are never followed with credentials. Fixtures are cleaned up in `finally`; a cleanup failure fails the suite and requires operator attention.

## Migration sequence and rollback

| Order | Migration | Purpose |
|---|---|---|
| 0 | `0000_last_chameleon.sql` | Original accounts/state/version and usage requests |
| 1 | `0001_persistent_intelligence.sql` | Preserved account generations, graph and epoch |
| 2 | `0002_verified_agent_runtime.sql` | Reconciled generation-bound P0-002 run/receipt contracts |
| 3 | `0003_personal_agency_assurance.sql` | Workflows, authorization, outcome manifests, transition guards/history, priority overrides |

Configure a **separate** operator-owned staging Wrangler file with `migrations_dir` pointing to this checkout's `drizzle` directory and `d1_migrations` as its ledger. Inspect existing ledger entries and back up the authorized synthetic copy before application. Apply only unapplied files in this order. Never replay `0000` over an existing account database or mix in P0-002's separate `0001_agent_receipts.sql`. A pre-existing competing migration requires a separately reviewed reconciliation; this harness refuses that ledger.

Example operator commands, **not executed in this task**, after approval and after verifying the named database is staging:

```sh
# The private config must contain the actual dedicated staging database and migrations_dir.
npx wrangler d1 migrations list AUTHORIZED_STAGING_DATABASE_NAME --remote --config /private/staging.wrangler.json
npx wrangler d1 migrations apply AUTHORIZED_STAGING_DATABASE_NAME --remote --config /private/staging.wrangler.json
```

The local migration tests preserve legacy account ID/state/version, verify new generation linkage/foreign keys, reject out-of-order/competing ledgers, treat identical ledger reapplication as a no-op, and roll back an injected `0003` failure to the `0002` schema. Hosted rollback is a snapshot restore on an isolated copy, not a destructive down migration. Deletion-on-restore remains an operational responsibility.

## What the hosted runner observes

- Missing/malformed/tampered/expired/wrong-issuer/wrong-audience assertions and unsigned-header spoofing against gateway and direct Worker private APIs.
- Separate account markers through both routes and fresh sessions; cross-account edit/delete rejection and unknown-tool denial.
- All five existing read tools, API receipts compared with direct D1 records, current generation and replay rejection. Calls are split between the two accounts to preserve existing quotas.
- Synthetic legacy mapping, account erasure/reinitialization with a changed generation, migration ledger order and foreign-key integrity.

A finite PASS is **not hosted readiness**. The report retains manual gates: code/deployment attribution, full ingress inventory, session revocation policy, provider/Cloudflare log privacy, backup restore handling and hosted in-flight restart/revocation fault injection. The full assurance fault matrix executes locally and must later be reproduced under approved hosted fault controls. No staging-only backdoor or test-control route is added to the app.

## Real-model execution, separate from hosted authentication

```sh
# Inject the server-owned endpoint/model and any provider credential privately first.
node scripts/live-assurance.mjs ../../docs/assurance/evidence/real-model.json
npm run test:live-agent
```

`live-assurance.mjs` uses genuine configured inference, synthetic consented data, signed local identities and the actual secured workflow runtime. It has no fixture-model fallback; missing configuration exits 2. A single smoke pass does not establish broad model reliability. It also does not validate Access hosting. Paid remote inference requires an authorized provider and spend cap; this task uses only locally available resources.
