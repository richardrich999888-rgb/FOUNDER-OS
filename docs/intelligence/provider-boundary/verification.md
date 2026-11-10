# P0-003 provider completion and cancellation verification

10 November 2026. Parent: `a4395338b2eac153a122da0bb37171af5497e842`. This increment continues remediation PR #4. No merge, public deployment, production account mutation or identity-setting change was performed.

## What changed and why

The Chat Completions adapter already reported token-limited output through `ModelTurn.truncated`, but the runtime ignored it. A syntactically valid tool-call prefix could execute, and a truncated answer with a valid citation could be marked completed. Two new regressions failed on the parent with `completed` where `failed` was required.

The runtime now records reported usage, then rejects incomplete turns before any tool call or answer is processed. It returns `MODEL_INCOMPLETE_RESPONSE`, no answer and no sources, and persists a failed run. A read completed in an earlier turn keeps its truthful succeeded execution receipt; that does not turn the overall failed run into a success. No execution receipt is invented for a selection that was never executed.

The adapter requires a recognized terminal reason for the complete, non-streaming response it requested. Missing/null/unknown reasons and the unsupported deprecated function-call protocol fail as malformed. `length` and `content_filter` are treated as incomplete. A `tool_calls` finish without a call is rejected. Complete supported responses retain the existing behavior and schemas.

Transport cleanup is also hardened. Pre-aborted requests never reach fetch. Fetch and body consumption respond to cancellation even when a supplied transport ignores its signal. Unread HTTP-error/redirect bodies and responses arriving after cancellation are cancelled. Oversized responses fail without awaiting a potentially stalled cancellation implementation. Cancellation listeners and reader locks are released. The existing runtime deadline, byte cap, manual redirects, ownership, consent and receipt requirements remain in force. Cancellation is best-effort I/O cleanup; it is not proof a remote provider stopped computing or billing.

## Files and components

- `prototypes/twin/lib/agent/runtime.ts`: rejects incomplete provider turns before finalization/execution.
- `lib/agent/errors.ts`: adds one closed, sanitized error code.
- `lib/agent/chat-completions-adapter.ts`: validates terminal metadata and bounds cancellation/response lifecycle.
- `tests/agent-integration.test.mjs`: eight new regression groups covering partial selections/answers, actual API/SQL receipts, terminal metadata and transport cleanup.
- `scripts/live-provider-completion.mjs`: genuine inference probes for a truncated selection, truncated final answer and complete control. Only the negative requests' token caps are lowered; responses are returned untouched.
- This evidence directory and the acceptance-status link document commands, provenance, failed experiments and results.

No package, lockfile, migration, model prompt, provider destination, default token budget, runtime deadline, permission or UI change. Existing jose, Zod, Drizzle, the verified-principal runtime, workerd and SQLite harness are reused. The installer selected a local package-cache path; that environment-only change was restored instead of committed.

## Reproductions and engineering loop

[baseline-checks.json](baseline-checks.json) records the reproduced parent: 143 tests, TypeScript, lint, build and one built-Worker test passed. [reproductions.json](reproductions.json) retains commands and hashes for the failing-before cases.

1. Inspect: found the unused incomplete-turn flag and permissive terminal-status parsing.
2. Attack: both truncated selection and truncated cited-answer tests failed on the parent.
3. Fix: added the runtime completion gate and stricter adapter metadata checks.
4. Attack: pre-aborted transport returned success, and a stalled body did not settle in the 200 ms abort observation window. The old outer runtime deadline still bounded caller waiting; the reproduction concerns adapter cancellation and resource cleanup.
5. Fix: explicit abort handling, cancellation of unread/late bodies and nonblocking cleanup. Tests also cover a cancellation callback that never resolves.
6. Correct test setup: four HTTP probes reused one account and the fourth correctly hit the existing quota (429). Each independent case now uses its own synthetic account. Quotas and expected failure assertions were not weakened.
7. Review: the first cancellation candidate could leave an unhandled rejection if its transport synchronously aborted and threw before the race was attached. A regression reproduced this candidate-only defect. Deferring transport invocation until handlers are attached fixed it; this is not attributed to the parent implementation.
8. Regress and verify: all eight focused groups, full tests/build, unchanged synthetic evaluation, local staging selection and genuine model probes passed on the final source. Hosted prerequisites remain unavailable.

Raw external error strings, JWTs, provider payloads and private memories are not added to run receipts. New persisted failure reasons are fixed codes. All fixtures in this work are synthetic.

## Actual checks

Exact commands, exits, UTC timestamps, durations and source/log hashes are in [checks.json](checks.json). Test selections overlap; counts are not additive.

| Category | Observed result |
| --- | --- |
| Full deterministic/integration suite | 151 passed, zero failed |
| New focused provider regressions | 8 passed, included in the full suite |
| Local staging selection | 121 passed, overlaps the full suite |
| TypeScript, lint, production build | Exit 0 each |
| Built-Worker identity boundary | 1 passed, exit 0 |
| Frozen synthetic evaluation | 200/200, exit 0 |
| New genuine Qwen completion probes | 3/3 acceptance checks, exit 0 |
| Existing genuine Qwen challenge / numeric / lifecycle probes | 6/6, 4/4, 2/2; exit 0 each |
| Hosted Cloudflare execution | BLOCKED, exit 2, no checks executed |
| Human-productivity study | Not executed |

The 200-case fixture hash remains `21760f6a4b0175e9e9fd2c7b9ed517553703912eab97a6e651c38e9d37177424`. On its 80 retrieval cases, Recall@5 is 1.0 for legacy/structured/hybrid and MRR is 0.75/1.0/1.0. Temporal accuracy is 20/20. The 40-case commitment set contains 20 positives; precision and recall are 1.0. Tested deletion/isolation/activation counters remain zero. These are narrow same-author synthetic cases, not an independent accuracy or commercial benchmark. The historical benchmark artifact is unchanged; [baseline-200.json](baseline-200.json) archives this measurement.

Existing migration tests run actual SQL on disposable SQLite and local workerd/D1: fresh/upgrade controls, foreign keys/indexes, transaction rollback, concurrent updates, account/memory deletion and derived-memory invalidation. No new migration is necessary. Hosted D1 and provider backup retention remain separate operational gates.

## Genuine inference evidence

Workspace maintenance had removed the previous model/server artifacts. The pinned Qwen3-1.7B Q8 model was restored and checked against its published full SHA-256. The official llama.cpp b11880 Ubuntu CPU release archive was verified against its release digest before extraction. This run used a prebuilt official CPU binary, not the earlier source build; timing comparisons are not controlled hardware experiments. Artifact revisions, digests, byte sizes and launch arguments are in [inference-provenance.json](inference-provenance.json).

The server bound only to loopback with an explicit local CORS origin, one slot, 8192-token context, four CPU threads and reasoning off/budget zero. It was stopped after the tests. An initial server started in a separate command could not be reached by the client; starting server and clients together resolved that local connectivity issue. No provider response was replaced with a fixture. Local inference incurred no paid provider charge; this does not mean compute/electricity were free.

[live-completion.json](live-completion.json) records the three new cases:

| Probe | Genuine provider observation | Secured runtime observation |
| --- | --- | --- |
| Selection capped at one output token | `finish_reason=length`, one generated token | 503 / `MODEL_INCOMPLETE_RESPONSE`; no answer, sources or tool receipt; failed run |
| Final answer capped after normal lookup | A real read first, then `finish_reason=length` | 503 / same error; no answer or sources; succeeded read receipt retained, overall run failed |
| Complete response control | `tool_calls`, then `stop`; model omitted a citation | 200 / cited original-passage fallback; succeeded read and completed run |

Observed latencies for these three cases were approximately 16.9, 5.8 and 10.8 seconds. Local regression/build work overlapped part of this run, so these are shared-host observations, not SLOs. Production's 1200-token default and 45-second deadline were unchanged; the two negative probes lowered only their test request caps.

The prior six-case adversarial challenge, four numeric cases and two lifecycle cases were rerun on the retained implementation; all passed. Genuine invented-budget output again exercised `GROUNDING_UNSUPPORTED_NUMBER`; consent revoked after a read returned 409 with no sources. Positive budget/time cases and the commitment case used the existing original-passage fallback, not verified generated prose. The fifteen passing assertions include expected refusals/failures and are not fifteen successful user workflows or a general model-accuracy score. See the adjacent live JSON and [live-commands.json](live-commands.json).

## Protocol sources and scope limits

The [official Chat Completions contract](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) distinguishes natural/tool completion from token limits and filtering. This adapter requests non-streaming output; streaming chunks with an absent terminal reason are not its supported response shape. The [llama.cpp release](https://github.com/ggml-org/llama.cpp/releases/tag/b11880) and [Qwen model artifact](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/90862c4b9d2787eaed51d12237eafdfe7c5f6077/Qwen3-1.7B-Q8_0.gguf) are primary provenance sources. Existing project research records their MIT and Apache-2.0 licenses. No OpenAI credential was configured and no paid OpenAI inference was performed.

These changes apply to the secured runtime selected by `TWIN_AGENT_ENDPOINT` and `TWIN_AGENT_MODEL`. The original `OPENAI_API_KEY`/`OPENAI_MODEL`-only chat fallback is a separate implementation and does not inherit these new runtime guarantees. Its provider completion handling, data minimization and receipt integration require a separate review before a multi-provider release. This report does not claim that path is real-provider verified.

Broader answerability remains unresolved: a related passage is not proof it answers a missing attribute, numeric presence is not entailment, and the previously failed matched answerability experiments are not relabeled as passing. The pinned llama.cpp named-tool-choice compatibility limitation remains; actual receipts establish tool execution, not selection hints. Optional semantic retrieval remains off by default.

Hosted verification needs the approved Worker/D1/Access environment, exact issuer/audience, synthetic sessions, legacy mapping and scoped inspection credential in the [staging runbook](../staging-harness/runbook.md). Actual revocation semantics, ingress inventory, deployment attribution, log privacy and backup deletion remain manual gates. The [human evaluation protocol](../human-evaluation-protocol.md) still needs consented participants; no 25% productivity or willingness-to-pay result is claimed.

Recommendation: continue restricted alpha engineering and review with local deterministic and specifically scoped genuine-model evidence. Hosted release, general answer quality and commercial validation remain unestablished. No P0-004/P0-005 code or competing migration was merged into this branch.
