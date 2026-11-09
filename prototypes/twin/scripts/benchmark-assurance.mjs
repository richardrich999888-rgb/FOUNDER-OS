// Synthetic local CPU/SQLite measurements; no hosted D1 latency or model cost inference.
import fs from "node:fs/promises";
import { createHarness, config } from "../tests/helpers/security-harness.mjs";
const h = await createHarness("assurance-benchmark"),
  svc = h.modules["assurance-service"],
  tel = h.modules["assurance-telemetry"];
const samples = { off: [], on: [] },
  operationCounts = { off: [], on: [] };
const originalLog = console.info;
console.info = () => {};
try {
  for (let i = 0; i < 20; i++)
    for (const mode of ["off", "on"]) {
      const name = `synthetic-benchmark-${mode}-${i}`;
      await h.call(name, { action: "initialize", name });
      const user = await h.modules.identity.createIdentityAdapter(config)(
        new Headers({ "Cf-Access-Jwt-Assertion": await h.token(name) }),
      );
      let w = (
        await svc.command(
          user,
          {
            action: "propose",
            idempotencyKey: crypto.randomUUID(),
            intent: "Retrieve synthetic meeting context",
            plan: { mode: "local", tool: "search_personal_memory", args: { query: "synthetic" } },
            deadlineAt: Date.now() + 60000,
          },
          h.db.d1,
        )
      ).workflow;
      for (const action of ["review", "approve"])
        w = (await svc.command(user, { action, id: w.id, version: w.version }, h.db.d1)).workflow;
      const start = performance.now(),
        q = h.db.queries;
      const r = await tel.withDiagnostics(
        new Request("https://synthetic.test"),
        { TWIN_DIAGNOSTICS: mode === "on" ? "1" : "0" },
        () => svc.command(user, { action: "execute", id: w.id, version: w.version }, h.db.d1),
      );
      if (r.workflow.state !== "COMPLETED" || r.evidence.conclusion !== "VERIFIED")
        throw Error("BENCHMARK_EXECUTION_FAILED");
      samples[mode].push(performance.now() - start);
      operationCounts[mode].push(h.db.queries - q);
    }
} finally {
  console.info = originalLog;
}
const stats = (a) => {
  const x = [...a].sort((a, b) => a - b);
  return {
    n: x.length,
    p50: x[Math.floor(x.length * 0.5)],
    p95: x[Math.min(x.length - 1, Math.floor(x.length * 0.95))],
    min: x[0],
    max: x.at(-1),
  };
};
const report = {
  mode: "local-synthetic-Node-SQLite",
  scope:
    "execute approved read and reconcile; JWT verification and setup excluded; diagnostics include serialization-ready spans, no network exporter",
  latencyMs: { disabled: stats(samples.off), enabled: stats(samples.on) },
  databaseStatements: { disabled: stats(operationCounts.off), enabled: stats(operationCounts.on) },
  medianDiagnosticOverheadMs: stats(samples.on).p50 - stats(samples.off).p50,
  modelCalls: 0,
  modelCost: null,
  hostedLatency: null,
  samples,
};
const out = process.argv[2];
if (out) await fs.writeFile(out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
