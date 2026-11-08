import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHarness, config } from "./helpers/security-harness.mjs";
const h = await createHarness("integrated-agent"),
  m = (n) => h.modules["agent-" + n],
  svc = h.modules["intelligence-service"],
  store = h.modules["intelligence-store"];
async function user(name, consent = false) {
  assert.equal((await h.call(name, { action: "initialize", name })).status, 200);
  if (consent) {
    const a = await h.call(name);
    await h.call(name, { action: "profile.update", name, aiConsent: true, version: a.version });
  }
  return h.modules.identity.createIdentityAdapter(config)(
    new Headers({ "Cf-Access-Jwt-Assertion": await h.token(name) }),
  );
}
async function mutation(u, c) {
  const s = await store.readSnapshot(u, h.db.d1);
  return svc.mutateIntelligence(u, { epoch: s.epoch, ...c }, h.db.d1);
}
async function capture(u, text) {
  const c = await mutation(u, { action: "capture", text, label: "Synthetic agent evidence" });
  for (const r of c.snapshot.records.filter((r) => c.ids.includes(r.id) && r.kind !== "source"))
    await mutation(u, { action: "confirm", id: r.id });
  return store.readSnapshot(u, h.db.d1);
}
const turn = (tool, args, callId = crypto.randomUUID()) => ({
  text: "",
  toolCalls: [{ name: tool, argumentsJson: JSON.stringify(args), callId }],
  usage: null,
  truncated: false,
});
const final = (text = "Verified evidence [E1]") => ({
  text,
  toolCalls: [],
  usage: null,
  truncated: false,
});
function scripted(turns) {
  let i = 0;
  return {
    calls: [],
    async respond(request, signal) {
      this.calls.push(request);
      const next = turns[i++];
      return typeof next === "function" ? next(request, signal) : (next ?? final());
    },
  };
}
async function session(
  u,
  {
    destination = "local",
    tools = m("intelligence-tools").intelligenceTools,
    model,
    limits = {},
  } = {},
) {
  const principal = await m("principal").createVerifiedPrincipal(u, tools, destination, h.db.d1),
    requestId = crypto.randomUUID(),
    resolved = m("limits").resolveLimits(limits);
  const receipts = m("receipts").createD1ReceiptStore(
    h.db.d1,
    principal,
    requestId,
    Date.now() + resolved.totalDeadlineMs,
  );
  const deps = {
    model,
    registry: m("intelligence-tools").createIntelligenceRegistry(h.db.d1),
    receipts,
    clock: m("deadline").systemClock,
    newId: () => crypto.randomUUID(),
    limits: resolved,
    validateContext: () =>
      m("principal")
        .verifyCurrentPrincipal(principal, h.db.d1)
        .then(() => undefined),
  };
  return {
    principal,
    requestId,
    deps,
    run: () =>
      m("runtime").runAgent({ principal, requestId, message: "Synthetic evaluation" }, deps),
  };
}
const noDisclosure = (r) => {
  assert.equal(r.status, "failed");
  assert.equal(r.answer, null);
  assert.deepEqual(r.sources, []);
};

test("real JWT -> local HTTP agent -> authorized graph read -> persisted execution receipt", async () => {
  const u = await user("http");
  await capture(u, "I prefer concise answers.");
  const requestId = crypto.randomUUID();
  const r = await h.agentCall("http", {
    requestId,
    tool: "search_personal_memory",
    args: { query: "concise" },
  });
  assert.equal(r.httpStatus, 200, JSON.stringify(r));
  assert.equal(r.execution.planner, "deterministic-local");
  assert.equal(r.execution.toolExecutions, 1);
  assert.equal(r.execution.answerSource, "runtime_evidence_fallback");
  assert.match(r.text, /concise/);
  assert.equal(r.execution.receipts[0].status, "succeeded");
  assert.equal(
    h.db.sql.prepare("SELECT status FROM agent_runs WHERE request_id=?").get(requestId).status,
    "completed",
  );
  assert.equal(
    h.db.sql
      .prepare("SELECT status FROM agent_execution_receipts WHERE request_id=?")
      .get(requestId).status,
    "succeeded",
  );
  assert.equal(
    (
      await h.agentCall("http", {
        requestId,
        tool: "search_personal_memory",
        args: { query: "concise" },
      })
    ).httpStatus,
    409,
  );
  assert.equal(
    (
      await h.agentCall(
        null,
        {
          requestId: crypto.randomUUID(),
          tool: "search_personal_memory",
          args: { query: "concise" },
        },
        { "oai-authenticated-user-id": u.userId },
      )
    ).httpStatus,
    401,
  );
  assert.equal(
    (
      await h.agentCall("http", {
        requestId: crypto.randomUUID(),
        tool: "search_personal_memory",
        args: { query: "concise", userId: "victim" },
      })
    ).httpStatus,
    400,
  );
});

test("all five tools execute through the integrated runtime and preserve sibling source citations", async () => {
  const u = await user("five");
  let s = await capture(u, "Person: Maya Rao\nProject: Cedar");
  const person = s.records.find((r) => r.content?.entityType === "person"),
    project = s.records.find((r) => r.content?.entityType === "project");
  await capture(
    u,
    "I will send the deck to Maya Rao for Project Cedar.\nI will review the deck to Maya Rao for Project Cedar.",
  );
  s = await capture(u, "Procedure: Deck | Check figures > Review draft");
  const proc = s.records.find((r) => r.kind === "procedure");
  await mutation(u, { action: "activate", id: proc.id });
  const cases = [
    ["search_personal_memory", { query: "deck" }],
    ["find_commitments", { status: "follow-up", person: "Maya Rao", project: "Cedar" }],
    ["get_person_context", { entityId: person.id }],
    ["get_project_context", { entityId: project.id }],
    ["retrieve_procedure", { query: "Deck" }],
  ];
  for (const [name, args] of cases) {
    const model = scripted([turn(name, args), final()]),
      s = await session(u, { model });
    const r = await s.run();
    assert.equal(r.status, "completed");
    assert.equal(r.receipts[0].status, "succeeded");
    assert.ok(r.sources.length);
    if (name === "find_commitments") {
      const observation = JSON.parse(
        model.calls[1].items.find((i) => i.type === "tool_result").output,
      );
      assert.equal(observation.evidence.length, 2);
      assert.notEqual(observation.evidence[0].citation, observation.evidence[1].citation);
    }
  }
});

test("forged/cloned principal and scope escalation cannot reach tools or planner", async () => {
  const u = await user("forgery"),
    model = scripted([final()]),
    s = await session(u, { model, tools: ["find_commitments"] });
  await assert.rejects(() =>
    m("principal").createVerifiedPrincipal({ ...u }, ["search_personal_memory"], "local", h.db.d1),
  );
  const bad = await m("runtime").runAgent(
    { principal: { ...s.principal }, requestId: s.requestId, message: "x" },
    s.deps,
  );
  noDisclosure(bad);
  assert.equal(model.calls.length, 0);
  const denied = await session(u, {
    tools: ["find_commitments"],
    model: scripted([turn("search_personal_memory", { query: "x" }), final()]),
  });
  const r = await denied.run();
  assert.equal(r.receipts[0].authorization, "deny");
  assert.equal(r.receipts[0].errorCode, "MISSING_SCOPE");
  assert.deepEqual(r.sources, []);
});

test("cross-account entity selectors cannot read another owner", async () => {
  const a = await user("owner-a"),
    b = await user("owner-b");
  const graph = await capture(a, "Person: Private Person\nI prefer emerald answers.");
  const id = graph.records.find((r) => r.kind === "entity").id;
  for (const t of [
    turn("search_personal_memory", { query: "emerald" }),
    turn("get_person_context", { entityId: id }),
  ]) {
    const s = await session(b, { model: scripted([t, final()]) }),
      r = await s.run();
    assert.equal(r.grounding, "no_evidence");
    assert.doesNotMatch(JSON.stringify(r), /emerald|Private Person/);
  }
});

test("consent revoked during planner wait prevents tool and replay disclosure", async () => {
  const u = await user("revoke", true);
  await capture(u, "I prefer private answers.");
  const model = scripted([
    async () => {
      const a = await h.call("revoke");
      await h.call("revoke", {
        action: "profile.update",
        name: "Revoke",
        aiConsent: false,
        version: a.version,
      });
      return turn("search_personal_memory", { query: "private" });
    },
  ]);
  const s = await session(u, { destination: "provider", model }),
    r = await s.run();
  noDisclosure(r);
  assert.equal(model.calls.length, 1);
  assert.equal(r.errorCode, "AUTHORIZATION_REVOKED");
  assert.equal(r.toolExecutions, 0);
});

test("forget during second planner call prevents final prose AND evidence fallback", async () => {
  const u = await user("forget-flight", true),
    graph = await capture(u, "I prefer cobalt answers."),
    id = graph.records.find((r) => r.kind === "fact").id;
  const model = scripted([
    turn("search_personal_memory", { query: "cobalt" }),
    async () => {
      await mutation(u, { action: "forget", id, confirmation: "FORGET EVIDENCE" });
      return final("Private cobalt answer [E99]");
    },
  ]);
  const s = await session(u, { destination: "provider", model }),
    r = await s.run();
  noDisclosure(r);
  assert.doesNotMatch(JSON.stringify(r), /cobalt/);
});

test("context changed during final receipt completion is withheld", async () => {
  const u = await user("finish-change"),
    graph = await capture(u, "I prefer calm answers."),
    id = graph.records.find((r) => r.kind === "fact").id;
  const s = await session(u, {
      model: scripted([turn("search_personal_memory", { query: "calm" }), final()]),
    }),
    base = s.deps.receipts;
  s.deps.receipts = {
    ...base,
    finishRun: async (r) => {
      await base.finishRun(r);
      await mutation(u, { action: "forget", id, confirmation: "FORGET EVIDENCE" });
    },
  };
  noDisclosure(await s.run());
});

test("deleted account generations cannot revive admission, runs or receipts", async () => {
  const u = await user("erase-flight"),
    s = await session(u, { model: scripted([final()]) });
  await s.deps.receipts.startRun({
    userId: u.userId,
    requestId: s.requestId,
    startedAt: Date.now(),
  });
  const r = {
    executionId: crypto.randomUUID(),
    requestId: s.requestId,
    userId: u.userId,
    callIndex: 0,
    toolId: "search_personal_memory",
    startedAt: Date.now(),
  };
  await s.deps.receipts.begin(r);
  const a = await h.call("erase-flight");
  await h.call("erase-flight", {
    action: "erase",
    confirmation: "DELETE MY DATA",
    version: a.version,
  });
  await h.call("erase-flight", { action: "initialize", name: "Fresh" });
  await assert.rejects(() =>
    s.deps.receipts.begin({ ...r, executionId: crypto.randomUUID(), callIndex: 1 }),
  );
  await assert.rejects(() =>
    s.deps.receipts.recordDenied({
      ...r,
      executionId: crypto.randomUUID(),
      completedAt: Date.now(),
      errorCode: "UNKNOWN_TOOL",
    }),
  );
  await assert.rejects(() =>
    s.deps.receipts.startRun({ userId: u.userId, requestId: s.requestId, startedAt: Date.now() }),
  );
  await assert.rejects(() =>
    m("admission").admitAgent(s.principal, crypto.randomUUID(), Date.now(), h.db.d1),
  );
  for (const table of ["agent_runs", "agent_execution_receipts", "twin_ai_requests"])
    assert.equal(
      h.db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(u.userId).n,
      0,
    );
});

test("atomic admission enforces duplicate and minute limit under concurrency", async () => {
  const u = await user("admission"),
    s = await session(u, { model: scripted([]) }),
    id = crypto.randomUUID();
  const pair = await Promise.all(
    [1, 2].map(() => m("admission").admitAgent(s.principal, id, Date.now(), h.db.d1)),
  );
  assert.deepEqual(pair.sort(), ["admitted", "duplicate"]);
  const bulk = await Promise.all(
    Array.from({ length: 6 }, () =>
      m("admission").admitAgent(s.principal, crypto.randomUUID(), Date.now(), h.db.d1),
    ),
  );
  assert.equal(bulk.filter((r) => r === "admitted").length, 2);
  assert.equal(bulk.filter((r) => r === "rate_limited").length, 4);
});

test("real schema, FK cascade, upgrade metadata and receipt privacy", async () => {
  const schema = JSON.parse(await fs.readFile("drizzle/meta/0002_snapshot.json", "utf8")),
    indexes = new Set(
      h.db.sql
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all()
        .map((r) => r.name),
    );
  for (const table of Object.values(schema.tables))
    for (const name of Object.keys(table.indexes)) assert.ok(indexes.has(name));
  assert.deepEqual(h.db.sql.prepare("PRAGMA foreign_key_check").all(), []);
  const dump = JSON.stringify([
    h.db.sql.prepare("SELECT * FROM agent_runs").all(),
    h.db.sql.prepare("SELECT * FROM agent_execution_receipts").all(),
  ]);
  assert.doesNotMatch(dump, /I prefer|cobalt|emerald|Maya Rao|figures|sk-/);
});

test("planner timeout has deterministic classification when audit succeeds; failed receipts never return results", async () => {
  const u = await user("timeout"),
    s = await session(u, {
      model: { respond: () => new Promise(() => {}) },
      limits: { totalDeadlineMs: 700, auditReserveMs: 450 },
    });
  const started = Date.now(),
    r = await s.run();
  noDisclosure(r);
  assert.equal(r.errorCode, "MODEL_TIMEOUT");
  assert.ok(Date.now() - started < 1500);
  const other = await session(u, {
    model: scripted([turn("search_personal_memory", { query: "x" }), final()]),
  });
  other.deps.receipts = {
    ...other.deps.receipts,
    begin: async () => {
      throw new (m("errors").ReceiptWriteError)();
    },
  };
  noDisclosure(await other.run());
});

test("verified long Unicode legacy account mappings remain valid; expired principals do not run", async () => {
  const accountId = "నాగ శ్రీ గణేష్ " + "x".repeat(300),
    subject = "linked-user";
  const adapter = h.modules.identity.createIdentityAdapter({
    ...config,
    TWIN_AUTH_ACCOUNT_LINKS: JSON.stringify([{ subject, accountId }]),
  });
  const identity = await adapter(
    new Headers({ "Cf-Access-Jwt-Assertion": await h.token(subject) }),
  );
  h.db.sql
    .prepare("INSERT INTO twin_accounts(user_id,state) VALUES(?,?)")
    .run(accountId, JSON.stringify(h.modules.core.emptyState("Synthetic linked user")));
  const model = scripted([final("Hello")]),
    s = await session(identity, { model });
  assert.equal((await s.run()).status, "completed");
  const expired = await session(identity, { model: scripted([final()]) }),
    original = Date.now;
  try {
    Date.now = () => identity.expiresAt + 1;
    noDisclosure(await expired.run());
    assert.equal(expired.deps.model.calls.length, 0);
  } finally {
    Date.now = original;
  }
});

test("late noncooperative D1 run inserts fail the SQL deadline guard", async () => {
  const u = await user("late-insert"),
    s = await session(u, { model: scripted([]) });
  const delayed = {
    prepare(q) {
      const statement = h.db.d1.prepare(q);
      return {
        bind(...args) {
          const bound = statement.bind(...args);
          return {
            all: async () => {
              await new Promise((resolve) => setTimeout(resolve, 90));
              return bound.all();
            },
          };
        },
      };
    },
  };
  const receipts = m("receipts").createD1ReceiptStore(
    delayed,
    s.principal,
    s.requestId,
    Date.now() + 25,
  );
  await assert.rejects(
    () => receipts.startRun({ userId: u.userId, requestId: s.requestId, startedAt: Date.now() }),
    (e) => e.code === "RECEIPT_WRITE_FAILED",
  );
  assert.equal(
    h.db.sql.prepare("SELECT COUNT(*) AS n FROM agent_runs WHERE request_id=?").get(s.requestId).n,
    0,
  );
});

test("receipt database failures discard already read evidence", async () => {
  const u = await user("receipt-fail");
  await capture(u, "I prefer silent answers.");
  const s = await session(u, {
    model: scripted([turn("search_personal_memory", { query: "silent" }), final()]),
  });
  h.db.setFailPattern(/UPDATE agent_execution_receipts/);
  try {
    const r = await s.run();
    noDisclosure(r);
    assert.equal(r.errorCode, "RECEIPT_WRITE_FAILED");
  } finally {
    h.db.setFailPattern(null);
  }
});

test("unknown tools, injected argument ownership and repeated calls stay denied and bounded", async () => {
  const u = await user("adversary");
  await capture(u, "I prefer safe answers.");
  const malicious = await session(u, {
    model: scripted([
      turn("search_personal_memory", { query: "safe" }),
      turn("send_email", { to: "attacker@example.test" }),
      final("Email sent! [E1]"),
    ]),
  });
  const a = await malicious.run();
  assert.ok(a.receipts.some((r) => r.errorCode === "UNKNOWN_TOOL"));
  assert.notEqual(a.answerSource, "model");
  assert.doesNotMatch(a.answer ?? "", /Email sent/);
  const owner = await session(u, {
    model: scripted([turn("search_personal_memory", { query: "safe", userId: "other" }), final()]),
  });
  assert.equal((await owner.run()).receipts[0].errorCode, "INVALID_ARGUMENTS");
  const duplicate = await session(u, {
    model: scripted([
      turn("search_personal_memory", { query: "safe" }, "same"),
      turn("search_personal_memory", { query: "safe" }, "same"),
      final(),
    ]),
  });
  const b = await duplicate.run();
  assert.equal(b.toolExecutions, 1);
  assert.equal(b.receipts[1].errorCode, "DUPLICATE_CALL_ID");
  const endless = await session(u, {
    model: { respond: async () => turn("search_personal_memory", { query: "safe" }) },
  });
  const c = await endless.run();
  assert.equal(c.iterations, 3);
  assert.ok(c.toolExecutions <= 5);
  assert.equal(c.receipts.at(-1).errorCode, "ITERATION_LIMIT_EXCEEDED");
});

test("integrated search preserves unimported legacy and unrelated residual documents", async () => {
  const u = await user("legacy-agent");
  let a = await h.call("legacy-agent");
  a = await h.call("legacy-agent", {
    action: "memory.add",
    version: a.version,
    text: "The beryl notebook is on the desk.",
    category: "Context",
  });
  a = await h.call("legacy-agent", {
    action: "document.add",
    version: a.version,
    name: "Document",
    text: "I prefer Monday meetings.\nThe zebrafish record is in cabinet C.",
  });
  const imported = await mutation(u, {
    action: "importLegacy",
    kind: "document",
    id: a.state.documents[0].id,
  });
  await mutation(u, {
    action: "confirm",
    id: imported.snapshot.records.find((r) => r.kind === "fact").id,
  });
  for (const query of ["beryl", "zebrafish"]) {
    const s = await session(u, {
        model: scripted([turn("search_personal_memory", { query }), final()]),
      }),
      r = await s.run();
    assert.ok(r.sources.some((x) => x.excerpt.includes(query)));
  }
});

test("local evidence-only tool failure is an error, never a successful empty recall", async () => {
  const u = await user("local-timeout"),
    s = await session(u, {
      model: scripted([turn("search_personal_memory", { query: "x" }), final("")]),
      limits: { totalDeadlineMs: 1000, auditReserveMs: 300, toolTimeoutMs: 20 },
    });
  const tool = s.deps.registry.get("search_personal_memory");
  s.deps.registry = m("tool-registry").createToolRegistry([
    { ...tool, execute: () => new Promise(() => {}) },
  ]);
  s.deps.evidenceOnly = true;
  const result = await s.run();
  noDisclosure(result);
  assert.equal(result.errorCode, "TOOL_TIMEOUT");
  assert.equal(result.receipts[0].status, "timed_out");
});

test("valid long procedures fail with a size limit instead of disappearing", async () => {
  const u = await user("long-procedure"),
    steps = ["Review ".repeat(215), "Check ".repeat(250), "Prepare ".repeat(190)];
  const text = `Long Checklist: ${steps.join("\n")}`;
  const proposed = await mutation(u, {
    action: "propose",
    text,
    quote: "Long Checklist",
    label: "Synthetic long procedure",
    content: {
      kind: "procedure",
      title: "Long Checklist",
      workflowKey: "Long Checklist",
      steps,
      basisIds: [],
      status: "candidate",
    },
  });
  const record = proposed.snapshot.records.find((r) => r.kind === "procedure");
  await mutation(u, { action: "confirm", id: record.id });
  await mutation(u, { action: "activate", id: record.id });
  const full = await svc.searchIntelligence(
    u,
    { kind: "procedure", query: "Long Checklist" },
    h.db.d1,
  );
  assert.equal(full.status, "ok");
  assert.ok(full.results[0].text.length > 4000);
  const r = await h.agentCall("long-procedure", {
    requestId: crypto.randomUUID(),
    tool: "retrieve_procedure",
    args: { query: "Long Checklist" },
  });
  assert.equal(r.httpStatus, 503);
  assert.equal(r.text, null);
  assert.deepEqual(r.sources, []);
  assert.equal(r.execution.status, "failed");
  assert.equal(r.execution.errorCode, "TOOL_RESULT_TOO_LARGE");
  assert.equal(r.execution.receipts[0].status, "failed");
  assert.equal(r.execution.receipts[0].errorCode, "TOOL_RESULT_TOO_LARGE");
});

const modelEnv = {
  TWIN_AGENT_ENDPOINT: "http://127.0.0.1:8080/v1/chat/completions",
  TWIN_AGENT_MODEL: "synthetic-contract-test",
};
const chatResponse = (message) =>
  Response.json({
    choices: [{ finish_reason: "stop", message }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
test("model HTTP mode executes verified tools and persists receipts through the chat adapter", async () => {
  const u = await user("model-http", true);
  await capture(u, "I prefer concise answers.");
  const original = globalThis.fetch;
  Object.assign(h.env, modelEnv);
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) !== modelEnv.TWIN_AGENT_ENDPOINT) return original(url, options);
    calls++;
    assert.equal(options.redirect, "manual");
    const body = JSON.parse(options.body);
    assert.equal(body.model, modelEnv.TWIN_AGENT_MODEL);
    assert.equal(body.tools.length, 5);
    if (calls === 1)
      return chatResponse({
        content: null,
        tool_calls: [
          {
            id: "lookup",
            type: "function",
            function: { name: "search_personal_memory", arguments: '{"query":"concise"}' },
          },
        ],
      });
    const observation = JSON.parse(body.messages.find((x) => x.role === "tool").content);
    assert.ok(observation.evidence.some((e) => e.content.includes("concise")));
    return chatResponse({ content: "You prefer concise answers [E1]." });
  };
  try {
    const r = await h.agentCall("model-http", {
      mode: "model",
      message: "What answers do I prefer?",
      requestId: crypto.randomUUID(),
    });
    assert.equal(r.httpStatus, 200, JSON.stringify(r));
    assert.equal(r.execution.planner, "chat-completions");
    assert.equal(r.execution.grounding, "cited");
    assert.equal(r.execution.receipts[0].status, "succeeded");
    assert.equal(calls, 2);
    calls = 0;
    const viaChat = await h.call(
      "model-http",
      { mode: "ai", message: "What answers do I prefer?", requestId: crypto.randomUUID() },
      undefined,
      true,
    );
    assert.equal(viaChat.status, 200, JSON.stringify(viaChat));
    assert.equal(viaChat.execution.planner, "chat-completions");
    assert.equal(viaChat.execution.grounding, "cited");
    assert.equal(
      h.db.sql
        .prepare("SELECT status FROM agent_runs WHERE request_id=?")
        .get(r.execution.requestId).status,
      "completed",
    );
  } finally {
    globalThis.fetch = original;
    for (const key of Object.keys(modelEnv)) delete h.env[key];
  }
});

test("model mode denies absent consent and request-selected destinations before disclosure", async () => {
  const u = await user("model-denied");
  let calls = 0;
  const network = async () => {
    calls++;
    return chatResponse({ content: "x" });
  };
  const input = { mode: "model", message: "x", requestId: crypto.randomUUID() };
  await assert.rejects(
    () => m("model-run").runModelIntelligence(u, input, h.db.d1, modelEnv, network),
    (e) => e.code === "AUTHORIZATION_REVOKED",
  );
  await assert.rejects(() =>
    m("model-run").runModelIntelligence(
      u,
      { ...input, endpoint: "https://attacker.test" },
      h.db.d1,
      modelEnv,
      network,
    ),
  );
  assert.equal(calls, 0);
  assert.equal((await h.agentCall("model-denied", input)).httpStatus, 503);
});

test("model route cannot release unsupported personal claims or post-revocation answers", async () => {
  const u = await user("model-claims", true);
  const run = (fn) =>
    m("model-run").runModelIntelligence(
      u,
      { mode: "model", message: "What is my secret preference?", requestId: crypto.randomUUID() },
      h.db.d1,
      modelEnv,
      fn,
    );
  const unsupported = await run(async () =>
    chatResponse({ content: "Your secret preference is fictional." }),
  );
  assert.equal(unsupported.body.execution.grounding, "no_evidence");
  assert.doesNotMatch(unsupported.body.text, /fictional/);
  const revoked = await run(async () => {
    const a = await h.call("model-claims");
    await h.call("model-claims", {
      action: "profile.update",
      name: "Synthetic",
      aiConsent: false,
      version: a.version,
    });
    return chatResponse({ content: "Do not disclose this stale answer." });
  });
  assert.equal(revoked.status, 409);
  assert.equal(revoked.body.text, null);
  assert.equal(revoked.body.execution.errorCode, "AUTHORIZATION_REVOKED");
});

test("chat adapter rejects unsafe destinations, malformed calls and oversized streamed responses", async () => {
  const adapter = m("chat-completions-adapter");
  for (const endpoint of [
    "http://remote.test/v1",
    "file:///tmp/x",
    "https://user:secret@host.test/v1",
    "https://host.test/v1?key=x",
  ])
    assert.throws(() => adapter.createChatCompletionsModel({ endpoint, model: "x" }));
  assert.throws(
    () =>
      adapter.parseChatCompletionsBody({
        choices: [{ message: { tool_calls: [{ id: "x", function: { name: "read" } }] } }],
      }),
    (e) => e.code === "MODEL_MALFORMED_RESPONSE",
  );
  let cancelled = false;
  const model = adapter.createChatCompletionsModel({
    endpoint: modelEnv.TWIN_AGENT_ENDPOINT,
    model: "x",
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new Uint8Array(600000));
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  await assert.rejects(
    () =>
      model.respond(
        { instructions: "x", items: [], tools: [], toolChoice: "none", maxOutputTokens: 10 },
        new AbortController().signal,
      ),
    (e) => e.code === "MODEL_MALFORMED_RESPONSE",
  );
  assert.equal(cancelled, true);
});

test("model redirects fail closed without following a second destination", async () => {
  let calls = 0;
  const model = m("chat-completions-adapter").createChatCompletionsModel({
    endpoint: modelEnv.TWIN_AGENT_ENDPOINT,
    model: "test",
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.redirect, "manual");
      return new Response(null, { status: 302, headers: { Location: "https://attacker.test" } });
    },
  });
  await assert.rejects(
    () =>
      model.respond(
        { instructions: "x", items: [], tools: [], toolChoice: "none", maxOutputTokens: 10 },
        new AbortController().signal,
      ),
    (e) => e.code === "MODEL_UNAVAILABLE",
  );
  assert.equal(calls, 1);
});
