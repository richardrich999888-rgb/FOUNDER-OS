# JARVIS P0-002: Evaluation Report

Raw results: `docs/agent/p0-002-evaluation-results.json`. Reproduce with `npm run eval:agent`.
Dataset: `tests/fixtures/agent-eval-dataset.json`, 110 scenarios, generated deterministically by `scripts/agent-eval/generate-dataset.mjs`. SHA-256 `6bf496414ab0013eee7773802b0efbce4db3d2da552dda088646aa1d913d600b`. The generator self-checks for keyword collisions between users.

## What these numbers measure, and what they do not

All 110 scenarios ran through the **real** runtime, executor, authorization, evidence ledger, D1 receipt store (on in-memory SQLite), and the real `search_personal_memory` tool. The **model** was a deterministic stub:

- `policy`: a reference policy for the 85 non-adversarial scenarios. It searches on personal questions, cites what it was given, and abstains on `no_evidence`.
- Adversarial scripts for the 25 attack scenarios: `obey_unknown_tool`, `userid_override`, `fabricate_citation`, `loop_forever`, `flood`, `invalid_json`.

So the security, limit, receipt, and grounding numbers are real measurements of the runtime. Tool-selection accuracy and argument validity describe the reference policy, **not an LLM**, and say nothing about model quality. **Real-provider evaluation was NOT run**: no `OPENAI_API_KEY` or `OPENAI_MODEL` was available. `tests/agent-evaluation.test.mjs` contains a credential-gated live smoke test, which was reported as skipped.

## Results (Node v22.23.4)

| Metric | Target | Result |
|---|---|---|
| Unauthorized executions | 0 | **0** |
| Cross-user disclosures (model-visible and client-visible) | 0 | **0** |
| Unregistered tool executions | 0 | **0** |
| Runtime-limit enforcement | 100% | **100%** (110/110) |
| Receipt persistence (row count and run status match) | (none set) | **100%** |
| Workflow completion | ≥ 95% | **99.09%** (109/110) |
| Abstention on missing evidence (missing, cross-user, unconfirmed: 40) | (none set) | **100%** |
| Source-grounding accuracy (answered sources owned by the requester) | (none set) | **100%** |
| Recall scenarios citing the expected source | (none set) | 97.14% (34/35) |
| False action claims surfaced to the user | (none set) | **0** (5 before the fix, see below) |
| Tool-selection accuracy, *reference policy* | (none set) | 100% (not an LLM metric) |
| Tool-argument validity, *reference policy* | (none set) | 100% (not an LLM metric) |
| Runtime latency, in-process, stub model | (none set) | p50 1.08 ms, p95 3.09 ms, max 10.89 ms (excludes provider and D1 network time) |
| Tokens | (none set) | 65,912 input / 4,141 output, **estimated** as characters/4 over stub transcripts; not provider-reported |
| Inference cost | (none set) | **Not measured.** Needs provider `usage` and a price table; no figure is given. |

Per category: recall 34/35, missing_evidence 20/20, cross_user 15/15, unconfirmed 5/5, prompt_injection 15/15, limits 10/10, general 10/10.

## Remaining failure

`recall-030`: "When do I do my writing?" against the memory "I write a long-form essay every Sunday morning." The existing lexical retriever does no stemming, so it returns no evidence and the runtime correctly abstains. The scenario was kept unchanged. Rewording it to pass would hide a real retrieval-quality gap.

## Defects found by the engineering loop and fixed

| # | Found by | Defect | Fix | Regression test |
|---|---|---|---|---|
| 1 | runtime test | Catch-all union branch in response validation accepted malformed `function_call` items (empty `call_id`) | Per-type schemas; no fallthrough; `output` required | runtime "response parsing" |
| 2 | security test 9 | Backstop timer raced the per-call timeout, so the error code was non-deterministic; receipt writes were unbounded | Audit reserve: work deadline at 43 s, bounded receipt writes, backstop timer removed | security 9, 16d |
| 3 | route test 18 | Malformed `usage` (field names unverified) failed the whole response, a single point of failure | `usage` parsed independently; degrades to `null` | runtime "response parsing" |
| 4 | evaluation | Stored content could carry `[E#]` citation syntax into model answers (spoof or forced rejection) | `neutralizeCitationSyntax` on observations, using the same grammar as extraction | runtime "untrusted content…", "observation rendering…" |
| 5 | evaluation | A model steered by injection could claim "I granted admin access [E1]" with a valid citation | Taint rule: an unregistered-tool attempt discards model prose | security 6b; eval `falseActionClaimsSurfaced = 0` |
| 6 | dataset self-check | An injection document reused a cross-user probe keyword, which made the expectation wrong | Keyword changed; generator now asserts no collisions | generator self-check |
| 7 | review | Concurrent duplicate `requestId` returned 500; the rate limit was check-then-insert | Single-statement conditional INSERT admission | security 13, 14 |
| 8 | review | `Object.freeze(new Set())` still allows `.add()`, so principal scopes were mutable | Frozen array | runtime "principal…" |
| 9 | review | Consent copy over-stated the data shared with OpenAI | Copy corrected | (copy only) |
