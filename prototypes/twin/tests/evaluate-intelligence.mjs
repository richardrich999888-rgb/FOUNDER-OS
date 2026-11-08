import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createHarness, config } from "./helpers/security-harness.mjs";
const raw = await fs.readFile(
  new URL("./fixtures/intelligence-eval-v1.json", import.meta.url),
  "utf8",
);
const fixtureHash = createHash("sha256").update(raw).digest("hex");
assert.equal(
  fixtureHash,
  (
    await fs.readFile(new URL("./fixtures/intelligence-eval-v1.sha256", import.meta.url), "utf8")
  ).trim(),
  "Do not mutate the frozen evaluation fixture",
);
const fixture = JSON.parse(raw),
  h = await createHarness("evaluation");
const service = h.modules["intelligence-service"],
  store = h.modules["intelligence-store"],
  retrieval = h.modules["intelligence-retrieval"],
  extract = h.modules["intelligence-extraction"],
  core = h.modules.core;
const adapter = h.modules.identity.createIdentityAdapter(config),
  cases = [],
  latency = { legacy: [], structured: [], hybrid: [], hybridWithDatabase: [] };
const principals = new Map();
async function principal(name) {
  if (!principals.has(name)) {
    assert.equal((await h.call(name, { action: "initialize", name })).status, 200);
    principals.set(
      name,
      await adapter(new Headers({ "Cf-Access-Jwt-Assertion": await h.token(name) })),
    );
  }
  return principals.get(name);
}
const read = (u) => store.readSnapshot(u, h.db.d1);
async function mutate(u, p) {
  const s = await read(u);
  return service.mutateIntelligence(u, { epoch: s.epoch, ...p }, h.db.d1);
}
async function save(u, text, kind) {
  const result =
    kind === "fact" && !text.startsWith("I ")
      ? await mutate(u, {
          action: "propose",
          text,
          label: "Synthetic evaluation source",
          quote: text,
          content: {
            kind: "fact",
            factType: "context",
            text,
            key: text.slice(0, 100),
            subjectId: null,
            value: null,
            rationale: null,
          },
        })
      : await mutate(u, { action: "capture", text, label: "Synthetic evaluation source" });
  const r = result.snapshot.records.find((r) => result.ids.includes(r.id) && r.kind !== "source");
  assert.ok(r);
  await mutate(u, { action: "confirm", id: r.id });
  return r.id;
}
const corpus = await principal("eval-corpus");
const expected = new Map();
for (const c of fixture.scenarios.filter((c) => c.category.startsWith("retrieval-")))
  expected.set(c.id, await save(corpus, c.text, c.kind));
// Identical confirmed corpus projected into the unmodified P0-001 keyword function.
const s = await read(corpus),
  legacy = core.emptyState("Synthetic benchmark");
for (const c of fixture.scenarios.filter((c) => c.category.startsWith("retrieval-")))
  legacy.memories.push({
    id: expected.get(c.id),
    text: c.text,
    category: c.kind,
    source: "Synthetic evaluation source",
    status: "confirmed",
    createdAt: s.legacy.createdAt,
    updatedAt: s.legacy.createdAt,
  });
let statementCountStart = h.db.queries;
for (const c of fixture.scenarios) {
  const result = { id: c.id, split: c.split, category: c.category, pass: false };
  if (c.category.startsWith("retrieval-")) {
    const target = expected.get(c.id);
    result.ranks = {};
    let start = performance.now();
    const old = core.retrieve(c.query.query, legacy);
    latency.legacy.push(performance.now() - start);
    result.ranks.legacy = old.findIndex((r) => r.excerpt === c.text) + 1;
    for (const mode of ["structured", "hybrid"]) {
      start = performance.now();
      const r = retrieval.retrieveContext(s, { ...c.query, mode });
      latency[mode].push(performance.now() - start);
      result.ranks[mode] = r.results.findIndex((r) => r.id === target) + 1;
      result.grounded = r.results.every((r) =>
        s.records.some(
          (src) =>
            src.id === r.sourceId &&
            src.content?.kind === "source" &&
            src.content.text.includes(r.quote),
        ),
      );
    }
    start = performance.now();
    await service.searchIntelligence(corpus, c.query, h.db.d1);
    latency.hybridWithDatabase.push(performance.now() - start);
    result.pass = result.ranks.hybrid > 0 && result.grounded;
  } else if (c.category === "extract-positive" || c.category === "extract-negative") {
    const candidates = extract
      .extractCandidates(c.text)
      .filter((x) => x.content.kind === "commitment");
    result.expected = c.category === "extract-positive" ? 1 : 0;
    result.predicted = candidates.length;
    result.truePositive = Math.min(result.expected, candidates.length);
    result.deadlineCorrect = !result.expected || candidates[0]?.content.deadline === c.deadline;
    result.pass = result.predicted === result.expected && result.deadlineCorrect;
  } else if (c.category === "temporal" || c.category === "contradiction") {
    const u = await principal(c.id),
      old = await save(u, c.old, "fact");
    const captured = await mutate(u, { action: "capture", text: c.current, label: "New evidence" }),
      candidate = captured.snapshot.records.find(
        (r) => captured.ids.includes(r.id) && r.kind === "fact",
      );
    result.conflictDetected = service
      .consolidation(captured.snapshot, candidate)
      .conflicts.includes(old);
    await assert.rejects(
      () => mutate(u, { action: "confirm", id: candidate.id }),
      (e) => e.code === "CONFLICT",
    );
    if (c.category === "temporal") {
      await mutate(u, { action: "confirm", id: candidate.id, supersedes: [old] });
      const found = await service.searchIntelligence(u, { query: "meeting preference" }, h.db.d1);
      result.pass =
        found.results.length === 1 &&
        found.results[0].id === candidate.id &&
        !JSON.stringify(found).includes("Monday");
    } else result.pass = result.conflictDetected;
  } else if (c.category === "forget") {
    const u = await principal(c.id),
      id = await save(u, c.text, "fact");
    assert.equal(
      (await service.searchIntelligence(u, { query: c.text }, h.db.d1)).results.length,
      1,
    );
    await mutate(u, { action: "forget", id, confirmation: "FORGET EVIDENCE" });
    const after = await read(u);
    result.deletedResults = retrieval.retrieveContext(after, { query: c.text }).results.length;
    result.scrubbed = after.records.every((r) => r.content === null && r.quote === "");
    result.pass = result.deletedResults === 0 && result.scrubbed;
  } else if (c.category === "isolation") {
    const u = await principal(c.id + "-a"),
      v = await principal(c.id + "-b"),
      id = await save(u, c.text, "fact");
    const found = await service.searchIntelligence(v, { query: c.text }, h.db.d1);
    result.disclosures = found.results.length;
    await assert.rejects(() =>
      mutate(v, { action: "forget", id, confirmation: "FORGET EVIDENCE" }),
    );
    await assert.rejects(() => store.readSnapshot({ ...u }, h.db.d1));
    result.pass = result.disclosures === 0;
  } else if (c.category === "procedure") {
    const u = await principal(c.id);
    for (let n = 0; n < 3; n++) {
      const text = `${c.workflow} completed successfully ${n + 1}.`;
      const created = await mutate(u, {
        action: "propose",
        text,
        quote: text,
        label: "Synthetic user feedback",
        content: {
          kind: "outcome",
          workflowKey: c.workflow,
          runId: crypto.randomUUID(),
          steps: c.steps,
          manualSteps: c.manualSteps,
          success: true,
          feedback: text,
          verification: "user-attested",
        },
      });
      const id = created.snapshot.records.find(
        (r) => created.ids.includes(r.id) && r.kind === "outcome",
      ).id;
      await mutate(u, { action: "confirm", id });
    }
    const created = await mutate(u, { action: "learn", workflowKey: c.workflow }),
      id = created.snapshot.records.find(
        (r) => created.ids.includes(r.id) && r.kind === "procedure",
      ).id;
    await assert.rejects(
      () => mutate(u, { action: "activate", id }),
      (e) => e.code === "DENIED",
    );
    result.unauthorizedActivation = 0;
    await mutate(u, { action: "confirm", id });
    await mutate(u, { action: "activate", id });
    const recalled = await service.searchIntelligence(
      u,
      { query: c.workflow, kind: "procedure" },
      h.db.d1,
    );
    result.stepsPreserved =
      JSON.stringify(recalled.results[0]?.content.steps) === JSON.stringify(c.steps);
    // Count scripted information-entry/review operations, NOT real human workflow completion.
    const before = ["name-workflow", ...c.steps.map((_, i) => `enter-step-${i + 1}`), "review"];
    const after = ["retrieve-approved-checklist", "review"];
    result.scriptedPreparation = {
      before: before.length,
      after: after.length,
      reduction: 1 - after.length / before.length,
    };
    result.pass = result.stepsPreserved;
  } else if (c.category === "abstention") {
    const r = await service.searchIntelligence(corpus, { query: c.query }, h.db.d1);
    result.pass = r.status === "no_evidence" && r.results.length === 0;
  }
  cases.push(result);
}
const pct = (a, b) => (b ? a / b : null);
function metrics(split) {
  const all = cases.filter((c) => !split || c.split === split),
    get = (type) => all.filter((c) => c.category === type),
    recall = all.filter((c) => c.ranks);
  const results = {
    scenarios: all.length,
    passed: all.filter((c) => c.pass).length,
    retrieval: {},
  };
  for (const mode of ["legacy", "structured", "hybrid"])
    results.retrieval[mode] = {
      n: recall.length,
      recallAt5: pct(recall.filter((c) => c.ranks[mode] > 0).length, recall.length),
      mrr: pct(
        recall.reduce((sum, c) => sum + (c.ranks[mode] > 0 ? 1 / c.ranks[mode] : 0), 0),
        recall.length,
      ),
    };
  const extraction = all.filter((c) => c.category.startsWith("extract-")),
    tp = extraction.reduce((s, c) => s + c.truePositive, 0),
    predicted = extraction.reduce((s, c) => s + c.predicted, 0),
    positives = extraction.reduce((s, c) => s + c.expected, 0);
  results.commitmentExtraction = {
    n: extraction.length,
    truePositive: tp,
    predicted,
    expected: positives,
    precision: pct(tp, predicted),
    recall: pct(tp, positives),
    deadlineAccuracy: pct(extraction.filter((c) => c.deadlineCorrect).length, extraction.length),
  };
  for (const type of [
    "temporal",
    "contradiction",
    "forget",
    "isolation",
    "procedure",
    "abstention",
  ]) {
    const group = get(type);
    results[type] = {
      n: group.length,
      correct: group.filter((c) => c.pass).length,
      accuracy: pct(group.filter((c) => c.pass).length, group.length),
    };
  }
  results.sourceGrounding = { n: recall.length, correct: recall.filter((c) => c.grounded).length };
  results.deletedResults = get("forget").reduce((s, c) => s + c.deletedResults, 0);
  results.unauthorizedDisclosures = get("isolation").reduce((s, c) => s + c.disclosures, 0);
  results.unauthorizedActivations = get("procedure").reduce(
    (s, c) => s + c.unauthorizedActivation,
    0,
  );
  const preparation = get("procedure");
  results.scriptedPreparationReduction = pct(
    preparation.reduce((s, c) => s + c.scriptedPreparation.reduction, 0),
    preparation.length,
  );
  return results;
}
const quantile = (v, p) =>
  [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(p * v.length))];
const measured = metrics(),
  report = {
    schemaVersion: 1,
    fixtureHash,
    fixtureFrozenAt: fixture.frozenAt,
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      database: "Node SQLite in-memory, actual D1 SQL/transactions; workerd separately tested",
      modelCalls: 0,
      embeddingCalls: 0,
      paidProviderCostUsd: 0,
      cloudflareBilledCost: "not measured; local execution only",
    },
    scope: fixture.scope,
    metrics: measured,
    development: metrics("development"),
    holdout: metrics("holdout"),
    latencyMs: Object.fromEntries(
      Object.entries(latency).map(([k, v]) => [
        k,
        { n: v.length, p50: quantile(v, 0.5), p95: quantile(v, 0.95) },
      ]),
    ),
    sqlStatementsAfterCorpusSetup: h.db.queries - statementCountStart,
    optionalSemantic: {
      status: "not measured",
      reason: "No authorized Workers AI/Vectorize test bindings or credentials; not adopted",
    },
    workflowCompletion: {
      status: "not measured",
      reason:
        "Scripted checklist preparation proxy; no real human study or verified external actions",
    },
    cases,
  };
await fs.mkdir("../../docs/intelligence", { recursive: true });
await fs.writeFile(
  "../../docs/intelligence/benchmark-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    { fixtureHash, metrics: report.metrics, holdout: report.holdout, latencyMs: report.latencyMs },
    null,
    2,
  ),
);
if (
  cases.some((c) => !c.pass) ||
  measured.retrieval.hybrid.recallAt5 < 0.9 ||
  measured.temporal.accuracy < 0.95 ||
  measured.commitmentExtraction.precision < 0.95
)
  process.exitCode = 1;
