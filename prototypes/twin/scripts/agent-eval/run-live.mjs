// Live-model evaluation: runs the curated scenarios against a REAL model through the real runtime.
//
// Provider selection (environment variables only; no secrets in code):
//   AGENT_EVAL_PROVIDER = chat | responses
//   chat:      AGENT_EVAL_ENDPOINT (e.g. http://127.0.0.1:8080/v1/chat/completions), AGENT_EVAL_MODEL,
//              optional AGENT_EVAL_API_KEY (prefer proxy-injected credentials)
//   responses: OPENAI_MODEL, OPENAI_API_KEY (any non-empty value when the proxy injects the key)
// Optional: AGENT_EVAL_LIMIT=<n> to run only the first n live scenarios.
// Output: docs/agent/p0-002-evaluation-live-<provider>.json
import fs from 'node:fs';
import { loadAgent } from '../../tests/support/harness.mjs';
import { runEvaluation, recording, LIVE_SCENARIO_FILTER } from '../../tests/support/eval-harness.mjs';

const provider = process.env.AGENT_EVAL_PROVIDER;
const mods = await loadAgent('agent-eval-live');
let factory;
let modelId;
if (provider === 'chat') {
  modelId = process.env.AGENT_EVAL_MODEL;
  factory = () => mods.chatAdapter.createChatCompletionsModel({ endpoint: process.env.AGENT_EVAL_ENDPOINT, model: modelId, apiKey: process.env.AGENT_EVAL_API_KEY });
} else if (provider === 'responses') {
  modelId = process.env.OPENAI_MODEL;
  factory = () => mods.adapter.createOpenAIResponsesModel({ apiKey: process.env.OPENAI_API_KEY, model: modelId });
} else {
  console.error('Set AGENT_EVAL_PROVIDER to "chat" or "responses".');
  process.exit(64);
}
const limit = Number(process.env.AGENT_EVAL_LIMIT || Infinity);
let seen = 0;
const filter = (s) => LIVE_SCENARIO_FILTER(s) && seen++ < limit;
const { rows, metrics } = await runEvaluation(mods, {
  modelFor: () => recording(factory()),
  filter,
  onScenario: (r) => console.error(`${r.id} ${r.success ? 'PASS' : 'FAIL'} ${r.status}/${r.answerSource}/${r.grounding} ${r.errorCode ?? ''} ${Math.round(r.latencyMs)}ms`),
});
const out = { generatedAt: new Date().toISOString(), provider, model: modelId, endpoint: provider === 'chat' ? process.env.AGENT_EVAL_ENDPOINT : 'api.openai.com/v1/responses', scenarios: rows.length, metrics, rows };
fs.writeFileSync(`docs/agent/p0-002-evaluation-live-${provider}.json`, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
