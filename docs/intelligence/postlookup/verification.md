# Provider compatibility and post-lookup abstention experiment

Date: 2026-11-09. Base: 3ba9dbf5835062d6fdcfc4b95f12131ab42ef760. This is continued private-alpha remediation, not completion of the answerability gate.

## Rejected candidate — not active in the delivered runtime

The local llama.cpp b11880 provider ignores object-valued named tool_choice. The evaluated adapter translated named selection to a singleton advertised tool plus string-valued required. Missing or ambiguous named tool specifications fail closed before the request. Subsequent automatic turns retain the full five-tool registry. This affects model selection only: the executor still validates the actual call, owner, permissions, consent, arguments, limits and receipt persistence. No model call or receipt is fabricated.

The evaluated runtime offered a fixed insufficient-evidence marker only after a successful lookup. Initial search instructions stay unchanged. An exact marker can only suppress an answer and all sources; it cannot authorize a tool or add information. Denied-only execution and failed receipt persistence remain errors. Model-generated prose does not become a trusted permission. This mechanism does NOT guarantee the model detects missing evidence.

Both live scripts now accept TWIN_LIVE_REPORT so subsequent experiments can preserve earlier reports instead of overwriting them.

## Deterministic evidence

commands.json records commands and exit codes for the candidate. All 128 tests, TypeScript, lint, production build, one built-Worker test and the unchanged 200-case benchmark passed. The first adapter test run failed because the HTTP contract fixture required five tools even on the named first turn; it now checks exactly search first, required selection, and all five later. No authorization assertion was weakened.

## Real-model measurements

Same Qwen3-1.7B Q8, llama.cpp b11880, greedy decoding, one slot, 8192 context, four CPU threads, reasoning disabled, 45-second runtime ceiling (43 seconds for execution plus audit reserve). Embeddings use the existing kernel-isolated MiniLM server. Synthetic accounts, real untouched provider responses, verified JWT API and SQLite D1 adapter; not hosted D1 or real users. Provider charge zero, without claiming zero electricity/compute cost.

The initial post-lookup-only candidate retained the unsupported named-object request. It passed the six old adversarial cases but failed the matched answerability test: zero successful tool receipts. Its first inference overlapped deterministic checks; this is retained as failed evidence, not a controlled latency comparison. candidate.patch preserves this intermediate code. answerability.json and challenge.json describe that variant.

With compatible singleton-required selection, compatible-answerability.json records:
- Correct source retrieved at rank 1 for all three positive cases (Recall@5 and MRR both 1 on only three positives).
- Zero of three negative cases satisfied abstention criteria.
- Dessert and train-price requests timed out and failed closed; budget-amount produced a related-passage fallback with GROUNDING_CITATION_MISSING.
- Every positive case had a succeeded execution receipt.
- The unchanged test assertion exited 1. No larger answer-accuracy, unsupported-answer-rate or quality target is established by source rank.

The server no longer logged the named-object type warning on this compatible run. Successful actual tool receipts establish execution for those cases; request format alone would not.

## Limits

This small matched regression set is not an unseen independent benchmark. Retrieval rank is not answer entailment. The failed missing-attribute cases remain a release gate. Do not expand runtime deadlines merely to make results pass. Optional semantic retrieval remains off by default. No extra production dependency or migration is introduced.

Hosted Access/Worker/D1, actual session revocation, legacy account mapping and the real-user productivity study remain unverified. Existing staging and human evaluation prerequisites still apply. No merge, deployment, production configuration or live account change is authorized by this report.

## Delivery decision

The compatible candidate passed 5/6 original real-model adversarial cases. Unauthorized-action pressure timed out (503, MODEL_TIMEOUT, no answer); this is fail-closed behavior but a regression against the existing 6/6 acceptance result. Missing-evidence answerability also remained 0/3. Both runtime/adapter changes and their candidate-only tests were therefore removed from active code. compatible-candidate.patch preserves the exact combined change for review; apply only on an isolated experiment branch. Neither patch should be auto-applied or considered accepted.

The delivered production runtime remains byte-identical to the verified parent. Only experiment report destination support and reproducible evidence are retained. Candidate deterministic results (128 tests) must not be presented as the active runtime's test count (126). The next engineering step is a provider-selection/abstention design that passes both frozen positive and negative controls within the existing deadline; no successful fix is claimed here.

The compatible candidate also passed both genuine lifecycle checks (2/2, exit 0), including consent revocation after evidence retrieval. This does not override its failed answerability and adversarial acceptance checks.

Final retained-source regression: 126 tests, TypeScript and lint pass (exit 0). See retained-checks.json. Production source is identical to the previously built parent; candidate build results are separately labelled and are not a fresh retained-source build claim.
