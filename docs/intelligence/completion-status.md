# P0-003 implementation and acceptance status — 8 November 2026

The persistent intelligence layer and model-directed read-only runtime are implemented on the P0-001 security branch foundation. **Full P0-003 acceptance remains blocked by real-model validation on this secured branch, hosted identity validation and real-user productivity measurement.** Code completion is not production verification.

## What this delivery adds

- Adapted the Chat Completions adapter from P0-002 `a522a04` to the registered P0-003 model/principal contracts. No upstream identity, database or receipt implementation was merged over the secured implementation.
- Connected model mode to `POST /api/agent` and the existing Live AI chat flow. The UI layout is preserved; consent text identifies the configured inference provider. The original OpenAI chat path remains available when the separate agent endpoint is not configured.
- Server-only endpoint/model/optional credential configuration. HTTPS or loopback HTTP only; credentials in URLs are rejected. Redirects are returned manually and rejected on status, so credentials and personal context are never automatically forwarded to another destination.
- Bounded streamed response reads, strict tool-call validation, current-context/consent checks, owner-scoped tools and generation-bound D1 receipts. No external-action or write tools were added.
- Personal model answers require retrieved evidence. A model that supplies unsupported personal prose without using a tool produces runtime abstention. Citation validation establishes attribution to retrieved text, not entailment or truth of every generated sentence.
- A real-model smoke runner using synthetic accounts and the actual JWT adapter, routes, runtime and D1 SQL. Missing configuration exits **2 (blocked)**; a failing run exits 1. It does not label fake provider responses as live-model evidence.

D1 migrations remain 0000 → 0001 → 0002. No further schema change, dependency or memory server is introduced. Prior graph, confirmation, correction, commitment, learning, forgetting and isolation tests remain in the regression suite.

## Verification

| Check                                                | Result                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline before this delivery                        | 105 tests passing at `05f4924`.                                                                                                                              |
| Final `npm test`                                     | **110 passed, 0 failed, 0 skipped**, including 23 agent integration tests and actual workerd/D1 model-transport execution with controlled responses.         |
| `npm run typecheck`, `npm run lint`, `npm run build` | All exit 0.                                                                                                                                                  |
| `npm run test:built`                                 | **1 passed** against the built Worker, all four APIs fail closed without configured identity.                                                                |
| `npm run eval:intelligence`                          | 200/200 unchanged synthetic cases passed; see updated benchmark JSON/report.                                                                                 |
| `npm run test:live-agent`                            | Exit 2: missing `TWIN_AGENT_ENDPOINT` and `TWIN_AGENT_MODEL`. No local model binary/weights found; loopback port 8080 was not serving an inference endpoint. |

New controlled-response integration tests cover the real JWT HTTP route, existing chat route, actual workerd/D1 execution, persisted receipts, consent denial/revocation, request-selected destination rejection, unsupported personal claims, malformed responses, streamed size limits and redirect rejection. Their model responses are fixtures, not real inference.

Failures found and fixed during this delivery: an initial missing argument left the evidence-required option unenforced; its regression now requires abstention. A test initially inspected the wrong observation field and was corrected to the actual `content` contract. The first Worker model test failed because workerd does not implement Fetch `redirect: error`; a minimal runtime reproduction confirmed this. The adapter now uses `manual` and rejects non-success status, with a dedicated no-follow redirect regression. Adding a consent update advanced the Worker fixture account version; the concurrent-write test now reads the current version before submitting both competing writes and still requires exactly one success and one conflict. No security assertion was removed to pass these checks.

## Actual upstream evidence and limits

Upstream `7917fb8` records three Qwen2.5-7B recall smoke cases, 3/3 passed, approximately 16–21 seconds each. The latest inspected upstream branch still contains only those three live cases. Its announced 90-case run is not a committed result. Those measurements used P0-002's original runtime; they are not evidence that this branch's secured integration has completed a live-model run.

The 200-case P0-003 evaluation remains synthetic and same-author held-out. Baseline and new retrieval both achieve 100% Recall@5; MRR is 0.750 versus 1.000. This does not demonstrate broader semantic understanding. The 66.7% checklist preparation proxy is not measured human workflow improvement. Optional semantic retrieval remains deferred and is not needed to operate lexical/structured memory.

## Exact remaining prerequisites

1. **Real inference:** a reachable, authorized Chat Completions server and model ID, then `npm run test:live-agent` and a broader adverse-case model evaluation. Local Qwen/llama.cpp does not require an OpenAI API key. A Cloudflare-hosted Worker cannot reach a laptop using the Worker's loopback address. No local model weights or server were available in this environment.
2. **Hosted identity:** staging Worker/D1/Access access, exact issuer/audience, signed assertion forwarding, two isolated logins and operator-verified legacy links. Execute [staging validation](staging-validation.md). Existing private Sites deployment and production identity settings remain unchanged.
3. **Human outcomes:** run the [human evaluation protocol](human-evaluation-protocol.md). The ≥25% real manual-workflow reduction target is not yet established.
4. **Review/deployment:** PR remains open and unmerged. Explicit authorization is required before a public deployment or production identity change.

Recommendation: proceed with PR review and restricted staging/model validation. P0-003 is an implemented, locally tested alpha candidate; do not mark all acceptance gates complete or market it as production-verified.
