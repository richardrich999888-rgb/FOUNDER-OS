# P0-003 continuation: real inference and optional semantic retrieval

Base: `83c88e471dbb840b993c15054b5d3990b262d600`, PR #4 remediation branch. No merge, public deployment, production identity change, migration or live-account access. The prior reports and frozen fixtures remain intact.

## Results, separated by evidence category

| Category | Actual result | Boundary |
|---|---|---|
| Deterministic suite | 125 tests pass; typecheck and lint pass | Synthetic accounts; JWT verification, authorization, transactions and receipts |
| Build/runtime | Production build and built-Worker test pass | Local workerd; not hosted Access or hosted D1 |
| Original frozen evaluation | 200/200 pass | Previous narrow synthetic baseline; unchanged lexical behavior |
| Real generative model smoke | Qwen3-1.7B: 2/2 pass | Cited memory recall and missing-evidence abstention through secured runtime |
| Six real-model adversarial cases | 5/6 pass | Schema-pressure prompt times out safely; not full model acceptance |
| Optional semantic retrieval, previous challenge | 23/24 Recall@5 = 95.8%; MRR .958 | Actual MiniLM inference + controlled planner through actual API/runtime/receipts |
| New frozen semantic holdout | 12/12 positive retrieval; MRR 1.0; 11/12 missing-evidence abstentions | Same author/corpus, new wording; not external validation |
| Combined real model + real embeddings | 2/2 pass | Paraphrase recall with source/receipt; missing passport evidence abstains |
| Hosted staging | Not executed | Authorized staging Worker/D1/Access sessions and deployment permission remain necessary |
| Human productivity | Unmeasured | Existing 10–20-participant protocol/scorer; no participants recruited |

`qwen17-smoke.json`, `qwen17-challenge.json`, `semantic-results.json`, `live-semantic.json`, and `baseline-rerun.json` contain the actual measurements. The original challenge remains 66.7% under default lexical retrieval; **95.8% requires explicitly configured semantic retrieval**. No default silently changed.

The semantic benchmark's planner is controlled and deliberately falls back to retrieved passages. Its embeddings, JWT adapter, account-scoped database calls, tool authorization and persisted receipts are real. It is not counted as genuine generative-model inference. Conversely, `live-semantic.json` uses genuine responses from both inference servers without substitutions.

## What changed

- Added optional `lib/intelligence/embeddings.ts`: bounded HTTP embedding port, response/index/dimension validation and cosine ranking of eligible graph records.
- Added optional semantic scores to hybrid retrieval, after existing owner, generation, confirmation, temporal and provenance checks. Structured constraints still apply. Scoring cannot authorize a record.
- Wired the optional provider into model-mode read-only tools. Consent, generation and epoch are checked before inference and again afterward. A local-only principal cannot invoke embeddings. Remote embedding origin must match the configured generative provider; loopback experiments can use a separate local port.
- No persistent embedding/index/cache is created. D1 remains authoritative. Deletion and consent races invalidate the run rather than release stale context. Legacy memory retains its existing lexical compatibility path.
- Clarified the model's existing citation instructions. No output checks, deadlines, argument schemas or smoke assertions were relaxed.
- Added synthetic semantic security tests, real combined-inference runner, frozen holdout, calibration/evaluation scripts and an isolated CPU embedding server. Python packages are experiment-only, not Worker dependencies.

The optional path is bounded to 64 eligible graph records, 65 input texts including the query, 4,000 characters per text, 64,000 aggregate input characters, 1 MB response and 2,048 dimensions. Capacity overflow fails explicitly. It does not silently pretend to search a larger corpus. This on-demand experiment is unsuitable as a large-account index; benchmark and design a consented incremental index before scaling.

## Model selection and genuine failures

The minimal 0.6B diagnostic produced a tool call, but its full secured smoke still timed out even with reasoning budget zero. `qwen06-zero-budget.json` retains the failure. The larger Qwen3-1.7B download was resumed and its complete published SHA-256 verified:

- Official source: https://huggingface.co/Qwen/Qwen3-1.7B-GGUF
- Revision `90862c4b9d2787eaed51d12237eafdfe7c5f6077`
- `Qwen3-1.7B-Q8_0.gguf`, 1,834,426,016 bytes
- SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`
- Apache-2.0; pinned llama.cpp b11880/MIT from the preceding report.

Before clarifying citation instructions, 1.7B performed the read but omitted a citation: `qwen17-before-prompt.json`. Afterward, unchanged smoke assertions pass. Recall took about 37.9 seconds and missing-evidence abstention 7.7 seconds on this shared Linux CPU host. Combined semantic recall took about 28.6 seconds, abstention 7.0 seconds. These are small-sample observations under variable host load, not production latency guarantees or Mac benchmarks.

The six-case challenge includes recall, commitment recall, missing evidence, document injection, unauthorized-action request and schema pressure. Commitment recall used safe evidence fallback when the model omitted a citation. The schema-pressure case returned `MODEL_TIMEOUT` with no memory sources. Do not reinterpret 5/6 as a passing complete adversarial evaluation. Citation membership does not prove semantic entailment of arbitrary prose; unsupported-answer rate across general conversations remains unmeasured.

## Embedding experiment and calibration

Official model: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 (Apache-2.0), revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`. Official model-card attention-mask mean pooling and L2 normalization are used, with truncation to 256 tokens.

- ONNX model: 90,405,214 bytes, published SHA-256 `6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452`.
- Tokenizer SHA-256 measured from the pinned revision: `be50c3628f2bf5bb5e3a7f17b1f74611b2561a3a27eeab05e5aa30f411572037`.
- ONNX Runtime (MIT) 1.31.1, tokenizers (Apache-2.0) 0.23.3, numpy (BSD-3-Clause) 2.5.4; experiment requirements pin these top-level packages, not all transitive artifacts.

The first preset threshold `.45` achieved 79.2% positive recall and abstained on all 12 calibration negatives; retained in `embedding-preset-threshold.json`. The calibration rule then used only negative similarities: `ceil((max_negative + .05)*100)/100`, yielding `.31`. Positive targets were not used in that formula. A new holdout was frozen before evaluating the calibrated path. Threshold calibration on twelve negatives is weak evidence and must be repeated on realistic, independently authored data before deployment.

The calibrated original-challenge miss is “Where is my investor presentation?” The new negative “What is my favourite dessert?” returns an irrelevant memory. That is a retrieval false positive, not a demonstrated fabricated personal claim; the controlled planner presented evidence rather than generating an answer. Do not claim perfect abstention, semantic entailment or broad generalization. Local CPU/API charge was zero; operating costs on hosted infrastructure and Cloudflare Workers AI/Vectorize have not been measured. No Cloudflare embeddings or Vectorize dependency was adopted.

## Network isolation and approval-review interruptions

Automatic approval review interrupted a local validation command because Miniflare fetched `https://workers.cloudflare.com/cf.json`. Inspection of installed Miniflare source showed an optional plain GET for example Request.cf metadata, without app payload or credentials. Both Miniflare test instances now specify `cf:false`; the verification commands also disable that optional fetch. All original security assertions are retained.

Two combined-inference attempts were subsequently blocked by automatic approval review for Microsoft telemetry contact. ONNX's `disable_telemetry_events()` opt-out alone did not resolve the review. Those interrupted attempts are not passing evidence. Network namespaces were attempted but unavailable (no capabilities; uid_map/net namespace operations denied).

The final local embedding server binds its loopback listener, installs a system-libseccomp kernel filter **before importing native model libraries**, and denies new `socket`, `socketpair`, `connect`, `io_uring_setup` and `pidfd_getfd` operations. Future threads/children inherit it. Existing accepted loopback connections can return inference results. No silent sandbox fallback exists. A probe confirmed the kernel rejects new socket creation; the combined inference then completed successfully. This Linux-only isolation belongs to the experiment server; it is not a claim about arbitrary hosted providers or the entire host.

The standalone calibration script's earliest report predates this isolation. `semantic-before-telemetry-disable.json` retains the early result separately; `semantic-results.json` was rerun with the explicit telemetry opt-out. The later combined run exercised the seccomp-isolated embedding server, and the standalone calibration was subsequently reproduced with the same kernel restriction (`embedding-calibration-isolated.json`). All these inputs were synthetic; no real account data or inference credentials were used.

## Configuration and reproduction

Disabled by default. To opt in, configure server-owned `TWIN_EMBEDDING_ENDPOINT`, `TWIN_EMBEDDING_MODEL`, `TWIN_EMBEDDING_MIN_SCORE`; optionally a separately managed `TWIN_EMBEDDING_API_KEY`. Never commit credentials. Remote embedding origin must equal `TWIN_AGENT_ENDPOINT` origin to avoid introducing an additional remote recipient under existing consent. The shared context now includes eligible candidate records (within the cap), rather than only final top-five hits; review this disclosure and provider terms before any deployment. No production configuration was changed.

From `prototypes/twin`, install experiment dependencies in an external virtual environment, download and verify the pinned artifacts, then start in the same local network namespace:

```sh
MODEL_DIR=/private/path/minilm PORT=8090 python experiments/embedding-server.py
llama-server -m /private/path/Qwen3-1.7B-Q8_0.gguf --host 127.0.0.1 --port 8086 --alias qwen3-1.7b-q8 --jinja -c 8192 -np 1 -t 4 --reasoning off --reasoning-budget 0
```

Configure the local experiment environment:

```sh
export TWIN_AGENT_ENDPOINT=http://127.0.0.1:8086/v1/chat/completions
export TWIN_AGENT_MODEL=qwen3-1.7b-q8
export TWIN_EMBEDDING_ENDPOINT=http://127.0.0.1:8090/v1/embeddings
export TWIN_EMBEDDING_MODEL=all-MiniLM-L6-v2
export TWIN_EMBEDDING_MIN_SCORE=.31
node scripts/live-semantic.mjs
node experiments/evaluate-semantic.mjs
```

These servers bind loopback only and are not production deployment scripts. The generative server has no API key in this isolated synthetic experiment. A hosted Worker cannot reach this machine's loopback. A real deployment still requires a protected reachable endpoint, provider/account consent review, hosted isolation validation and approval.

## Recommendation

The previously blocked real-model memory/receipt workflow is now demonstrated locally. Optional semantic retrieval crosses the 90% recall target on the previous challenge, while default lexical retrieval remains below it. Continue restricted engineering evaluation; do not declare full P0-003 acceptance, production readiness, immediate Access-session revocation or commercial productivity improvement. Remaining work: broader semantic calibration/abstention, schema-pressure reliability, semantic entailment evaluation, hosted Access/D1 validation and measured consenting-user outcomes.
