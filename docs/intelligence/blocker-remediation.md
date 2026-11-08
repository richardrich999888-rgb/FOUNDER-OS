# P0-003 blocker remediation — 2026-11-08

Current update: [model integration and remaining acceptance gates](completion-status.md). The report below records the preceding delivery.

Status: **local runtime integration verified; hosted authentication, live-model orchestration and human productivity validation remain open.** This report supersedes the integration-blocked status at `cad7346`. No production deployment, identity setting, live account data, message recipient or provider billing was changed.

## Blocker disposition

| Blocker                                    | Result and evidence                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-002 cannot safely consume P0-003 memory | Cleared for local execution: selectively integrated the provider-neutral runtime from `a90b17420ec59d494b255f9da01ace7354a1a34c`, retaining P0-001 identity and replacing incompatible principal, admission and persistence contracts.                                                                                 |
| No actual agent execution receipts         | Cleared for deterministic local runs: real JWT adapter → HTTP route → runtime → executor → memory tool → D1 run/execution receipts. All five tools exercised. This is actual local execution, not an LLM/provider run.                                                                                                 |
| Migration numbering conflict               | Cleared: retain 0000/0001, add 0002. Populated upgrade, foreign keys, graph preservation and account-deletion cascades tested in SQLite and workerd. Do not merge/apply P0-002's competing 0001 migration.                                                                                                             |
| Consent/deletion races and delayed writes  | Cleared within tested boundaries: revalidate registered identity, account generation/epoch and provider consent around asynchronous work; guarded SQL admission and receipt writes reject stale generations and expired deadlines.                                                                                     |
| Misleading success after tool failure      | Fixed after reviewer reproduction: timeout returns failed `TOOL_TIMEOUT`; oversized saved procedure returns failed `TOOL_RESULT_TOO_LARGE`, not successful empty recall.                                                                                                                                               |
| Hosted verified identity                   | Blocked: no configured Access issuer/audience, independent staging Worker/D1 access, verified legacy-account mapping or two isolated staging logins. Existing private Sites deployment has no configured environment entries (revision 0). Its documented unsigned headers do not establish the required JWT boundary. |
| Live-provider agent orchestration          | Pending secure credential decision/configuration, adapter wiring and a real consented smoke test. No usable provider key was found. Existing `/api/chat` provider path is unchanged; `/api/agent` uses no provider.                                                                                                    |
| Semantic retrieval comparison              | Optional experiment deferred. No Workers AI/Vectorize test bindings are available. It is not required to run the lexical/structured local alpha.                                                                                                                                                                       |
| ≥25% real workflow improvement             | Unverified: no participant observations. A concrete [study protocol](human-evaluation-protocol.md) is ready; the 66.7% scripted preparation proxy remains a proxy.                                                                                                                                                     |

PR base remains P0-001 `cf0691e0786acd399d7ec12d6f071409caf5713c`. P0-001 and P0-002 upstream draft PRs are not represented as independently approved. The source branches and existing deployment were not overwritten.

## Architecture and authorization

`lib/agent/principal.ts` accepts only a registered, unexpired P0-001 `Identity`; a JSON clone or ordinary `{userId}` cannot become a principal. A server-only binding carries the explicit tool subset, account generation/epoch and local/provider destination. Linked account IDs retain the original Unicode/length contract. Local reads do not require external-sharing consent; provider-destination principals do.

The runtime checks current context before every planner disclosure, after planner/tool waits, and before and after final receipt persistence. A changed account, epoch, expiry or provider consent is terminal: neither model prose nor cached evidence fallback is returned. Already-disclosed data cannot be recalled from a provider; no such disclosure occurs in the shipped local route.

The closed registry contains `search_personal_memory`, `find_commitments`, `get_person_context`, `get_project_context` and `retrieve_procedure`. Strict Zod arguments reject owner/permission injection. Tools cannot write, activate a procedure or send communications. Graph retrieval retains provenance and visibility gates; legacy reads use `compatibleState` so superseded/forgotten imported passages cannot return through the old corpus. Graph citation IDs include record and version; original source IDs are separate provenance. This avoids collapsing two commitments extracted from one source into one citation.

Limits are at most three planner iterations, five tool executions, a 45-second total runtime budget, five evidence items and a 16,000-character serialized tool budget. An individual record above the 4,000-character tool excerpt limit fails explicitly; its full text remains available in the memory API. No procedure is silently truncated into an incomplete checklist. The local route selects exactly one authorized tool. Atomic admission shares the existing 3/minute and 40/day request ledger with chat. The runtime deadline does not include preceding HTTP authentication/admission time.

`0002_verified_agent_runtime.sql` adds `agent_runs` and `agent_execution_receipts`. Generation foreign keys cascade on account erasure. SQL wall-clock predicates also reject late, non-cooperative writes after the deadline; abort signals alone are insufficient for D1. Metadata contains sanitized error/tool/source IDs and timings, not prompts, arguments, credentials or memory text. A persisted completion receipt is evidence of tool execution, not proof that the caller received the answer. A crash/timeout may leave a `running`/`started` row until operational cleanup or account erasure; it is never promoted to success by this patch.

## Local API demonstration

After configuring verified authentication and applying migrations on an authorized local/staging database, submit this JSON with a fresh UUID and the actual signed-in session to `POST /api/agent`:

```json
{
  "requestId": "07f667c4-ce9b-4c1a-a3eb-3d17d1cf2bca",
  "tool": "search_personal_memory",
  "args": { "query": "pitch deck" }
}
```

The request must have a matching Origin. No owner or permissions are accepted. A successful response labels `execution.planner` as `deterministic-local`, includes source citations and execution receipts, and labels the answer as runtime evidence fallback or abstention. Provider usage is null, not invented token counts. Duplicate request UUIDs return 409; quota exhaustion returns 429. Tool failure returns 503 with a sanitized execution error and no answer; changed authority returns 409.

The existing UI and chat route are preserved; the new route is an API integration surface, not a newly added chat interface. `tests/agent-integration.test.mjs` and `tests/worker-security.test.mjs` execute this flow with generated RSA/JWKS credentials and synthetic accounts. They do not bypass the identity adapter.

## Engineering loop and actual verification

1. Rechecked branches and hosted configuration; initial P0-003 suite: **87 passed, 0 failed, 0 skipped**. Reused the P0-002 source inspection rather than merging its weaker identity boundary.
2. Added principal/registry/runtime integration, conditional D1 receipts/admission and migration 0002. Focused runtime tests passed. The first full run failed in workerd because an upstream module-global `AbortController` allocation is disallowed. Moved controller creation inside request execution; real Worker startup passed.
3. Expanded adverse cases for post-receipt changes, consent/deletion during planner waits, account recreation, delayed SQL, concurrency, expiry, Unicode account links, receipt failure and legacy recall. A fresh candidate review reproduced the timeout-success and long-procedure omission bugs. Added regressions and fixed both without relaxing assertions. One initial long-procedure test fixture exceeded the separate 2,000-character quote limit; corrected its exact source-span quote, preserving the long procedure and expected failure contract.
4. Ran complete regression, typecheck, lint, production build, built-bundle security test and the unchanged 200-case evaluation. Review also independently rehearsed a populated migration upgrade and found no additional reproducible ownership/stale-context bypass.

Commands from `prototypes/twin`, Node v24.22.1:

| Command                     | Actual result                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                  | **105 passed, 0 failed, 0 skipped**: original 87 plus 18 agent integration regressions; includes actual workerd/D1 HTTP execution.                       |
| `npm run typecheck`         | Exit 0.                                                                                                                                                  |
| `npm run lint`              | Exit 0.                                                                                                                                                  |
| `npm run build`             | Exit 0; bundle includes all four API routes, including `/api/agent`.                                                                                     |
| `npm run test:built`        | **1 passed**; the unmodified built Worker rejects anonymous/spoofed requests on all four APIs without identity configuration.                            |
| `npm run eval:intelligence` | **200/200**; fixture hash unchanged. Recall@5 100% for all three methods; MRR 0.750 baseline / 1.000 structured and hybrid. No model or embedding calls. |

Temporal accuracy and extraction precision remain 100% only within the narrow synthetic corpus. New runtime overhead is not part of the retrieval benchmark. See [benchmark report](benchmark-report.md) and [JSON evidence](benchmark-results.json) for actual timings, denominators and limits. Diagnostic logs are local ignored `.sites-runtime/clear-*.log` files; no raw credential output is published.

## Files and reused code

- `prototypes/twin/lib/agent/`: selected same-repository P0-002 runtime, authorization, evidence, instructions, registry, deadlines and limits; new principal, receipts, admission, tools, local planner and provider-neutral model port. Its OpenAI adapter is not copied or activated.
- `app/api/agent/route.ts`, intelligence API status, `db/agent-schema.ts`, schema exports and `drizzle/0002*`/metadata.
- Agent integration tests, shared JWT harness, workerd migration/HTTP tests, built-bundle security test and package test command.
- README and intelligence architecture, security, demonstration, benchmark and remediation documents.

No new dependencies or copied cryptography. Existing jose verification, Zod schemas, Drizzle declarations and D1 remain the foundation. The previously researched memory projects remain design references, not additional servers or packages.

## Remaining release prerequisites

[Staging validation](staging-validation.md) names the missing infrastructure and required evidence. Provider setup must use secure secret storage and an authorized spend limit; a credential is not proof that the adapter works. Human evaluation must record real participants and outcomes. No public deployment, live identity change or automatic merge is authorized here.

Recommendation: review this PR, then validate a restricted staging alpha. Local code integration is ready for that next step. Do not declare hosted security, live agent intelligence or real productivity targets passed from local tests.
