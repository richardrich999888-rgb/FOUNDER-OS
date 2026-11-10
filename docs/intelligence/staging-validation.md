# Restricted staging validation — not executed

This is the concrete remaining deployment gate. The existing owner-private Sites instance is unchanged; do not replace its identity settings with this branch without approved staging and account-link validation. Local workerd is runtime compatibility evidence, not hosted authentication evidence.

The P0-003 [staging runner and runbook](staging-harness/runbook.md) now automate a finite subset of these checks, with [local verification evidence](staging-harness/verification.md). Hosted execution remains blocked; the runner does not deploy or replace the manual gates below.

## Missing inputs

- An authorized staging Worker, D1 database and Access-protected hostname; direct Worker URL or evidence that direct ingress is disabled.
- `TWIN_AUTH_PROVIDER=cloudflare-access`, exact `TWIN_AUTH_ISSUER` and application `TWIN_AUTH_AUDIENCE`, pinned RS256/JWKS reachability and signed `Cf-Access-Jwt-Assertion` forwarding. A Sites unsigned user header is insufficient.
- Two isolated synthetic test accounts with actual Access login sessions. For legacy compatibility, operator-verified one-to-one `TWIN_AUTH_ACCOUNT_LINKS` and a staging copy whose ownership is established independently of email.
- Permission to deploy the reviewed commit to that restricted staging environment; no production change is implied.
- For hosted inference: a reachable approved model endpoint, optional securely stored provider credential, explicit per-account context-sharing consent and a spend cap. The current agent route includes a Chat Completions adapter; see remediation evidence for actual local model results. Loopback on this test machine is not reachable from a hosted Worker.

## Execution and evidence to retain

1. Snapshot staging data and record the reviewed commit SHA. Apply 0000, then 0001, then 0002 using the migration ledger; do not reapply migrations already recorded or apply P0-002's competing 0001. Rehearse rollback against the snapshot. Verify preserved account IDs/state/version and foreign keys. Determine backup retention and deletion-on-restore handling.
2. Against gateway and direct Worker, try missing, unsigned spoofed, malformed, expired, tampered, wrong-issuer and wrong-audience tokens. Private APIs must not disclose data. A gateway redirect alone does not verify the Worker boundary. Distinguish an unconfigured 503 from a configured 401/403.
3. Sign in with both synthetic accounts. Each must retrieve its own distinctive synthetic marker and fail to retrieve, edit, forget or activate the other account's IDs. Repeat after logout/new session. Verify a mapped legacy account still owns its original data. Do not use actual private memories as fixtures.
4. Run all five read-only tools through `/api/agent`; inspect persisted owner/generation-scoped run and execution receipts. Compare API status to receipt status. Confirm unknown tools and owner/permission arguments fail, quotas are atomic, and no external action is sent.
5. Test correction, forgetting and account erase/reinitialize while requests wait. No old-generation result may be released and no delayed write may recreate erased receipts. Inspect active graph, legacy corpus and receipts. Backups are a separate operational guarantee.
6. Inspect logs for credentials, raw content or private memory; retain only redacted status/error codes, test case IDs, timestamps and commit/configuration revisions. Do not store JWTs, key values or user text in GitHub evidence.
7. If the provider integration is subsequently authorized, use synthetic consented data, real provider responses and usage accounting. Test consent revocation during a call; assert no stale final response or replay. Record tokens/cost/latency and provider trace ID securely. Do not reuse deterministic local runs as provider evidence.

Current result for every hosted item above: **not executed — prerequisites unavailable**. Fill the evidence record with actual outcome, observed response, commit and test time; leave failures visible. Release only after these checks and explicit deployment approval.

## Session revocation limitation

JWT signature/issuer/audience/expiry validation is local. It does not consult an Access revocation endpoint on every request. Verify actual token lifetime and provider logout/revocation semantics in staging; do not claim immediate Access session revocation. Account generation and consent checks are separate application controls.
