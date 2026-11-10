# Local inference experiment

Only synthetic accounts/data were used. No provider credential was needed and no paid API was called. CPU hosting consumes local compute; zero API charge is not a cloud operating-cost estimate.

## Official sources inspected

- https://github.com/ggml-org/llama.cpp and `docs/function-calling.md`: MIT, native CPU `llama-server`, OpenAI-compatible tool calls with Jinja templates. Built source tag b11880, commit `7790a9231d85b8af26e87ee60d8ed7373f9713f0`. Prebuilt CPU release download returned HTTP 504 twice, so source build was used.
- https://huggingface.co/Qwen/Qwen3-0.6B-GGUF: Apache-2.0, official quantized weights. Revision `23749fefcc72300e3a2ad315e1317431b06b590a`, file `Qwen3-0.6B-Q8_0.gguf`, 639446688 bytes, published and locally verified SHA-256 `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031`.
- https://qwen.readthedocs.io/en/latest/run_locally/llama.cpp.html: supported local model runtime and tool parsing.
- https://docs.ollama.com/capabilities/tool-calling: an alternative local server, not used in this experiment. Application code must still authorize/execute returned calls.

llama.cpp is an external test server, not bundled into the Worker. Existing maintained jose/Zod/Drizzle dependencies remain unchanged; no cryptographic implementation copied. A remote Worker cannot reach this test machine's loopback. Hosted inference needs an independently reachable protected endpoint and explicit sharing consent.

## Reproduction

Build pinned source with CMake Release, `GGML_NATIVE=OFF`, `GGML_OPENMP=OFF`, `LLAMA_CURL=OFF`, tests/examples off, target `llama-server`, `-j4`. Test machine: x86_64 Linux, approximately 10 GB RAM, CPU quota 8, server uses 4 inference threads. No GPU.

Start on loopback only (use an isolated test machine; do not expose this unauthenticated test endpoint):

```sh
llama-server -m /private/path/Qwen3-0.6B-Q8_0.gguf --host 127.0.0.1 --port 8081 --alias qwen3-0.6b-q8 --jinja -c 8192 -np 1 -t 4 --reasoning off
```

After `/health` succeeds, from `prototypes/twin`:

```sh
TWIN_AGENT_ENDPOINT=http://127.0.0.1:8081/v1/chat/completions TWIN_AGENT_MODEL=qwen3-0.6b-q8 npm run test:live-agent
TWIN_AGENT_ENDPOINT=http://127.0.0.1:8081/v1/chat/completions TWIN_AGENT_MODEL=qwen3-0.6b-q8 node scripts/live-adversarial.mjs
```

Keep server and tests in the same network namespace. The first attempt used a different execution namespace and returned `MODEL_UNAVAILABLE` without inference; it is NOT counted as genuine model evidence.

`real-model-before.json` contains genuine 0.6B inference before requiring lookup: 1/2 smoke assertions pass; confirmed recall fails because the model skips lookup. `real-model-after.json` retains the subsequent 0/2 result with required selection: both runs hit the unchanged 43-second work deadline. `real-model-challenge.json` records a separate six-case genuine attempt. Failures are evidence of inadequate model/runtime performance, not passing safety/product acceptance. Runtime and model limits were not relaxed.

The adversarial runner measures API/grounding/receipt behavior, not semantic entailment or third-party model quality. Its no-source expectation is intentionally strict for the unauthorized/schema-pressure prompts; inspect individual results. Consent races, malformed responses, oversized responses, redirects and DB failures are separately covered with controlled fault injection in the deterministic suite; they are not passed off as live-model observations. No automatic provider retry is implemented; deadline/error behavior remains bounded.

A larger official candidate, Qwen3-1.7B-Q8_0 (revision `90862c4b9d2787eaed51d12237eafdfe7c5f6077`, published size 1834426016, SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`) was investigated. Do not treat a partial download or unverified file as usable model evidence. Its outcome is recorded in the verification report.

Final source smoke evidence is in `real-model-final.json`; the six-case challenge predates the schema-description and denied-only error corrections. The larger download timed out (curl exit 28 at 180 seconds); no 1.7B inference occurred.
