# P0-003 acceptance demonstration

Run from `prototypes/twin` on Node 24:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:built
npm run eval:intelligence
```

Tests use generated RSA keys, synthetic Access-shaped JWTs and isolated local D1/SQLite data. The application authentication adapter verifies the signatures; identities are not mocked into the handlers. No real account, provider key or message recipient is used.

| Workflow               | Input and expected result                                                                                                                                                                                                | Executable evidence                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| A. Personal memory     | Capture “I prefer concise answers.” → proposed, absent from recall → confirm → a new authenticated session retrieves it with source UUID/label/quote                                                                     | `A: confirmed memory persists…`                              |
| B. Commitment          | Confirm Person Maya Rao and Project Cedar; capture promise to send pitch deck by `2026-11-12T17:00:00+05:30 [Asia/Kolkata]`, Next: Review deck → confirm → active → query person/project/deadline; draft is `sent:false` | `B: commitments link…`                                       |
| C. Temporal correction | Confirm Monday meeting preference; propose Thursday; confirmation without old fact IDs fails; approve replacement → old superseded, Thursday alone in active context                                                     | `C: conflicts require…`                                      |
| D. Forgetting          | Forget evidence using explicit `FORGET EVIDENCE` → source and descendants scrubbed, active retrieval empty; legacy import also removes its original on explicit forget                                                   | `D`, legacy regression, generated-source deletion regression |
| E. Experience learning | Submit and separately confirm three distinct successful user-attested runs with the same steps → propose checklist → activation denied before confirmation → confirm and activate → retrieve checklist                   | `E`, repeated feedback test and 10 procedure scenarios       |
| F. Agent retrieval     | Real runtime with deterministic local planner → verified principal → authorized tool → D1 receipt. All five tools tested; no live-model run claimed.                                                                     | `tests/agent-integration.test.mjs`, workerd HTTP test        |
| G. Security            | Account B cannot read/forget/activate A's record; forged Identity fails; unsigned spoofed headers fail through direct Worker HTTP; proposed procedure cannot activate                                                    | `G`, original security suite and workerd test                |

For a future authorized staging preview, the Memory screen contains the new review panel below the existing memories. It accepts source-labelled notes, explicit legacy import, contextual facts, commitment transitions and drafts, evidence forgetting, workflow feedback and checklist activation. Existing settings/export/account deletion remain available. Export now includes the intelligence review records. The web UI was compiled and its API behavior tested; no authenticated browser session against a hosted deployment was available.

“Successful workflow” in this demonstration means confirmed user feedback on synthetic steps. It is not a verified email send or external agent execution. The checklist benchmark counts preparation interactions, not end-to-end human productivity. Those acceptance dimensions remain open.

The additional local agent endpoint is `POST /api/agent`; its exact request/response contract is in [blocker remediation](blocker-remediation.md). It preserves the existing UI. The integration tests additionally cover consent/deletion during planner waits, final response validation after receipt persistence, expired/cloned identities, late SQL writes, concurrent quota admission, tool failures and oversized procedures. The live-provider portion of workflow F remains pending secure configuration and wiring.
