# P0-003 final remediation — 2026-11-09

## Scope and provenance

Base P0-003 `54c716487d0a326ae5bb87588e0d6a8f1aae6e4e`; security P0-001 `cf0691e0786acd399d7ec12d6f071409caf5713c`; separate P0-002 `436a4037b8490be50a2e7a6e3176b9de5c87c594`. Existing PRs 1–3 were open/unmerged; no GitHub Actions run was available. This is a fresh execution and manual source review, not a third-party audit. A formal security-scan service was unavailable. No production data, settings or deployment changed.

The P0-002 branch reports 63/90 Qwen2.5-7B cases. That is upstream evidence, not reproduced here. Its migration numbering and runtime contracts differ; it was not merged wholesale. The secured P0-003 adapter, principal and receipt integration remain authoritative.

## Changes and findings

1. **Malformed stored validity/provenance:** non-date validity fields could pass JavaScript NaN comparisons. Reproduced with a corrupted/restored snapshot, not an untrusted HTTP write. Retrieval now rejects invalid timestamps, mismatched content kinds and blank provenance. Normal mutation validation already rejects these inputs. Regression and 13 independent privacy/provenance gates pass.
2. **Oversized context misclassified:** a valid approved procedure exceeding the total assembly cap disappeared as `no_evidence`. Reproduced before patch. Retrieval now raises `LIMIT`, mapped to `TOOL_RESULT_TOO_LARGE` at the tool boundary. No output limit was increased.
3. **Real model omitted retrieval:** Qwen3-0.6B returned no tool call, so evidence-required mode safely abstained despite available memory. The first model request now uses `tool_choice=required`; ignored requests still abstain. This is a provider hint, never authorization. Subsequent CPU model failures remain recorded, not hidden.
4. Live inference also exposed missing enum/length constraints in the advertised tool schema. Provider schemas now match execution constraints. A denied-only lookup now fails with its recorded error instead of returning successful missing evidence; genuine successful empty searches still abstain.
5. Added forged-receipt/replay rejection, restore-integrity rehearsal, strict alpha measurement instrumentation and a newly frozen independent-of-baseline challenge. No new runtime dependencies or migrations.

Authorization remains based on minted verified identity, generation/epoch and consent gates, strict tool arguments, scoped SQL and bounded execution. Security logs use sanitized decisions, not raw memories or credentials. Receipts are database-backed execution records; they are not cryptographic attestations against a malicious database operator. Citation IDs prove ledger membership, not semantic entailment of arbitrary model prose.

## Commands and results

Run from `prototypes/twin`, Node v24.22.1, Linux x86_64. Baseline commands preceded source edits.

| Command | Baseline | Final |
|---|---|---|
| `npm run install:ci` | exit 0 | dependencies unchanged |
| `npm test` | exit 0; 110/110 | exit 0; 118/118 |
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run lint` | exit 0 | exit 0 |
| `npm run build` | exit 0 | exit 0 |
| `npm run test:built` | exit 0; 1/1 | exit 0; 1/1 |
| `npm run eval:intelligence` | exit 0; 200/200 | exit 0; 200/200; final-benchmark.json |
| `node --test tests/remediation.test.mjs` | first reproduction: 2 failures | incorporated into complete suite |
| `npm run eval:challenge` | new evaluation | see challenge-results.json; measurement exit 0 does NOT mean target met |

Original frozen benchmark and its historical report remain unchanged. Baseline and final rerun reports are separate files. Initial malformed-metadata and oversized-context assertions failed on original source and passed after fixes. No assertion was weakened.

## Migration and restore evidence

Existing suite covers ordered 0000 → 0001 → 0002 fresh installation and legacy upgrade, ownership/index/trigger behavior, transactional failure, deletion and generation races. Workerd tests exercise the actual local Cloudflare runtime; Node SQLite adapters exercise route/service transactions. New SQLite snapshot/restore checks pass both `foreign_key_check` and `integrity_check` before and after forgetting. Pre-deletion backups demonstrably retain old data; active deletion is not backup deletion. A restored old snapshot must stay offline until independently retained erasure records are reconciled. Hosted D1 backup retention and Time Travel restoration remain operator/staging prerequisites. No migration changed, and no destructive remote tests ran.

## Evaluation interpretation

The original 200 synthetic scenarios reproduce their reported pass result: retrieval Recall@5 1.0; structured/hybrid MRR 1.0, legacy MRR .75; commitment extraction precision/recall 1.0 on 40 templated cases. These are narrow synthetic measurements.

A newly frozen 24-query challenge includes literal and paraphrased queries. Legacy, structured and hybrid each achieve **16/24 Recall@5 = 66.7%, MRR = .667**. All 13 additional corrupted-state/privacy gates pass. The 90% retrieval target is **not met on this challenge**. No synonyms were hard-coded against test answers. Semantic embeddings were not adopted without a separate latency/privacy/ranking experiment. New fixture authorship is independent of the old baseline, not an external blinded holdout. Live-model semantic entailment and real-world commitment extraction remain unestablished.

## Acceptance boundaries

A–E and G have deterministic route/service/security coverage in the preserved suite, including temporal correction, deletion and explicit procedural approval. F requires real model tool execution with a persisted receipt; inspect the live reports separately. Synthetic preparation-step savings are not human productivity evidence.

- **Locally verified:** deterministic tests, typecheck, lint, build and built Worker pass.
- **Real-model:** actual attempts and failures retained; see accompanying live evidence. Do not generalize smoke successes into model quality acceptance.
- **Hosted staging:** blocked by missing authorized Worker/D1/Access hostname, issuer/audience configuration, two synthetic Access sessions, legacy mapping and deployment permission. Sites project environment read returned no entries. No hosted verification claimed.
- **Commercial:** unmeasured; 10–20 consenting participants and observed workflows required. Protocol and scorer are available.

Immediate Access session revocation is not established by offline JWT verification; issued tokens may remain valid until expiry. Consent and account generation revocation are independently checked by the application. The updated staging checklist explicitly distinguishes these guarantees.

## Iterations

1. Reproduced baseline and reviewed branch contracts.
2. Reproduced and fixed malformed metadata / oversized-context failures; added replay and restore cases.
3. Froze and ran new challenge; preserved unmet retrieval target.
4. Ran genuine local inference, reproduced skipped lookup; required initial selection and regression-tested fail-closed behavior.
5. Corrected advertised schemas and failed-only lookup classification after the real challenge. A typecheck initially rejected missing schema descriptions; descriptions and typed bounds were added without loosening runtime validation.
6. Reran complete validation; collected local-model and external prerequisites separately.

Recommendation: continue private development; do not announce P0-003 complete or production-ready. Resolve semantic retrieval quality and successful secured real-model acceptance, then execute authorized staging and the consented pilot.

## Remaining live inference blocker

The six-case real Qwen3-0.6B challenge produced five timeouts and one rejected invalid tool call (persisted denial receipt); 0/6 product assertions passed. No successful authorized real-model retrieval was demonstrated. The subsequent schema/error-classification correction is covered by regressions and a fresh final smoke report. The larger 1.7B weights download exited 28 after a 180-second timeout; partial weights were not used. A viable local model/server configuration or an authorized reachable endpoint remains required. No inference credential exists in this checkout. These are concrete failed experiments, not an assumption that paid inference is necessary.

Final secured-source real-model smoke: **0/2**, both `MODEL_TIMEOUT` at approximately 43 seconds, no tool receipts or sources. Thus real-model verified status is **not achieved**, even though genuine inference was attempted.
