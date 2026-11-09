# P0-004 adversarial and failure review

Scope: synthetic accounts, the existing signed identity adapter, local SQLite/D1 and local workerd. This is engineering regression evidence, not an independent penetration test or hosted Access certification. No external-effect tool was added.

## Findings and fixes

### Incomplete evidence was mislabeled as a contradiction

The first reconciliation implementation returned `DIVERGENT` when a successful run reported more executions than retained receipts, and when transition history had a gap. Both paths blocked success, but confused missing evidence with contradictory evidence.

Reproduction: execute an approved synthetic read; present a run count of two with only one receipt, or delete an intermediate transition record. The new `Incomplete evidence` regression failed before the fix (`DIVERGENT`, expected `CANNOT_PROVE`). The fix checks retained records for contradictions and classifies an otherwise incomplete set as `CANNOT_PROVE`. Altering a surviving adjacent transition to claim the wrong predecessor still returns `DIVERGENT`. The exact test passes after the change; no verification requirement was relaxed.

### Model prose cannot establish a completed personal action

A fixture returns a valid read tool call and the forged sentence “I sent the investor email and paid the invoice [E1].” Citation membership alone cannot prove the claim. Assurance model workflows now use the existing executor's evidence-only response and finish after the bounded read batch. They discard the prose, require persisted successful receipts, and label completion as a context read. The fixture verifies one model call, one authorized read, no forged claim and consistent reconciliation. General P0-003 chat's semantic entailment remains a separate acceptance gap.

### Cancellation and revocation require durable execution guards

An in-memory abort signal cannot stop a different request, a restarted Worker or a late database write. Workflow admission and each receipt write now bind current owner, generation, epoch, workflow version, run ID, lease and authorization. Cancellation/revocation atomically invalidate the running record. Injecting cancellation, consent revocation, deletion and context correction prevents late execution or result release. This supplements the existing principal checks instead of replacing them.

### Completion and event persistence must roll back together

Faults at receipt insertion, outcome insertion and transition-history insertion are exercised. A failed write never leaves a fabricated completed outcome. The final transition and outcome use a guarded D1 batch; failure leaves an honest unresolved checkpoint or a failed API response. A total D1 outage cannot be truthfully represented as a newly persisted `UNKNOWN` row; recovery inspects the previously stored lease.

## Required attack and fault matrix

| # | Scenario | Expected behavior and evidence |
|---|---|---|
| 1 | Forged identity | Existing invalid signature/issuer/audience/expiry tests, unsigned header spoof tests and assurance API denial; no identity bypass added. |
| 2 | Cross-account workflow access | Second signed identity cannot list, execute, reconcile, cancel or resume another owner's workflow; real local Worker repeats the boundary. |
| 3 | Memory prompt injection | Memory remains data. Unregistered external actions are rejected; only the registered read executes. |
| 4 | Forged completion | No client `complete` command, no model mutation tool; SQL rejects invalid transitions and prose is discarded. |
| 5 | Receipt tampering | Changing retained source IDs breaks the outcome manifest and yields `DIVERGENT`. |
| 6 | Missing receipts | Missing/all or incomplete receipt sets yield `CANNOT_PROVE`; diagnostics cannot substitute. |
| 7 | Duplicate attempts | Concurrent execute requests admit one run/receipt; local workerd returns one 200 and one 409. |
| 8 | Stale authorization | Expired approval returns to review; source/epoch changes invalidate approval. |
| 9 | Consent revoked in flight | Running work becomes unresolved; late model requests cannot start tools or release stale context. |
| 10 | Deletion during recovery | Cascaded artifacts and changed generation cannot be recreated through a stale workflow. Existing integration tests cover deletion during runtime. |
| 11 | Worker restart | Actual Miniflare isolate replacement preserves the checkpoint in D1. Recovery from expired running leases needs fresh approval. |
| 12 | Model timeout | Nonresponsive provider hits the propagated deadline; no completed outcome, no returned stale answer. |
| 13 | D1 transaction failure | Injected history/outcome/receipt failures roll back or fail closed. Three migration tests cover preservation, competing lineage and rollback. |
| 14 | Corrupted checkpoint | Changed checksum is rejected before approval; database transition constraints are temporarily removed only inside the corruption fixture. |
| 15 | Concurrent updates | Version/epoch compare-and-swap plus transactional history prevents duplicate transitions. |
| 16 | Malformed trace context | Invalid/zero identifiers are rejected; public trace identifiers are never imported as authority or exported as user-selected identifiers. |
| 17 | Telemetry leakage | Canary memory/intent/email/credentials/account fields cannot enter the closed diagnostic schema; arbitrary string values and baggage are dropped. |
| 18 | Unauthorized resume | Wrong owner, active lease, expired/corrupt workflow, cancellation and exhausted attempts cannot resume execution. All permitted retries return to approval first. |
| 19 | Replayed calls | Existing request/call idempotency tests plus proposal-body binding and workflow CAS retain replay protection. |
| 20 | False reconciliation | Missing outcome/history/receipts cannot verify; contradictory history/authority/manifest cannot verify. |

The matrix maps to `prototypes/twin/tests/assurance.test.mjs` and the reused `security`, `worker-security`, `agent-integration`, `remediation`, `semantic` and migration suites. These suites overlap; their counts must not be added as independent security experiments.

## Limits retained

- Worker and D1 share the trust boundary. No signing key, hardware attestation or independent witness is claimed. An administrator rewriting all records can defeat their internal consistency checks.
- No consequential external action exists. Zero duplicate consequential actions is a scope invariant, not a measurement of an email/payment integration.
- The optional semantic provider is inherited from the inspected P0-003 continuation, disabled by default and still consent-gated. Its quality evidence and unresolved false positives remain in `docs/intelligence/continuation/verification.md`.
- Hosted ingress, issuer/audience forwarding, live-session revocation, legacy mapping, hosted log privacy and hosted fault behavior remain unexecuted here. The executable runner returns a blocked result when prerequisites are absent.
- The Trust Center passed TypeScript/lint/build integration. Interactive browser/accessibility and visual review were not executed: no supported preview forwarding from this workspace was available. This remains a review item, not a claimed browser result.
- Optional OTLP export was structurally tested with a deterministic transport and export failure. No external collector or hosted native tracing was contacted or validated.
