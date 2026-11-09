// Genuine inference only; no scripted model fallback. Synthetic account, local D1/JWKS.
import fs from "node:fs/promises";
import { createHarness, config } from "../tests/helpers/security-harness.mjs";
const output = process.argv[2];
const report = {
  mode: "genuine-inference-local-security-runtime",
  status: "BLOCKED",
  hostedAccess: "NOT_EXECUTED",
  model: process.env.TWIN_AGENT_MODEL ?? null,
  modelCalls: 0,
  latencyMs: null,
  usage: null,
  modelCost: null,
  workflowState: null,
  reconciliation: null,
  blockers: [],
};
if (!process.env.TWIN_AGENT_ENDPOINT || !process.env.TWIN_AGENT_MODEL)
  report.blockers.push("TWIN_AGENT_ENDPOINT and TWIN_AGENT_MODEL are required");
else {
  const network = globalThis.fetch,
    h = await createHarness("live-assurance"),
    jwks = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    if (String(url) === process.env.TWIN_AGENT_ENDPOINT) {
      report.modelCalls++;
      return network(url, init);
    }
    return jwks(url, init);
  };
  try {
    const name = "synthetic-live-assurance";
    let a = await h.call(name, { action: "initialize", name });
    a = await h.call(name, {
      action: "memory.add",
      version: a.version,
      category: "Context",
      text: "The synthetic investor meeting is on Thursday. Prepare a concise product update.",
    });
    await h.call(name, { action: "profile.update", version: a.version, name, aiConsent: true });
    const u = await h.modules.identity.createIdentityAdapter(config)(
        new Headers({ "Cf-Access-Jwt-Assertion": await h.token(name) }),
      ),
      svc = h.modules["assurance-service"];
    let w = (
      await svc.command(
        u,
        {
          action: "propose",
          idempotencyKey: crypto.randomUUID(),
          intent: "Prepare context for an investor follow-up",
          plan: {
            mode: "model",
            message:
              "Use search_personal_memory to find my investor meeting notes. This is only a read, do not send anything. /no_think",
          },
          deadlineAt: Date.now() + 120000,
        },
        h.db.d1,
      )
    ).workflow;
    for (const action of ["review", "approve"])
      w = (await svc.command(u, { action, id: w.id, version: w.version }, h.db.d1)).workflow;
    const started = performance.now();
    const r = await svc.command(u, { action: "execute", id: w.id, version: w.version }, h.db.d1, {
      TWIN_AGENT_ENDPOINT: process.env.TWIN_AGENT_ENDPOINT,
      TWIN_AGENT_MODEL: process.env.TWIN_AGENT_MODEL,
      TWIN_AGENT_API_KEY: process.env.TWIN_AGENT_API_KEY,
    });
    report.latencyMs = performance.now() - started;
    report.workflowState = r.workflow.state;
    report.reconciliation = (
      await h.modules["assurance-reconcile"].reconcile(u, h.db.d1, w.id)
    ).conclusion;
    report.usage = r.result?.execution?.usage ?? null;
    const run = h.db.sql
      .prepare(
        "SELECT status,error_code,tool_executions FROM agent_runs WHERE user_id=? ORDER BY started_at DESC",
      )
      .get(u.userId);
    report.run = run ?? null;
    report.status =
      r.workflow.state === "COMPLETED" &&
      report.reconciliation === "VERIFIED" &&
      r.result?.text?.includes("Thursday") &&
      report.modelCalls > 0
        ? "PASS"
        : "FAIL";
  } catch {
    report.status = "FAIL";
    report.blockers.push("Secured workflow did not complete; inspect sanitized run evidence");
  } finally {
    globalThis.fetch = network;
  }
}
if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === "PASS" ? 0 : report.status === "BLOCKED" ? 2 : 1;
