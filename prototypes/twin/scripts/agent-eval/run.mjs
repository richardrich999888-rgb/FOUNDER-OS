// Runs the P0-002 evaluation and writes docs/agent/p0-002-evaluation-results.json.
// Usage (from prototypes/twin): node scripts/agent-eval/run.mjs
import fs from 'node:fs';
import { loadAgent } from '../../tests/support/harness.mjs';
import { runEvaluation, DATASET } from '../../tests/support/eval-harness.mjs';
import { createHash } from 'node:crypto';

const mods = await loadAgent('agent-eval-run');
const { rows, metrics } = await runEvaluation(mods);
const datasetSha256 = createHash('sha256').update(fs.readFileSync('tests/fixtures/agent-eval-dataset.json')).digest('hex');
const out = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  datasetSha256,
  scenarios: DATASET.scenarios.length,
  model: 'deterministic stubs (reference policy + adversarial scripts); no real provider',
  realProvider: process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL ? 'credentials present: run tests/agent-evaluation.test.mjs' : 'NOT RUN: OPENAI_API_KEY/OPENAI_MODEL not set',
  metrics,
  failures: rows.filter((r) => !r.success),
};
fs.writeFileSync('docs/agent/p0-002-evaluation-results.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
