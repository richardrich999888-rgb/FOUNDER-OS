# P0-004 release-readiness report — 9 November 2026

**Recommendation: proceed to independent review and an explicitly approved synthetic staging evaluation. Do not launch a hosted private alpha yet.** Local automated assurance checks pass. Hosted Access/D1 validation, browser review and broader model acceptance remain separate gates.

## Source and repository audit

Repository: `richardrich999888-rgb/FOUNDER-OS`; application: `prototypes/twin`.

| Item | Inspected source / result |
|---|---|
| P0-001, draft PR #1 | `security/jarvis-p0-001-verified-identity`, `cf0691e0786acd399d7ec12d6f071409caf5713c` |
| P0-002, draft PR #2 | `claude/tender-bohr-5mk04u`, `436a4037b8490be50a2e7a6e3176b9de5c87c594`; competing migration lineage, not merged |
| P0-003 integration, draft PR #3 | `feature/jarvis-p0-003-persistent-intelligence`, `54c716487d0a326ae5bb87588e0d6a8f1aae6e4e`; verified descendant of P0-001; existing executor contracts already ported |
| P0-003 remediation, PR #4 | Initially inspected `83c88e471dbb840b993c15054b5d3990b262d600`; incorporated the newer `734b2ce4f153ef46411b50e2ce5852716d4b8b93` after it appeared during delivery |
| P0-004 branch | `feature/jarvis-p0-004-personal-agency-assurance` |
| Final implementation under test | `9cc6c2682d05ac14c06983c245c89aa00a629957`; subsequent delivery changes contain documentation/evidence only |
| PR target | `feature/jarvis-p0-003-persistent-intelligence`; the PR includes the inspected PR #4 ancestry and does not merge it into the target |
| Independent review / CI | PR #3 and #4 returned no submitted reviews. Upstream commit-status and PR-workflow queries returned empty lists. No independent approval or remote CI success is claimed. |

The audit fetched remote branches and examined PR relationships, commits, migration history, the bounded executor, identity verification, consent, memory gates and receipts. “Inspected” here means code reviewed during this engineering task, not independently approved by a GitHub reviewer.

Before changing P0-003, reproduced **110/110 tests, typecheck, lint, build, built-Worker check and 200/200 synthetic scenarios** at `54c7164`. The final branch preserves the latest continuation's optional semantic retrieval; it does not rebuild the memory engine or apply PR #2's incompatible migration.

## Implemented architecture

The existing identity adapter admits a signed account. A user-created immutable workflow links confirmed memory, goals/projects, tasks and dependencies. Explicit review/approval binds the current generation, context epoch, plan hash and expiry. A D1 compare-and-swap admits one bounded read execution. Existing tool authorization and receipts remain authoritative inputs. A reconciler compares authorization, run, receipts, outcome and state history before accepting completion.

- Durable states: `PROPOSED`, `AWAITING_APPROVAL`, `AUTHORIZED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `UNKNOWN`, plus explicit expiry, partial-execution, supersession and reconciliation reason codes.
- Immutable checkpoints, a five-minute maximum approval, propagated execution deadline, three-attempt ceiling, explicit cancellation and fresh approval on recovery. Changed consent/context invalidates in-flight authority; account erasure cascades artifacts and changes generation.
- Deterministic priorities use explicit user priority, project importance, confirmed deadline, status and dependencies. Every recommendation has source references and reasons. Users can override priority/importance.
- The Activity tab contains a Trust Center with priorities, proposals, approvals, history, evidence, unresolved work and resume/cancel controls. The UI proposes local context reads. The API also permits the existing model-directed read tools with consent.
- Completion means **the bounded context read**, not completion of the user's broader goal. Model prose cannot mark a workflow complete and is not returned as a claimed action result. No email, scheduling, payment, background monitoring or delegation capability was added.
- Migration `0003_personal_agency_assurance.sql`, corresponding Drizzle schema/snapshot, guarded transitions, workflow authorizations, events, outcome manifests and priority overrides extend P0-003's schema.

Details: [execution and recovery](execution-and-recovery.md), [security findings](security-findings.md), [research](p0-004-research.md).

## Protocol and dependency decisions

Reused the existing TypeScript, Zod, jose, Web Crypto, Workers/D1 and executor. **No new runtime dependency or observability server.** Implemented a small W3C Trace Context/OTLP HTTP JSON subset, closed GenAI attribute allowlist, optional feature-detected native Worker spans and optional HTTPS export. Diagnostic traces remain separate from receipts; export is disabled by default. OpenTelemetry JS, OpenInference, Phoenix, Langfuse and Jaeger were researched with licensing/runtime decisions recorded in the research document.

## Observed final automated verification

| Check | Observed result | Evidence limit |
|---|---|---|
| Complete application suite | **159 passed, 0 failed, 0 skipped** | Includes all inherited security/memory/semantic tests and the new assurance/migration tests |
| Dedicated assurance scenarios | **28/28 passed** | Deterministic synthetic model/fault fixtures; genuine inference measured separately |
| Reusable local staging harness | **106 passed, 0 failed, 0 skipped** | Reuses existing tests; overlaps the complete suite |
| TypeScript / lint | Passed; no lint warnings | Static checks |
| Production build | Passed | No deployment; existing framework route-classification informational warning retained |
| Built Worker | 1/1 passed; five private APIs checked | Missing/spoofed identity configuration fails closed; not hosted Access |
| D1 migrations | 3/3 passed | Ordered preservation, competing/out-of-order ledger refusal, rollback; local workerd separately executes all migrations |
| Schema generation | No schema changes | Checked against a scratch copy; no hosted migration applied |
| Original frozen intelligence evaluation | **200/200 passed** | Narrow synthetic baseline, no model calls |
| Separate default lexical challenge | 13/13 safety gates; **16/24 Recall@5 (66.7%)** | Semantic quality target remains unmet in default lexical mode; command exit 0 is not quality acceptance |
| Hosted runner without configuration | **BLOCKED, exit 2** | Zero hosted checks performed |

Machine evidence: [command ledger](evidence/verification.json), [28 scenarios](evidence/deterministic-e2e.json), [local staging](evidence/local-staging-security.json), [blocked hosted run](evidence/hosted-staging.json). Counts overlap; do not add them together.

## Required A–J workflows

| Scenario | Observed local outcome |
|---|---|
| A — personal continuity | Approved checkpoint survives reload; bounded read completes with evidence; no sending claim |
| B — commitment priority | Confirmed goal/project/commitment and deadline produce sourced reasons; user override changes ranking |
| C — false completion | Client completion command and forged model action claim rejected/discarded; SQL completion requires evidence |
| D — consent revocation | In-flight authority invalidates; late tool execution and stale result release stop |
| E — database failure | Receipt/outcome/history faults cannot create a completed outcome |
| F — memory correction | Current value used; old authorization invalidates and superseded value is not resurrected |
| G — cross-user isolation | Second verified account cannot read, mutate or resume the workflow |
| H — receipt reconciliation | Missing evidence gives `CANNOT_PROVE`; contradictory retained evidence gives `DIVERGENT` |
| I — observability privacy | Canary content/account/secret fields absent from diagnostic serialization; baggage and unsafe attributes excluded |
| J — recovery | Expired read lease returns to approval and resumes without duplicate transitions; actual Worker isolate replacement retains D1 checkpoint |

All ten defined scenario groups passed. Critical fixtures observed zero false completion, cross-account disclosure, unauthorized tool execution, cancelled-workflow resume and duplicate read execution. Reconciliation fixtures produced their expected outcomes. These are finite assertions, not population reliability estimates. Consequential external actions are unsupported, so no real external-effect duplication rate was measured.

## Genuine inference, timing and cost

The final implementation made a genuine local Qwen3-1.7B-Q8_0 call through the secured workflow runtime: **one model call, one authorized read, COMPLETED, VERIFIED**, 31,632 ms, 868 input tokens and 24 output tokens. No fixture response or model fallback replaced inference. The server was loopback-only, used an ephemeral credential, and was stopped afterward. Embeddings were disabled for this P0-004 smoke test.

[Final live result](evidence/real-model-final.json) and [model provenance](evidence/model-provenance.json) retain source revision, verified model hash and runtime settings. An earlier pre-integration smoke took 35,761 ms and is preserved separately. This single final smoke does not establish broad model readiness.

Local Node/SQLite benchmark, 20 alternating samples per diagnostic mode, approved read execution plus reconciliation:

| Measurement | Diagnostics off | Diagnostics on |
|---|---:|---:|
| Median | 9.10 ms | 9.86 ms |
| p95 | 39.49 ms | 57.59 ms |
| SQL statements per execution | 87 | 87 |

Observed median difference: **+0.76 ms**, with substantial shared-host noise. JWT verification/setup and network export are excluded; this is not a hosted SLO or CPU-budget proof. The bounded-read optimization removes a needless second planner/model turn, reducing measured statements from the earlier 95 to 87. Earlier measurements, including a noisy negative median difference, are retained instead of selecting only favorable samples. D1 batch requests can contain multiple statements; statement counts must not be confused with billed rows or per-invocation API request counts.

No paid inference provider requests were made. Hosted bills, hardware operating costs and monetary model costs were not measured; cost fields remain `null`. See [final benchmark](evidence/benchmark-final.json).

## Remaining prerequisites and readiness levels

| Level | Assessment / next gate |
|---|---|
| Local assurance core | Automated state-machine, continuity, reconciliation, telemetry, migration and recovery checks pass |
| Trust Center interaction | Implemented and compiled; authenticated browser, visual/accessibility and usability review not executed |
| Hosted security | Blocked: authorized synthetic staging Worker/D1, approved deployment/migration, exact Access issuer/audience, valid/invalid signed test assertions, two isolated empty accounts, refreshed sessions, synthetic legacy mapping and scoped D1 query credential |
| Hosted operations | Full ingress inventory, session revocation behavior, log privacy, runtime quotas/latency, in-flight fault injection and backup erasure/restore reconciliation still need evidence |
| Real-model readiness | Genuine bounded-read smoke demonstrated; broader adversarial model reliability and semantic entailment remain open |
| Optional semantic retrieval | Inherited continuation reports improved recall but a negative false positive and one model timeout; those reports are retained, not promoted to full acceptance or reproduced as hosted results here |
| Production | Not ready: independent review, operational controls and explicit release approval remain required |

The inspected P0-003 continuation reports 23/24 optional semantic challenge recall, 11/12 negative abstentions and 5/6 real-model adversarial cases. Its default lexical mode remains at 66.7%, reproduced here. Do not conflate those distinct experiments or claim a universal retrieval/model pass.

## Reproduction and delivery

From `prototypes/twin`:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:built
npm run test:staging -- --local
npm run test:staging -- --hosted  # deliberately exits 2 until prerequisites are supplied
```

The [staging runbook](staging-security-runbook.md) contains installation requirements, exact environment names, synthetic fixture rules, executable model/benchmark commands, ordered migrations and rollback instructions. It does not deploy or change identity settings. Keep the P0-002 competing migration out of the P0-003/P0-004 sequence.

The review loop covered baseline reproduction, state/authority implementation, fault tests, runtime/UI integration, query/model-call optimization, latest-upstream integration, and a reproduced reconciliation classification regression. A missing test-harness alias after schema export caused an intermediate module-load failure; it was repaired and the full suite rerun. Earlier failures and source evidence were retained. No tests were weakened, skipped or relabeled as hosted success.

No production identity settings changed. No hosted deployment or migration was performed. No pull request was merged.
