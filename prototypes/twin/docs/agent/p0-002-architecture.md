# JARVIS P0-002: Agent Runtime Architecture

Status: implemented and tested with deterministic model stubs. Not yet evaluated against a live model, because no provider credentials were available.
Scope: `prototypes/twin` only. Memory mode and the UI are unchanged, apart from one consent-copy correction (see §9).

## 0. Prerequisite finding: P0-001 is absent

The repository contains no P0-001 identity or authorization work: no branch, commit, document, or code. The only identity mechanism is `app/chatgpt-auth.ts`. It trusts `oai-authenticated-user-*` headers that the Sites hosting edge injects, and its README states the app must not be exposed as a public Worker without a replacement authentication boundary.

Decision: P0-002 does **not** invent an authentication layer and does **not** use a mock identity in production code. The runtime consumes identity through one port, `createVerifiedPrincipal()` in `lib/agent/principal.ts`. Its only production caller passes the user returned by the existing `getChatGPTUser()` boundary. When P0-001 lands, only that caller changes.

Consequence: the runtime's identity is exactly as trustworthy as the Sites header injection. Specifically, it depends on the platform stripping client-supplied `oai-authenticated-*` headers. This repository cannot verify that property, so it is a P0-001 blocker for any deployment outside Sites.

## 1. Research summary

| Topic | Finding | Status |
|---|---|---|
| Function tool shape | `{type:'function', name, description, parameters, strict}` | Verified (openai-node `FunctionTool` type) |
| Tool call output item | `{type:'function_call', call_id, name, arguments: string, id?, status?}` | Verified (openai-node types, via extracted summary) |
| Tool result input item | `{type:'function_call_output', call_id, output}` | Verified (openai-node types) |
| `tool_choice`, `parallel_tool_calls`, `max_output_tokens` | Exist on responses.create | Verified |
| `max_tool_calls` | Documented as a limit on **built-in** tools only | Verified. Not relied on; the backend enforces the cap. |
| Strict-mode schema rules | Not stated in the sources that could be fetched | **Unverified.** Schemas are restricted to closed objects with every property required, the conservative subset. |
| `usage` field names | `input_tokens` / `output_tokens` | **Unverified.** Parsed leniently; drift degrades usage to `null`. |
| Stateless replay with `store:false` | Prior calls must be replayed in `input` | **Partially verified.** Replay omits provider item `id`s, because those reference stored items that do not exist with `store:false`. |
| Reasoning items with `store:false` | `include: ['reasoning.encrypted_content']` enables stateless reasoning replay | Verified that it exists. Not used: reasoning items are dropped, which may reduce quality on reasoning models. |
| Cloudflare Workers limits | Not verified: `developers.cloudflare.com` fails DNS from the build container | **Unverified.** The design avoids depending on it: every await is time-bounded in code. |

`platform.openai.com` and `developers.cloudflare.com` were unreachable (DNS failure) from the build environment. The verified facts come from `openai/openai-node` (`src/resources/responses/responses.ts`) and `openai/openai-agents-js` (`openaiResponsesModel.ts`) on GitHub.

**Framework decision:** use a minimal custom loop with no new dependency. The loop is about 150 lines (`runtime.ts`). Both OpenAI Agents SDK and LangGraph would add a dependency tree to a Worker bundle and hide the exact control points this milestone has to audit: the authorization order, the receipt write-ahead, and the deadline accounting. No test showed a benefit that would justify them.

## 2. Module layout (hexagonal)

```
lib/agent/
  principal.ts        port: VerifiedPrincipal (branded, frozen), deny-by-default scopes
  limits.ts           PRODUCTION_LIMITS + resolveLimits (overrides may only tighten)
  errors.ts           closed ErrorCode allow-list, sanitizeErrorCode
  tool-registry.ts    typed, frozen registry; Zod (authoritative) + JSON Schema (model-facing)
  tools/search-personal-memory.ts   first tool; reads via PersonalCorpusReader port
  authorization.ts    pure policy: side effects, scope, budget, deadline
  executor.ts         per-call pipeline + bounded receipt writes
  evidence.ts         ledger, citation extraction/verification, citation-syntax neutralization
  instructions.ts     model instructions, observation rendering, runtime-authored texts
  model-adapter.ts    ModelPort + OpenAI Responses adapter (fetch, no SDK)
  receipts.ts         ReceiptStore port + D1 adapter
  runtime.ts          bounded loop + answer policy
  admission.ts        atomic duplicate/rate-limit admission (D1, single statement)
  live-ai.ts          application service + HTTP presentation
app/api/chat/route.ts composition root only (binds D1, env, identity)
```

Core logic (`authorization`, `evidence`, `instructions`, `limits`, `errors`, response parsing) does no I/O. I/O is confined to adapters: the D1 receipt store, D1 admission, the fetch-based model adapter, and the corpus reader.

## 3. Execution pipeline (per tool call)

```
model function_call
  -> protocol checks     unique call_id, arguments <= 2,000 chars
  -> registry lookup     unknown -> deny UNKNOWN_TOOL (receipt tool_id = 'unregistered')
  -> schema validation   JSON.parse + strict Zod (extra keys such as userId rejected)
  -> authorization       side effects, scope 'memory:read', budget (5), deadline
  -> receipt begin       write-ahead; failure => tool NOT executed, run fails
  -> bounded execution   min(5 s, remaining work budget); tool gets {principal, signal} only
  -> result validation   tool's Zod result schema (status/result invariant enforced)
  -> receipt complete    failure => result discarded, run fails
  -> observation         JSON; untrusted content neutralized; runtime-assigned citation keys
```

The data owner is never an argument. `search_personal_memory` reads `context.principal.userId`. No model-controlled value reaches the ownership decision.

## 4. Loop and limits (backend-enforced)

| Limit | Value | Enforcement point |
|---|---|---|
| Model/tool-selection iterations | 3 | `runtime.loop`; iteration 3 is sent with `tool_choice:'none'`, and any calls returned anyway are refused (`ITERATION_LIMIT_EXCEEDED`) |
| Tool executions per request | 5 | `authorizeToolCall` budget, consumed at authorization so failures count |
| Denied calls per request | 10 | `processToolCalls`; prevents receipt-flood DoS |
| Total time | 45 s | work deadline = 43 s for model and tools; audit deadline = 45 s for receipt writes |
| Output tokens per model call | 1,200 | `max_output_tokens` on every request, asserted in tests |
| Tool calls parsed per model turn | 32 | adapter rejects the response as malformed |
| Tools | registry only, read-only | `createToolRegistry` rejects `sideEffects !== 'none'`; lookup is own-property only |

Every await is bounded: the model call, each tool call, and each receipt write. There is no separate backstop timer, which keeps error codes deterministic. An earlier version had one, and the adversarial suite caught it racing the per-call timeout.

## 5. Answer policy (grounding)

Applied in code after the model's final turn. The policy decides whether model prose is shown at all.

| Condition | Answer | `answerSource` |
|---|---|---|
| Model attempted an unregistered tool during the run (taint) | Verified evidence fallback, or abstention | runtime |
| Evidence exists, every cited key is valid, at least one is cited | Model text; `sources` = cited ledger items | model |
| Evidence exists, but a citation is fabricated or missing | Verified evidence fallback | runtime |
| A tool was attempted and no evidence came back | Fixed abstention text | runtime |
| No tool attempted (general request) | Model text, `sources: []`, `grounding:'not_required'` | model |
| Any receipt failure | No answer, no sources, HTTP 503 | n/a |

The client receives `sources` only from the runtime ledger, never parsed out of model text. Stored content is neutralized before the model sees it: `[E1]` becomes `(E1)`. This stops an imported document from spoofing a valid citation, or forcing a rejection, when a model quotes it. The adversarial evaluation found this vector.

## 6. Receipts (D1)

Two tables, created by migration `drizzle/0001_agent_receipts.sql`:

- `agent_execution_receipts`: one row per tool-call attempt, whether allowed, denied, failed, or timed out. Columns: execution_id, request_id, user_id, call_index (unique per request), tool_id (registered name or `unregistered`), authorization, status, started_at, completed_at, duration_ms, error_code (allow-listed), source_ids (pattern-validated opaque IDs, at most 20).
- `agent_runs`: one row per Live AI request, so runs without tool calls are also auditable. Holds status, answer source, iterations, executions, token usage, timings, and error code.

Never stored: prompts, arguments, queries, memory or document text, model output, raw exception messages, credentials.

Fail-closed rules: `started → final` is a guarded single transition, so a receipt cannot be completed twice. A run record must exist before any model call. A failure to write the final run record turns a successful run into a failed one.

Account erasure (`action: 'erase'`) now also deletes the user's receipts and run records. This is a deliberate privacy-over-audit trade-off, consistent with the existing deletion of `twin_ai_requests`.

## 7. Threat model coverage

| Threat | Control | Test |
|---|---|---|
| Model passes `userId` / changes owner | Strict Zod schema; owner comes from the principal | security 3b, eval `inject-*` |
| Cross-user read | Reader keyed by `principal.userId`; isolation measured on model-visible and client-visible data | security 3, 14; eval `cross-*` |
| Unknown / prototype-named tool | Own-property registry lookup; deny-by-default | security 4 |
| Injection in documents | Content is labelled untrusted, citation syntax neutralized, read-only registry, taint rule | security 6, 6b; eval `inject-*` |
| Fabricated tool results or citations | Ledger-only sources; model-emitted `function_call_output` items ignored | security 7, 7b; runtime parsing test |
| Provider or tool hang | `runBounded` race; cannot be defeated by ignoring the AbortSignal | security 9, 9b, 10, 16d |
| Duplicate or concurrent requests | Single-statement conditional INSERT admission | security 13, 14 |
| Receipt store outage | Write-ahead and bounded writes; fail closed | security 16, 16b, 16c, 16d |
| Secret leakage | Key held only in the adapter closure; error codes allow-listed; provider bodies discarded | runtime adapter test; security 17, 17b, 18 |

## 8. Residual risks (not mitigated in P0-002)

1. **Identity trust (P0-001).** See §0. This is the blocker for any non-Sites deployment.
2. **Uncited prose on general requests.** If the model calls no tool, nothing it says is verified. It holds no personal data in that case (none is preloaded anymore), so any personal claim is invented. Mitigated in the UI: `replyLabel()` in `lib/twin/core.ts` labels such replies "AI answer · not checked against your saved information". A missing or unknown grounding value falls back to that same label. This is disclosure, not prevention.
3. **False action claims without a tool attempt.** The taint rule only covers claims that follow an unregistered-tool attempt.
4. **Semantic faithfulness.** A valid citation does not prove the sentence attached to it is accurate.
5. **Lexical retrieval quality.** The existing retriever does no stemming ("writing" does not match "write"). One of the 110 evaluation scenarios fails for this reason, and the runtime correctly abstains. This is P0-003 territory: retrieval quality, not runtime safety.
6. **Rate-limit atomicity on real D1** depends on single-statement atomicity. Tests run on SQLite (`node:sqlite`), not D1.
7. **No provider-side spend cap** is configured from code. A cost estimate needs real `usage` data and a price table; neither is available.
8. **Reasoning-model quality.** Reasoning items are not replayed (§1).

## 9. Behavioural changes versus the previous Live AI path

- The model previously received up to 50 confirmed memories, 20 open tasks, and 5 passages in every prompt. It now receives only the user message; personal data arrives only through tool observations (at most 25 passages per request). This is data minimization. One regression: open tasks are no longer visible to Live AI. The Settings consent copy and the README were corrected to match.
- Admission used to be SELECT-then-INSERT. A concurrent duplicate `requestId` returned HTTP 500 (primary-key violation), and concurrent requests could exceed the per-minute limit. It is now atomic and returns 409 or 429.
- The response is a strict superset of the old shape: `text`, `mode`, `sources[{label, excerpt}]`, plus `sources[].sourceId|kind|createdAt|citation` and `execution`.
