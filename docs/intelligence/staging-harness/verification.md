# P0-003 staging preparation and account-generation remediation

Report date: 10 November 2026 India time; executable observations retain their actual 9 November UTC timestamps. Parent: `ce1878b5b9876da4cfd24bbb97aa66d3ceef3324`. Delivery continues PR #4 targeting `feature/jarvis-p0-003-persistent-intelligence`; no merge or deployment is authorized by this report.

## Result

Added an executable P0-003 staging-security driver, tested locally through the real signed-identity adapter, API handlers, receipt SQL and disposable databases. Hardened the copied driver against ownership races, credential-bearing exceptions, redirects and unbounded network reads. A further real API regression exposed a stale-client account-recreation race; the current UI and staging driver now send an account-generation precondition with their existing version check.

Hosted validation is **BLOCKED**: no reviewed staging manifest, synthetic Access assertions, scoped D1 inspection credential, authorized deployment record or connected Cloudflare integration was available. The hosted command exited **2** before any requests. This is not production verification.

## Files and architectural decisions

- `prototypes/twin/scripts/staging-security.mjs`: adapted only the relevant P0-003 checks from P0-004 commit `98174493e4a2b242a3b8eb8385f7ac41e13ea4aa`. Requires explicit synthetic staging authorization. Uses built-in Node fetch/streams/crypto/child-process APIs and the existing application verification; no new cryptography or dependency.
- `scripts/staging-manifest.example.json`: nonsecret template, writes disabled by default, exact P0-003 migration lineage.
- `tests/staging-harness.test.mjs`: twelve driver, real-adapter/API and generation-race regressions. Controlled transport tests are labeled; genuine local RSA/JWKS authentication executes in the end-to-end integration.
- `app/api/twin/route.ts`: advertises generation-precondition support on authenticated GET; rejects a supplied stale/invalid `expectedGeneration` with 409 before mutation; retains the existing generation/version SQL guards. Returns generation after ordinary updates so a client can retain the precondition.
- `app/page.tsx`: preserves generation in the existing data model and sends it with account mutations. Layout, features and visible workflow remain unchanged; the existing conflict refresh behavior handles rejection.
- `package.json`: adds `test:staging` and includes the new regressions in the full suite.
- This directory and `staging-validation.md`: runbook, measured results, reproduction evidence and explicit manual gates. No migration, model adapter, prompt, tool registry, dependency version or production identity setting changed. Existing jose, Drizzle, Zod, workerd and Node SQLite harnesses are reused.

## Reproduced findings and fixes

| Finding | Failed-before observation | Fix and regression evidence |
| --- | --- | --- |
| Concurrent initialization misattributed to runner | An empty GET was followed by an idempotent initialize returning another request's account. The copied driver then issued `memory.add` and `erase`. | Require the exact random name, zero version and actual 32-hex D1 generation before recording ownership; refusal performs neither write. |
| External exception disclosed as report code | A transport threw the synthetic uppercase credential string; the original error-message pattern accepted it as an output code. | Private internal error class with constant codes; all external exceptions become `CHECK_FAILED`. Secret-echo regression now passes. |
| Same-version account recreation between HTTP requests | Using the real signed JWT/API/SQL harness, stale `memory.add` and `erase` requests both returned 200 after the original account was erased/reinitialized at version zero. | Opt-in client generation check plus existing SQL compare-and-swap; the updated UI and driver use it. Both requests now return 409 and the replacement account remains unchanged. Valid repeated saves and malformed preconditions are also tested. |

The first two defects concern the copied validation runner, not a demonstrated cross-user application bypass. The third requires a stale request for the **same verified principal** after its account is recreated; it is an account-integrity race, not forged authentication. Older third-party clients that omit the new optional field retain the prior version-only request contract for compatibility; migrate them before claiming all clients have this protection. Authorization still derives solely from verified identity, never from the supplied generation.

Additional hardening tests cover stalled fetch/body reads, oversized streams, late responses after timeout, manual redirects, invalid/ambiguous CLI modes, production or malformed manifests, wrong/stale identities, private response fields, direct 503/redirect failures, competing migrations, changed cleanup ownership/version, receipt replay and preserved synthetic legacy state. Bounded response checks are not a universal data-loss-prevention scanner.

The initial real-driver integration failed because the first ownership validator assumed UUID-formatted generations. Inspection of migration 0001 showed `lower(hex(randomblob(16)))`; the validator was corrected to that actual 32-hex representation, not bypassed. Later provider-document review removed an impossible same-audience requirement for an authentic other-tenant Access assertion; such a rejection is explicitly not labeled an isolated issuer experiment.

Original failure outcomes, commands and log hashes are retained in [reproductions.json](reproductions.json). The original P0-004 runner in PR #5 is **not patched by this PR**. Port the ownership, bounded-I/O, error-redaction and generation-precondition changes before using that branch's runner. Do not blindly merge P0-004's additional migration or routes into P0-003.

## Verification and measurements

The restored parent passed 131 tests, typecheck, lint, production build and its built-Worker test. Final command exit codes, UTC timestamps, durations and source/log hashes are in [checks.json](checks.json). Counts overlap; they are not additive.

| Evidence category | Observed result |
| --- | --- |
| Full local deterministic/integration suite | 143 passed, zero failed |
| New staging/generation tests | 12 passed, zero failed; included above |
| Local staging selection | 113 passed, zero failed; overlaps full suite |
| TypeScript, lint, production build | Exit 0 each |
| Built production Worker identity rejection | 1 passed, exit 0 |
| Frozen synthetic evaluation | 200/200, exit 0; original fixture hash unchanged |
| Actual hosted staging | BLOCKED, exit 2, no checks executed |
| Genuine model inference in this increment | Not executed; model/runtime source unchanged |
| Human productivity outcomes | Not measured |

The full suite includes existing fresh/upgrade migration controls on local workerd/D1, actual SQL foreign-key/index checks, transaction rollback under injected trigger failure, concurrent updates, deletion, derived-memory invalidation and disposable backup/restore. This increment adds no migration. Local migration evidence is not evidence about a live D1 database or provider backup retention.

[baseline-200.json](baseline-200.json) preserves the repeated measurement separately from the historical benchmark. Fixture hash: `21760f6a4b0175e9e9fd2c7b9ed517553703912eab97a6e651c38e9d37177424`. On 80 retrieval cases, Recall@5 is 1.0 for legacy/structured/hybrid; MRR is 0.75/1.0/1.0. Temporal accuracy is 20/20; commitment extraction precision and recall are 1.0 on the 40-case set with 20 positive commitments. The tested cases contain zero deleted results, unauthorized disclosures or unauthorized procedure activations. These are same-author synthetic templates, not independent real-user generalization evidence. No semantic provider was called. Scripted step reduction is not a measured 25% human productivity gain.

The earlier twelve genuine Qwen3-1.7B cases remain historical evidence at the parent in [numeric-grounding](../numeric-grounding/verification.md), not newly rerun model tests. Their existing limitations remain: numeric literal presence is not semantic entailment, the broader missing-attribute answerability set remains unresolved, and the pinned llama.cpp version ignores named tool-choice objects. No fixture was substituted for live inference here, no paid service was used, and no model-quality improvement is claimed by this increment.

## Delivery and remaining gates

[runbook.md](runbook.md) supplies reproducible commands and exact missing staging inputs. A finite hosted PASS still cannot prove deployment attribution, all ingress settings, immediate Access revocation, hosted log privacy, in-flight fault handling or backup erasure. Preserve the manual gates; do not weaken assertions to make an unavailable environment look verified.

The existing [human evaluation protocol](../human-evaluation-protocol.md) still requires consented participants and real outcomes. No participants were contacted. Continue restricted private-alpha engineering and review; hosted release and commercial validation remain unestablished. Nothing was merged, deployed publicly, or changed in real accounts.
