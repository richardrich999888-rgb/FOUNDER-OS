# P0-003 final reliability continuation — 2026-11-09

This increment is based on remediation commit 734b2ce4f153ef46411b50e2ce5852716d4b8b93. It preserves the UI, migrations, identity boundary, authorized registry and receipt enforcement. No production configuration, deployment, accounts or data changed.

## Retained implementation

The model port and Chat Completions adapter support a server-selected named initial search. The personal-memory route supplies search_personal_memory. This is a provider hint, not an authorization control: all five read-only tool schemas remain available, and every actual call passes the existing executor. A regression test demonstrates an attempted send_email remains denied. There is no fabricated model tool call or execution receipt.

Important compatibility finding: llama.cpp b11880 logs “Wrong type supplied for parameter 'tool_choice'” for the named object and falls back to its default. Thus this local experiment does NOT demonstrate provider-enforced named selection. The earlier six-case improvement is an observed result with provider fallback, not proof the named feature caused it. Providers supporting the Chat Completions named-function shape can use it; provider conformance remains a separate gate.

The new live lifecycle runner uses untouched real provider responses, signed synthetic identities and the SQLite D1 adapter. It checks an approved temporal correction and revokes consent after a successful evidence read, immediately before releasing the second actual provider response to the secured runtime. The expected revoked result is 409, AUTHORIZATION_REVOKED, no answer and no sources.

## Deterministic verification

See commands.json for exact commands and exits. Final retained source passes 126 tests, TypeScript, lint, production build, one built-Worker test and the unchanged 200-case benchmark. baseline-final.json contains the final benchmark measurement; the historical baseline artifact is preserved. Local migration, account isolation and security cases are included in npm test. No new migration is introduced. These are local runtime/SQLite/workerd checks, not hosted D1 evidence.

## Genuine inference and rejected experiments

Qwen3-1.7B Q8 ran on CPU through llama.cpp b11880, with reasoning disabled, one slot, context 8192, four threads, greedy decoding and the secured application runtime. No provider response fixture was substituted. Final retained-source results: six adversarial cases passed (6/6) and both lifecycle cases passed (2/2), with command exit 0 for each. See model-challenge-final.json and live-lifecycle.json for final retained-source outcomes, timings, receipts and exact scope. The earlier successful named-hint run is model-challenge.json. A small passing set does not establish general personal-answer accuracy.

A new matched six-case answerability set pairs three missing attributes with three answerable questions. It is a regression set, not an independent unseen benchmark. Original frozen benchmarks were not modified. Experimental abstention-marker instructions achieved only 1/3 positive recall; splitting lookup/answer instructions still achieved 1/3; adding an explicit search prefix achieved 2/3 positive recall and 2/3 negative abstention. Assertions failed and remain strict. These prompt/runtime experiments were removed, not promoted. Historical JSON preserves the failures. challenge-rejected-phase-prompt.json records the corresponding regression in the original live challenge. The answerability script remains available as a quality gate; its historical files describe rejected variants, not the delivered default.

The independent 12-case near-miss set was frozen before the cross-encoder experiment. A genuine cross-encoder/ms-marco-MiniLM-L6-v2 experiment used a fixed zero-logit cutoff. It achieved 15/24 prior positives, 5/12 holdout positives, 12/12 holdout negative abstentions, but only 5/12 near-miss abstentions. It was rejected and is NOT a runtime dependency. Ranking relevance is not proof a passage answers the requested attribute.

Official source/model card: https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2 (Apache-2.0), revision 233902d25c440f23af6f7d6e94d2946bac0bee0a. The experiment verifies model SHA256 5d3e70fd0c9ff14b9b5169a51e957b7a9c74897afd0a35ce4bd318150c1d4d4a and tokenizer SHA256 d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66. An initially truncated download failed the hash check and was repaired before inference. Native ONNX inference runs behind the existing Linux seccomp network restriction, installed before native imports; telemetry disabling alone is not relied upon.

No new library is added to the Worker. Existing jose, Zod and authorization enforcement remain intact. Local inference provider charge was zero; CPU time, electricity and hosting are not claimed free.

## Reproduction

Run the commands in commands.json from prototypes/twin. For genuine inference, start a compatible local Chat Completions server and set TWIN_AGENT_ENDPOINT and TWIN_AGENT_MODEL, then run:

- TWIN_LIVE_REPORT=../../docs/intelligence/final-reliability/model-challenge-final.json node scripts/live-adversarial.mjs
- node scripts/live-lifecycle.mjs
- With the existing isolated embedding server and TWIN_EMBEDDING_ENDPOINT: node experiments/evaluate-answerability.mjs
- With verified downloaded artifacts and Python inference dependencies: RERANKER_DIR=/absolute/model/path PYTHONPATH=/absolute/dependencies python experiments/evaluate-relevance.py

Do not confuse an experiment finishing with acceptance: the answerability script exits nonzero unless every positive and negative satisfies its assertions. The relevance experiment reports measured performance and is explicitly rejected here.

## Remaining release gates

- Related-topic retrieval can still be mistaken for sufficient answer evidence; citations establish provenance, not entailment. Optional semantic retrieval remains off by default. The failed answerability experiments preclude a broad accuracy claim.
- Hosted staging remains blocked on an authorized Worker/D1/Access hostname, exact issuer/audience, two synthetic Access sessions, verified legacy mapping and staging deployment authorization. See ../staging-validation.md. Do not claim immediate Access logout revocation from local JWT verification.
- Local loopback inference is not reachable from hosted Workers. A permitted reachable provider and explicit data-sharing consent are required for hosted inference.
- No 10–20-person study has run; the existing human protocol is preparation only. No measured 25% human productivity gain or commercial validation is claimed.
- A newer P0-004 branch (9817449 at this fetch) exists separately. It is not merged here, and its reports are not counted as this branch's verification.
- Nothing was merged or deployed. Continue restricted alpha evaluation; do not declare production or commercial readiness.
