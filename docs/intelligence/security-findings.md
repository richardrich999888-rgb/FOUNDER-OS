# P0-003 security findings and verification scope

The authenticated account owner is the sole authority. Documents, extraction JSON, prompts, source labels and proposed procedures are untrusted data. All new writes are direct reviewed user operations; no model receives a write/permission tool. Existing P0-001 JWT signature/issuer/audience/algorithm/expiry controls remain intact.

## Fixed in this branch

| Finding / attack precondition                                                                     | Severity and invariant                                               | Boundary changed                                                                                                                                               | Verification                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| An in-flight request survives account erasure/reinitialization and meets a reset version          | High: old work must not mutate a new account generation              | Random generation on accounts; generation-qualified legacy writes, graph CAS, receipt FKs; atomic account/AI-ledger erase and conditional AI-request admission | `account erase/recreate…`, `in-flight AI accounting…`, actual workerd erase/isolation tests                                  |
| Legacy memory/document edits leave imported derived facts active                                  | High: deleted/corrected evidence must invalidate all representations | SQL trigger scrubs affected legacy sources and dependency descendants in the same transaction; graph epoch changes                                             | Legacy correction/import/forget regression; D1 migration and atomic rollback tests                                           |
| Generated procedure text survives forgetting its learned basis                                    | High retention/privacy defect in the initial P0-003 candidate        | Dependencies now attach to the generated source as well as the procedure; forgetting scrubs both                                                               | Independent review and failing reproducer, then passing `forgetting learned-procedure evidence scrubs generated sources too` |
| Consent/source state changes after context assembly                                               | High: stale context cannot become lasting authority                  | Read-only grants bind current Identity, consent, generation and expiry; final receipt and context-envelope rechecks                                            | Consent revoke, stale context, copied grants, scope escalation and all five tool tests                                       |
| Proposed legacy imports suppress existing confirmed memory; unrelated document passages disappear | Medium compatibility regression in initial candidate                 | Preserve legacy context until review; suppress only covered lines after review                                                                                 | Failing reproducer then passing legacy import + remaining document passage regression                                        |
| 501–4,000 character chat queries are newly rejected by 500-character structured query schema      | Medium compatibility regression in initial candidate                 | Preserve original accepted chat range with the original keyword path for long queries                                                                          | Failing reproducer then passing long-query control                                                                           |
| A mutation crosses 8,000 dependency rows, then all subsequent reads fail                          | Medium authenticated availability issue in initial candidate         | Check prospective unique dependency count before writing; existing forget remains usable at capacity                                                           | Real schema filled to 8,000 edges; rejection leaves epoch/data unchanged and forget succeeds                                 |
| Database fails part-way through a graph mutation                                                  | High integrity issue if changes commit partially                     | One guarded D1 batch; no partial application or fabricated success                                                                                             | Node failure injection plus real workerd SQLite trigger failure and unchanged epoch                                          |
| Sensitive memory/token/request text enters logs or retained tool receipt payloads                 | High if disclosed                                                    | Closed audit schema; receipts omit arguments and content; generic client errors                                                                                | Audit capture with synthetic markers; receipt schema and P0-001 log tests                                                    |

The source-scrub, long-query and import regressions were reproduced before remediation; assertions were retained. The capacity failure was independently identified by source analysis and its fix is verified against a full 8,000-edge fixture. No assertions were removed or relaxed.

## Adversarial coverage

| Required case                            | Executable evidence                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cross-user access/writes/deletion        | P0-001 security tests, `G`, isolation benchmark and workerd HTTP test                                                         |
| Forged identity/header/token             | Original real-JWT adapter tests; new intelligence route uses the same adapter; actual Worker anonymous/header spoof rejection |
| Unauthorized writes / owner injection    | Strict command/query schemas and registered principal tests                                                                   |
| Prompt injection / permission escalation | Untrusted content remains proposed; JSON permission fields and tool names rejected; no executable document instructions       |
| Memory poisoning / false provenance      | Missing exact source span, fabricated JSON fields and unsafe status rejected; user confirmation still required                |
| Deleted-memory resurrection              | Source/descendant scrubbing, generated source regression, legacy trigger, stale context and account-generation tests          |
| Contradictions                           | Explicit approval of all conflicting same-property facts; old fact excluded until/after approved replacement as appropriate   |
| Invalid deadlines                        | Impossible date rejection, unresolved relative date, explicit timezone validation                                             |
| Concurrent updates                       | Node and workerd concurrent requests: one commit, one conflict                                                                |
| Sensitive information leakage            | Restricted-source retrieval excluded; bounded output; fixed-schema log capture                                                |
| Unauthorized procedure activation        | Proposed procedure activation fails; confirmation plus separate activation required                                           |
| Malformed model response                 | Invalid JSON, unknown fields, false span and unsafe status tests; no provider is called                                       |
| Partial database failure                 | Atomic rollback and receipt-write fail-closed tests                                                                           |

A prompt instruction can be stored as a quoted fact after user review; this does not confer authority. The model is not trusted to enforce permissions. Provider output content safety and the accuracy of user-attested claims are not proved by these tests.

## P0-002 integration blockers (not patched in its branch)

At inspected `697d407` and subsequent `a90b174`, the runtime principal is a TypeScript brand constructed from `{userId}` and a consent snapshot, not a P0-001 registered/expiring Identity. Its source branch predates P0-001; raw-string corpus reads and owner/ID assumptions differ. Consent can change during a model wait; ledger/receipt and deletion lifecycles lack the new generation boundary. The P0-002 baseline also had one deadline error-classification test failure and one live-provider skip. None of those are relabelled as passes here.

Integrate only after preserving P0-001 modules, reconciling both 0001 migrations, retaining verified-principal provenance/expiry, generation-bound current consent and transactional receipt/account deletion, and validating an actual run. This branch's receipt proves a standalone read-only adapter invocation only.

## Remaining limits

- Provider-hosted identity configuration, real account mapping and direct deployed Worker access are unverified. Local workerd is not production verification.
- Sources and IDs are account-scoped, but storage encryption/key management and backup/restore policy remain hosting responsibilities. Deletion cannot retract prior provider disclosures, browser copies or user exports.
- All reads hydrate a bounded account graph. Caps limit private-alpha size; tombstone compaction needs a deletion-safe design. No claim of large-scale throughput or production latency.
- Restricted-content matching is a conservative heuristic, not a sensitive-data classifier. Users must explicitly restrict sensitive sources.
- Source spans establish attribution, not semantic entailment. Review can still approve a false claim. Contradiction detection is property-key based, not general reasoning.
- Legacy documents remain untrusted quoted data, not automatically confirmed facts. Unrelated legacy lines remain available for compatibility.
- Outcomes are explicitly user-attested; there is no independent proof that an external workflow succeeded. Learned checklists do not execute actions.
- Existing live-AI usage counts are basic limits, not an atomic distributed spend-control system. Require a provider spend cap before enabling broad use.
- No approval-token replay surface was introduced: approvals are same-origin authenticated mutations with current epoch and state checks. Durable cross-session delegated approvals are not implemented.
