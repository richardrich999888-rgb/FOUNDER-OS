// Real-model smoke test against the secured P0-003 runtime. Synthetic local accounts only.
// Missing configuration is BLOCKED (exit 2), never a passing/skipped model evaluation.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHarness } from "../tests/helpers/security-harness.mjs";

if (!process.env.TWIN_AGENT_ENDPOINT || !process.env.TWIN_AGENT_MODEL) {
  console.error(
    "BLOCKED: configure TWIN_AGENT_ENDPOINT and TWIN_AGENT_MODEL for a real inference server.",
  );
  process.exit(2);
}
const realFetch = globalThis.fetch;
const h = await createHarness("live-intelligence");
const authFetch = globalThis.fetch;
Object.assign(h.env, {
  TWIN_AGENT_ENDPOINT: process.env.TWIN_AGENT_ENDPOINT,
  TWIN_AGENT_MODEL: process.env.TWIN_AGENT_MODEL,
  TWIN_AGENT_API_KEY: process.env.TWIN_AGENT_API_KEY,
});
let modelCalls = 0;
globalThis.fetch = (url, options) => {
  if (String(url) === h.env.TWIN_AGENT_ENDPOINT) {
    modelCalls++;
    return realFetch(url, options);
  }
  return authFetch(url, options);
};
const rows = [];
try {
  assert.equal(
    (await h.call("synthetic-live", { action: "initialize", name: "Synthetic" })).status,
    200,
  );
  let a = await h.call("synthetic-live");
  a = await h.call("synthetic-live", {
    action: "profile.update",
    name: "Synthetic",
    aiConsent: true,
    version: a.version,
  });
  assert.equal(a.status, 200);
  let graph = await h.intelligenceCall("synthetic-live");
  assert.equal(
    (
      await h.intelligenceCall("synthetic-live", {
        action: "capture",
        epoch: graph.epoch,
        text: "I prefer concise answers.",
        label: "Synthetic smoke evidence",
      })
    ).status,
    200,
  );
  graph = await h.intelligenceCall("synthetic-live");
  const fact = graph.records.find((r) => r.kind === "fact");
  assert.ok(fact);
  assert.equal(
    (
      await h.intelligenceCall("synthetic-live", {
        action: "confirm",
        epoch: graph.epoch,
        id: fact.id,
      })
    ).status,
    200,
  );
  for (const [name, message, expected] of [
    ["confirmed-recall", "Search my saved memory: what answers do I prefer?", "cited"],
    ["missing-evidence", "Search my saved memory: what is my favourite mountain?", "no_evidence"],
  ]) {
    const start = performance.now();
    const result = await h.agentCall("synthetic-live", {
      mode: "model",
      requestId: crypto.randomUUID(),
      message,
    });
    const pass =
      result.httpStatus === 200 &&
      result.execution?.grounding === expected &&
      (expected !== "cited" ||
        result.sources?.some((s) => s.sourceId === `intelligence:${fact.id}:v1`));
    rows.push({
      name,
      pass,
      httpStatus: result.httpStatus,
      grounding: result.execution?.grounding ?? null,
      errorCode: result.execution?.errorCode ?? null,
      latencyMs: performance.now() - start,
      usage: result.execution?.usage ?? null,
      receiptCount: result.execution?.receipts?.length ?? 0,
    });
  }
} catch {
  rows.push({ name: "setup-or-execution", pass: false });
} finally {
  globalThis.fetch = realFetch;
}
const evidence = {
  measuredAt: new Date().toISOString(),
  model: process.env.TWIN_AGENT_MODEL,
  scope: "two synthetic real-model smoke cases; not production or scientific evaluation",
  modelCalls,
  rows,
};
await fs.writeFile(
  ".sites-runtime/live-intelligence-results.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
process.exitCode = rows.length === 2 && rows.every((r) => r.pass) && modelCalls > 0 ? 0 : 1;
