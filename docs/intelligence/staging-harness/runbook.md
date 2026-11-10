# P0-003 restricted staging runner

Run this only against approved, disposable staging accounts and a dedicated synthetic D1 database. It does not deploy, apply migrations, change Access settings or run model inference. It does create and erase its own synthetic fixtures through the authenticated application API. The example manifest deliberately leaves this authorization off.

## Local reproduction

From `prototypes/twin` after `npm run install:ci`:

```sh
CLOUDFLARE_CF_FETCH_ENABLED=false npm test
npm run typecheck
npm run lint
CLOUDFLARE_CF_FETCH_ENABLED=false npm run build
CLOUDFLARE_CF_FETCH_ENABLED=false npm run test:built
npm run test:staging -- --local --report .sites-runtime/staging-local.json
npm run eval:intelligence
```

The local staging command runs the real JWT adapter, application handlers, SQL and local workerd tests using synthetic identities/JWKS. The driver integration supplies local Request/Response transport and SQLite-backed D1 responses; it is not a Cloudflare deployment. Its tests overlap `npm test`. The evaluation command regenerates `docs/intelligence/benchmark-results.json`; archive a new measurement separately instead of overwriting frozen historical evidence.

## Operator inputs for hosted execution

Copy `scripts/staging-manifest.example.json` to a private, untracked path such as `.sites-runtime/staging-manifest.json`. Never put assertions or API tokens in the manifest. Review every field before changing `authorizedSyntheticWrites` to `true`.

| Manifest input | Required evidence |
| --- | --- |
| `suite`, `environment`, `syntheticOnly` | `p0-003`, `staging`, `true`; an operator-established dedicated synthetic environment |
| `baseURL`, `directURL` | Two exact HTTPS origins, without a trailing slash, path, credentials, query or fragment; gateway and separate direct Worker ingress |
| `expectedCommit`, `deploymentEvidenceReference` | Reviewed 40-hex commit and independently retained deployment record showing that commit/configuration is served |
| `issuer`, `audience` | Exact staging Access team issuer and application's 64-hex AUD; approved Worker uses the existing pinned RS256/JWKS verifier |
| `cloudflareAccountId`, `stagingDatabaseId` | Correct staging account and dedicated synthetic D1 database, independently matched to the Worker binding |
| `legacyMarker` | Distinctive `TWIN-STAGING-LEGACY-...` marker in a separate operator-provisioned synthetic legacy account; independently verified one-to-one subject/account mapping |

The manifest is an operator assertion, not a cryptographic deployment attestation. The runner cannot identify a production host from its hostname. Confirm the environment and ownership independently. If direct ingress is disabled, retain that configuration evidence and complete a separate manual assessment; do not enable an otherwise disabled ingress just to satisfy the runner. This automatic suite remains blocked in that configuration.

Inject the following through approved local secret management. Do not paste values into chat, reports, shell history, command arguments or Git:

| Environment variable | Required value |
| --- | --- |
| `TWIN_STAGING_CONFIG` | Path to the reviewed private manifest |
| `TWIN_STAGING_JWT_A`, `TWIN_STAGING_JWT_B` | Current identity-based Access application assertions for two different, empty, exclusively reserved synthetic accounts |
| `TWIN_STAGING_JWT_A_REFRESH`, `TWIN_STAGING_JWT_B_REFRESH` | Distinct freshly issued assertions for the same respective subjects |
| `TWIN_STAGING_JWT_LEGACY` | Current assertion for a third, separately mapped synthetic legacy subject; this fixture is read, not modified |
| `TWIN_STAGING_JWT_EXPIRED` | Genuine previously issued assertion for the configured application, expired beyond clock tolerance |
| `TWIN_STAGING_JWT_WRONG_ISSUER` | Genuine current identity assertion from another authorized test tenant; its audience/signature may also differ |
| `TWIN_STAGING_JWT_WRONG_AUDIENCE` | Genuine current assertion from another application in the same staging tenant |
| `TWIN_STAGING_CF_API_TOKEN` | Narrowly scoped credential with D1 Read permission for inspection; no deployment or identity-management permission is needed |

Do not manufacture provider tokens by editing their claims. Decoding at runner preflight only screens configuration. The deployed Worker must authenticate requests independently with `jose`. Other-tenant rejection does not isolate issuer checking from audience/signature checking; the report states this. Synthetic local issuer/audience mutation tests are separate evidence.

Cloudflare documents identity application tokens, RS256 signatures and the account-specific signing keys in its [application token documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/) and [JWT verification documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/). The [D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/) accepts D1 Read permission. These documents were checked on 9 November 2026 UTC. Their existence does not verify this repository's hosted configuration.

## Migration and account prerequisites

Use the existing migration ledger in this exact order:

1. `0000_last_chameleon.sql`
2. `0001_persistent_intelligence.sql`
3. `0002_verified_agent_runtime.sql`

Do not reapply recorded migrations, import P0-002's competing migration, or apply P0-004's `0003` to satisfy this P0-003 runner. Rehearse fresh installation, upgrade, backup/restore, rollback and deletion reconciliation on a disposable database before a hosted run. The runner reads the ledger and foreign-key consistency; it does not prove backup retention, reconstruct schema history or apply repairs.

Reserve A/B for this run without concurrent user activity. Existing initialized accounts cause refusal before mutation. The reviewed server must advertise and enforce the account-generation precondition. The runner records the exact newly initialized name, generation and known version, then includes that generation on every subsequent account mutation and erase. An older server without support is rejected before initialization.

## Execute and interpret

Once the environment variables are injected:

```sh
npm run test:staging -- --hosted --report .sites-runtime/staging-hosted.json
```

Exit `0` means the finite checks passed; `1` means a check failed; `2` means configuration/prerequisites are blocked. Never count exit `2` as success. Check report creation separately if the output path is unwritable.

The runner checks all four private API boundaries with missing, spoofed, malformed, tampered and invalid assertions. Gateway redirects are recorded only as edge rejection; direct ingress must return a configured 401. It then checks refreshed-session isolation, cross-account edit/delete denial, unknown-tool denial, five read-only tools, SQL receipt agreement/replay rejection, the synthetic legacy link, erasure/reinitialization and fixture cleanup. Redirects are never followed with credentials. Each network/body read has a deadline and byte cap.

Cleanup is intentionally conservative. An unknown initialization outcome, changed name/generation/version, timeout or concurrent update may leave the runner's synthetic fixture behind. The report fails; an operator must establish ownership before manually cleaning it. Do not retry deletion using a newly fetched version to force it through. The legacy fixture must remain unchanged. Logs/reports contain fixed check IDs and error codes, not token values, response bodies, memories or external exception messages.

Even a passing hosted suite retains `BLOCKED_PENDING_MANUAL_GATES`: independently verify deployed commit/configuration, complete ingress inventory, signing-assertion forwarding/JWKS availability, actual logout/revocation semantics, hosted log privacy, in-flight restart/revocation faults, and backup deletion/restore handling. Account generation is not Access-session revocation. No real-model or human-productivity status follows from this command.

Current hosted observation: [hosted.json](hosted.json), blocked with no requests executed. See [verification.md](verification.md) for local results and unresolved risks.
