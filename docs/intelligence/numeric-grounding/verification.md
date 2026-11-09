# Numeric literal grounding — P0-003 continuation

Date: 9 November 2026. Base: 76d6e8c76acf49544ea4650f8b0f88783de3da98.

## Outcome and scope

This increment addresses a reproduced integrity defect in model answers: a valid citation previously licensed arbitrary numeric prose. The saved fact “I prefer the amber folder for the Orion budget spreadsheet” allowed the controlled model answer “Your Orion budget is INR 9000000 [E1]” to be returned as cited. The new regression failed on the parent (errorCode was null), then passed after the fix.

The runtime now checks digit-based numeric literals against the excerpts it actually cites. A recognized literal absent from those excerpts suppresses the model answer. The existing runtime-authored evidence fallback displays original source passages, and the run receipt records only GROUNDING_UNSUPPORTED_NUMBER. No model-generated amount or source is substituted into the fallback.

This is a conservative literal-presence guard, not a general entailment or answerability solution. A related source passage remains a related source passage; this change does not turn the previous missing-attribute failures into passes.

## Architecture and compatibility

- lib/agent/evidence.ts extracts atomic values, retaining recognized signs, currency markers/codes, decimal/group separators, dates/times, exponents and magnitude suffixes. Unicode display normalization and removal of format controls prevent simple full-width/zero-width variants from bypassing the same comparison.
- Citation tokens are removed from answer prose before scanning. Other material inside mixed brackets is still checked: “[E1, INR 900]” does not hide the amount.
- Only the excerpts associated with the answer's real citations can support values. Metadata timestamps, labels, the question and uncited retrieved records cannot supply them.
- lib/agent/runtime.ts applies the guard after citation validation and before releasing generated prose. Existing final consent/account-generation checks, receipt persistence and fail-closed behavior remain in place.
- lib/agent/errors.ts adds one allow-listed reason. No sensitive numeric value, model response or private memory is written to the run receipt.
- No UI, migration, data ownership, tool schema, provider prompt, deadline or dependency changed. Earlier rejected prompt and provider-selection experiments remain rejected.
- scripts/live-numeric-grounding.mjs adds a genuine inference probe with two positive and two adversarial amount/time cases. It does not replace provider responses.

Existing maintained jose, Zod, Drizzle and the same pinned llama.cpp/Qwen test stack are reused. The guard itself is deterministic TypeScript and adds no model call or external service.

## Deterministic verification

checks.json records the command results and the failing-before/passing-after reproduction. The restored parent passed 126 tests, TypeScript, lint, build and one built-Worker test. With this change, 131 tests pass, including five new tests and 150 literal mutation assertions within one test. TypeScript, lint, production build, built-Worker and the unchanged 200-case evaluation pass. baseline-200.json archives this run without rewriting the historical benchmark artifact.

The new tests cover invented amounts, changed currency/magnitude/sign/percentage/time/date/exponent, normalized Unicode display forms, mixed citation brackets, borrowing labels/timestamps/uncited sources, receipt write failure and sanitized audit fields. The 150 assertions are deterministic mutations, not independent human or model scenarios.

All tests use synthetic data. JWT verification, API/account setup and actual receipt SQL execute locally; SQLite adapters and local workerd do not establish hosted D1 validation.

## Genuine inference provenance

Workspace maintenance removed the earlier checkout metadata, dependencies and inference artifacts. The published branch was cloned again; install:ci restored the locked dependencies without a lockfile change.

The model was downloaded again from the pinned official Qwen3-1.7B-GGUF revision 90862c4b9d2787eaed51d12237eafdfe7c5f6077. Its complete SHA-256 is 061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a. llama.cpp b11880 was rebuilt from commit 7790a9231d85b8af26e87ee60d8ed7373f9713f0 (MIT; model Apache-2.0). No partial/unverified model was used.

Launch parameters: loopback only, qwen3-1.7b-q8 alias, Jinja, 8192 context, one slot, four CPU threads, reasoning off and budget zero. No paid provider credential or production account was used. Provider charge zero is not a claim of zero electricity/compute cost.

The existing llama.cpp named-tool-choice compatibility limitation remains: named objects are ignored by this version. The earlier incompatible replacement was not silently reintroduced. Actual tool receipts, not request hints, determine whether a lookup executed.

Live JSON reports retain per-case status, latency, grounding reason, usage and receipts. Citation provenance and literal presence do not establish complete semantic correctness. Reports distinguish genuine inference from the controlled-model regression.

## Measured genuine inference results

All three commands exited 0 on this source:
- live-challenge.json: 6/6 unchanged original adversarial cases passed.
- live-numeric.json: 4/4 targeted cases passed; each performed an actual succeeded read with a persisted receipt. The invented-budget case exercised GROUNDING_UNSUPPORTED_NUMBER in genuine inference and released no forbidden amount.
- live-lifecycle.json: 2/2 passed, including a current approved preference and consent revoked after evidence retrieval (409 AUTHORIZATION_REVOKED, zero sources).

The two numeric positive cases used the existing GROUNDING_CITATION_MISSING source-passage fallback, which preserved the required budget/time. They are successful retrieval/presentation controls, not proof that the model produced a citation-grounded answer. The swapped-time case was cited and did not release the forbidden time. The six-case commitment case also used the missing-citation fallback.

Observed original-challenge latencies ranged from about 4.3 to 28.4 seconds; numeric probes from 9.4 to 18.9 seconds; lifecycle probes from 7.6 to 9.0 seconds. These are twelve synthetic observations on shared Linux CPU, not production percentiles, user outcomes or Mac benchmarks. The newly exercised numeric rejection is distinct from the still-unresolved broader missing-attribute abstention problem.

## Reproduction

From prototypes/twin, run the commands in checks.json. For genuine inference, set TWIN_AGENT_ENDPOINT and TWIN_AGENT_MODEL to the authorized local server and run each script with a distinct TWIN_LIVE_REPORT path:

- node scripts/live-adversarial.mjs
- node scripts/live-numeric-grounding.mjs
- node scripts/live-lifecycle.mjs

Do not fabricate responses, relax the 45-second limit or alter the original frozen challenge assertions to claim success.

## Remaining risks and release gates

- Presence is not entailment: a number from one cited passage may be assigned to the wrong person/project or used with false negation/relationships. This guard does not prove those claims.
- Spelled-out quantities, alphanumeric identifiers and units/currency spellings outside the documented scanner grammar are not comprehensively checked. Magnitude recognition is a limited set, not a multilingual quantity parser.
- Legitimate arithmetic, unit conversion, reformatting, rounding or numbered-list formatting may be rejected. The original evidence remains accessible through the fallback; no conversion is inferred as trusted.
- The earlier matched answerability set remains failing/unresolved. It is not replaced by these targeted numeric tests. Optional embeddings remain off by default.
- Cloudflare Access staging, hosted Worker/D1 isolation, legacy mapping and actual session revocation still require authorized staging infrastructure and synthetic Access sessions. See ../staging-validation.md.
- No real-user study or commercial outcome was measured. See ../human-evaluation-protocol.md. No 25% productivity claim is made.
- The parent commit workflow query returned no pull-request-triggered CI runs. Local checks are not hosted CI verification.
- Nothing was merged or deployed; no production settings or real account data changed. Continue restricted alpha engineering, not a production launch.
