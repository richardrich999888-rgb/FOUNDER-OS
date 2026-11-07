# P0-003 benchmark report

Run: 2026-11-07T21:52:41.512Z. Fixture SHA-256: `21760f6a4b0175e9e9fd2c7b9ed517553703912eab97a6e651c38e9d37177424`.

200 synthetic scenarios; 101 development and 99 same-author held-out scenarios. All 200 passed. Fixtures were frozen before first execution, hash-checked on every run, and were not changed to improve scores. The holdout was rerun after security fixes; it is no longer an unseen external validation set.

## Retrieval comparison

80 retrieval queries across one shared corpus of 80 confirmed records (facts, decisions, commitments and people), plus source rows. Each query has one labelled target. All methods receive the same text corpus; structured methods additionally receive explicit query filters supplied in the fixture. This evaluates typed filtering as well as ranking, not autonomous natural-language understanding. The baseline is the unchanged P0-001 `lib/twin/core.ts:retrieve`, projected over that corpus.

| Method                              | Recall@5       | MRR          | Local ranking p50 / p95                     |
| ----------------------------------- | -------------- | ------------ | ------------------------------------------- |
| Existing Twin keyword               | 100.0% (80/80) | 0.750        | 0.432 / 1.053 ms                            |
| Structured D1 snapshot              | 100.0% (80/80) | 1.000        | 0.488 / 1.980 ms                            |
| Evidence-gated lexical + structured | 100.0% (80/80) | 1.000        | 0.394 / 1.348 ms                            |
| Optional semantic embeddings        | Not measured   | Not measured | No authorized Workers AI/Vectorize bindings |

Hybrid including actual owner-scoped SQL hydration: p50 2.368 ms, p95 4.872 ms, n=80. These are Node v24.22.1 in-memory SQLite measurements, not deployed Cloudflare network/CPU latency. Actual workerd/D1 transactional behavior is tested separately.

Baseline Recall@5 also reaches 100%; this corpus demonstrates better ordering (MRR), not an improvement in recall. It is deliberately small and lexical overlap is high. No broad semantic advantage is claimed.

## Other measured outcomes

| Metric                                   | Result      | Scope / denominator                                                                                        |
| ---------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Temporal current-state accuracy          | 100.0%      | 20 approved preference changes                                                                             |
| Commitment extraction precision / recall | 100% / 100% | 20 positives, 20 negatives; 20 predicted commitments                                                       |
| Deadline handling                        | 100%        | Explicit ISO/timezone or unresolved relative text in those 40 extraction cases                             |
| Same-property contradiction detection    | 100%        | 15 preference conflicts                                                                                    |
| Source attribution                       | 100%        | All returned records in 80 retrieval queries have an exact stored source span; not entailment verification |
| Missing-evidence abstention              | 100%        | 10 unrelated out-of-corpus queries                                                                         |
| Deleted facts returned                   | 0           | 15 forget scenarios, plus source/derived deletion regression tests                                         |
| Unauthorized cross-user disclosures      | 0           | 10 isolation scenarios plus adversarial tests                                                              |
| Unauthorized procedure activations       | 0           | 10 procedure scenarios plus grant/activation tests                                                         |
| Checklist steps preserved                | 100%        | 10 repeated workflow templates                                                                             |

The held-out subset has the same 100% supported metrics (40 retrieval, 20 extraction, 10 temporal, 7 conflict, 7 forget, 5 isolation, 5 procedure and 5 abstention cases). These percentages must not be extrapolated to arbitrary messages, languages, adversarial corpora or production users.

## Procedure effectiveness and the acceptance boundary

The scripted checklist-preparation proxy counts six operations before reuse: name the workflow, enter four steps and review. Retrieving an approved checklist and reviewing it counts two: a **66.7% reduction in scripted preparation operations** over 10 cases. The actual four workflow steps are not removed or executed. This is not a measured reduction in human effort or end-to-end completion time. The requested ≥25% real workflow improvement remains **unverified** pending a consented user study and independently observed outcomes.

## Cost and reproducibility

No model or embedding call occurred; paid-provider spend for this local run was $0. Cloudflare billable cost was not measured. The harness counted 4985 SQL statements after corpus setup across all evaluation operations; this is not billable D1 rows-read/written accounting.

Run `npm run eval:intelligence` in `prototypes/twin` to verify the frozen fixture hash and write the JSON results. The script exits nonzero for a failing scenario or supported accuracy target. Raw scenario outcomes, ranks, metrics and measured timings are retained in [benchmark-results.json](benchmark-results.json). Fixture authoring refuses to overwrite the evaluated version.

## Acceptance status

The local synthetic targets for Recall@5 ≥90%, temporal accuracy ≥95%, extraction precision ≥95%, and zero observed critical disclosure/deletion/activation errors pass within this suite. Semantic comparison, independent held-out evaluation, live provider performance, deployed latency/cost and real-user workflow gains remain not measured. P0-003 is a locally verified private-alpha candidate, not a fully validated commercial intelligence engine.
