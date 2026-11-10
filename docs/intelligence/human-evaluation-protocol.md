# Personal workflow evaluation — awaiting participants

The synthetic checklist benchmark measures preparation operations only. It does not establish the requested ≥25% reduction in real manual workflow steps. No participant data or results exist yet.

Use a consented within-participant crossover pilot: at least 10 participants, two repeatable workflows each, with matched baseline and approved-procedure conditions. Counterbalance condition order and separate training examples from scored work. This is an exploratory alpha study; the chosen sample size is not a power analysis or a claim of population-level benefit.

Before testing, freeze workflow descriptions, success criteria, required safety/review steps, scoring rules and the app commit. Example workflows are preparing a pitch-deck follow-up draft and checking a project-status summary; neither sends a message. Use synthetic or participant-approved data, and allow withdrawal/erasure. Do not include private text in published results.

For each participant/workflow pair, count all observable manual steps, including capture/setup, corrections, approval and final review. Separately report first-use and repeat-use cost. Record task-completion success, elapsed time, errors, unapproved actions, and whether required review steps were preserved. A blinded evaluator should judge output quality against the frozen criteria where feasible. User attestations alone must not become verified external actions.

Record pseudonymous participant ID, workflow ID, condition/order, baseline/manual steps, assisted/manual steps, setup steps, elapsed seconds, completion success, quality score and deviation reasons. No fabricated rows or empty-row averages. Do not discard failures or slower assisted attempts. Keep raw observations securely outside the public repository; publish aggregate denominators and exclusions.

Compute each paired reduction as `(baseline - assisted) / baseline`, with baseline greater than zero. Report the distribution, paired mean/median, uncertainty, completion rates and errors, not only the best case. The ≥25% target is reached in this pilot only if the preregistered aggregate reaches it without lower completion quality, omitted reviews or unauthorized actions. Any broader commercial claim needs independent replication and an appropriately powered study.

Current status: **unmeasured**. The protocol removes ambiguity about what to collect; it does not clear the empirical acceptance gate.

## Collection and offline instrumentation (2026-11-09)

Recruit 10–20 consenting founders or independent professionals; no recruitment messages have been sent. Collect one JSON observation per pseudonymous participant/workflow pair, using the strict schema in `prototypes/twin/scripts/score-private-alpha.mjs`. Include consent, baseline/assisted steps and seconds, setup steps, both completion outcomes, preserved review, unauthorized actions, expected/correctly captured/missed commitments, corrections, week-two return, and willingness to pay. Setup must include capture, correction and approval overhead; first-use and repeat-use should be separate preregistered workflows.

Run `node scripts/score-private-alpha.mjs /private/path/observations.json` from the Twin directory. The scorer rejects missing consent, duplicate pairs, negative counts and impossible capture counts. It reports denominators and includes setup in step reduction; no participants means no score. Its exploratory target flag is not evidence of causality, quality parity beyond measured completion/review, or population-level demand. Retain all attempts and separately calculate the preregistered uncertainty interval and blinded quality assessment before claiming improvement. Store observations outside this public repository with an agreed deletion period (recommended 30 days after participant review); withdrawal removes observations and requires recomputation. No actual participant records were collected.
