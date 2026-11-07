# P0-001 — identity research and design

Research date: 2026-11-07 UTC. Baseline: `d143a9eefd90925e16ff572a54ed08338b795014`, branch `feature/twin-prototype`. Scope: `prototypes/twin/` only.

## Baseline finding

`app/chatgpt-auth.ts` accepted unsigned `oai-authenticated-user-id` and email headers. `lib/twin/server.ts` used that ID as the D1 account key. The API correctly scoped data and compare-and-swap updates to that key, but its authenticity was a hosting assumption. `worker/index.ts` forwarded requests without checking identity provenance. Its connector binding is not an authentication assertion.

The local Vite plugin strips spoofed headers and injects a development identity on loopback. That middleware is absent from the production Worker. Existing API tests replaced the identity helper with `setUser()`, so they could not detect this boundary failure. No deployed bypass is asserted: actual origin reachability and gateway sanitization were not established.

## Official implementations inspected

| Project                                                                                     | Source inspected                                                                                                                                                                                                                                                                            | License evidence                                                                                       | Runtime and reuse decision                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [panva/jose](https://github.com/panva/jose)                                                 | Initial HEAD `607c3f7ab3b024a50aee9c7e12e6ed8b048e6964`; selected [v6.2.14](https://github.com/panva/jose/tree/v6.2.14), commit `93c20f9516a916c3cdd33e13f92b9c0689058f21`. Inspected `src/jwt/verify.ts`, `src/lib/jwt_claims_set.ts`, `src/jwks/remote.ts`, package manifest and license. | MIT, `LICENSE.md`. Installed package retains its notice.                                               | Directly compatible with Workers Web Crypto and ESM. Reuse `jwtVerify`, `createRemoteJWKSet`, and test transport injection; no copied cryptographic implementation. Exact dependency pin `6.2.14`.                                                                       |
| [OpenFGA](https://github.com/openfga/openfga/tree/4b09dafb027d839e6c42073e6e288f5ea6881d4d) | `internal/authn/authn.go`, `internal/authz/authz.go`, repository documentation and license.                                                                                                                                                                                                 | Apache-2.0.                                                                                            | Go authorization server; not a drop-in Workers isolate library. A future Worker could call a separately operated service. Adopt the separation of authentication, principal, action, resource and authorization; no code copied or runtime service added.                |
| [Cerbos](https://github.com/cerbos/cerbos/tree/6340b1879cfb08a4ba11f53ce0b95e68a141b4fa)    | `internal/auxdata/jwt.go`, engine references, repository documentation and license.                                                                                                                                                                                                         | Apache-2.0.                                                                                            | Go policy decision point is not a direct Workers module. Hosted/embedded policy products would require a separate integration decision. Adopt explicit policy checks and default denial; no runtime dependency.                                                          |
| [Bhono](https://github.com/etusdigital/bhono/tree/bc8d0603fe184a1c6ba77b452b4f30eadcb94eca) | `src/server/auth/guards.ts`, `src/server/auth/setup.ts`, README, package manifest.                                                                                                                                                                                                          | **Unresolved:** README says MIT and links a missing LICENSE; `package.json` says ISC at this revision. | Hono/Cloudflare/D1 patterns are relevant, but its `@etus/auth` gateway, roles and sessions are not this app's identity provider. Learn from separate permission guards/account ownership checks. Copy no code; do not assume license clearance or import its auth stack. |

The newest inspected jose release, 6.2.15, was rejected by the existing seven-day dependency maturity policy (published November 1). Version 6.2.14 was published October 29 and installed with the policy unchanged. This is a reproducible pin, not a claim that dependencies need no future advisory review.

OpenFGA and Cerbos add no demonstrated value for the current single-owner account model. Reconsider when verified requirements introduce sharing, organizations, delegated roles, or independently managed policy.

## Provider compatibility: documented tokens, not an invented token

Cloudflare's official [application-token documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/) documents user application JWTs with RS256, `kid`, `typ: JWT`, `iss`, `aud`, `sub`, `exp`, `iat`, `nbf`, and `type: app`. Service-token JWTs have an empty subject and are unsuitable for personal-account ownership. The adapter rejects them.

The official [JWT validation documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) specifies the `Cf-Access-Jwt-Assertion` header and the team endpoint `/cdn-cgi/access/certs`; its Workers example uses jose with issuer and audience validation. This establishes that the provider issues the token format. **No actual Access tenant, application AUD, real user token, or production login has been provisioned or verified for this repository.**

The locally available Sites identity reference documents unsigned visitor headers, site-scoped IDs, and a service access token that does not represent a visitor. It did not establish a signed visitor assertion, ingress header stripping, or absence of direct ingress. Therefore this patch provides a separate verified Access adapter. There is no unsigned Sites fallback. The existing separate live Sites deployment was not changed.

## Candidate architecture

1. `request-identity.ts` reads only server environment configuration and actual request headers. It caches the verifier, never the visitor. Missing/invalid configuration returns 503 and no data.
2. `verify-token.ts` pins an exact HTTPS Cloudflare team issuer, exact 64-hex application audience, RS256, JWT type, required claims, and expiry/not-before. It derives JWKS solely from the trusted issuer. Redirects and arbitrary token key URLs are not followed. jose handles signatures/key selection. Remote cache: five minutes; unknown-key refresh cooldown: 30 seconds; fetch timeout: five seconds.
3. `identity.ts` discards email, roles and arbitrary claims. It derives `cf-access:SHA256(JSON([issuer, subject]))`, or uses an explicit trusted legacy link. Frozen identities are registered in an internal WeakSet; a structurally identical JSON object is not verified.
4. `authorize.ts` permits only named owner operations for the verified owner. `load()` accepts a verified principal, not a caller-selected owner string. Every active data route authenticates before D1 access; writes retain origin checks, state version comparisons, and owner filters.
5. `tool-permissions.ts` issues short-lived, process-local, nonserializable capabilities for explicitly selected `memory.list`, `memory.read`, and `memory.search`. They return only confirmed memories and recheck expiry after asynchronous loading. No route or LLM tool can issue grants. No external action or write tool is enabled.
6. `audit.ts` logs only a fixed event name, random decision ID, timestamp, allow/deny, and an allowlisted operation. Unknown input becomes `unknown`. No account IDs, emails, JWTs, raw errors, arguments, URLs or memory text are logged by these security modules.

The trust boundary is the application's signature verification, including requests that bypass a gateway. TLS, trusted deployment configuration, trusted issuer keys, and application-code integrity remain assumptions. Authentication does not prove gateway transit; a valid stolen bearer token remains usable until expiry.

## Legacy account preservation and rollout prerequisites

No D1 schema, existing `user_id`, state JSON, or version is rewritten. New identities are namespaced and cannot claim a legacy row by matching its subject or email. Optional `TWIN_AUTH_ACCOUNT_LINKS` is server-only JSON, scoped to the configured issuer:

```json
[{ "subject": "verified-provider-subject", "accountId": "existing-site-scoped-id" }]
```

Links must be established by an operator from independent proof of both identities. Duplicate subjects/owners, reserved new-account IDs and malformed configuration fail closed. The small deployment configuration is capped at 1,000 links; a larger migration needs a separately reviewed identity-link store. There is no client linking endpoint. Keep real mappings out of GitHub and logs.

Before deployment:

- Provision an Access application for a controlled staging hostname. Use an appropriate IdP, user allow policy, MFA and a bounded session duration. Record the exact team issuer and application AUD. Test a real user token without recording it.
- Set `TWIN_AUTH_PROVIDER=cloudflare-access`, `TWIN_AUTH_ISSUER`, and `TWIN_AUTH_AUDIENCE` as deployment bindings. Do not infer them from requests. No key or secret is needed for public-JWKS verification.
- If retaining Sites hosting, demonstrate that Access can front that deployment and its signed assertion reaches the Worker. The present session does not establish this capability. Otherwise use a separately approved Workers deployment; do not silently replace the live site.
- Back up account records under the existing data policy, verify legacy links, and test two existing synthetic users against their original IDs/versions. Never join by email. Switching before this step makes existing users unable to access their rows.
- Test gateway and direct origins, login/logout, legitimate requests, cross-user read/write/delete attempts and secret-free logging. Sign-in links navigate through `/` and depend on Access protecting that hostname; they do not implement a standalone login provider.
- Obtain deployment approval. No public deployment or production identity-setting change is part of this patch. Do not deploy the branch unconfigured: it intentionally denies data access.
