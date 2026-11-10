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

test('incomplete provider tool selection cannot execute even with valid JSON arguments', async () => {
  const u=await user('incomplete-selection');
  await capture(u,'I prefer concise answers.');
  const s=await session(u,{model:scripted([{...turn('search_personal_memory',{query:'concise'}),truncated:true,usage:{inputTokens:10,outputTokens:5}}])});
  const r=await s.run();noDisclosure(r);
  assert.equal(r.errorCode,'MODEL_INCOMPLETE_RESPONSE');assert.equal(r.toolExecutions,0);
  assert.equal(h.db.sql.prepare('SELECT count(*) n FROM agent_execution_receipts WHERE request_id=?').get(s.requestId).n,0);
  const run=h.db.sql.prepare('SELECT status,error_code,output_tokens FROM agent_runs WHERE request_id=?').get(s.requestId);
  assert.equal(run.status,'failed');assert.equal(run.error_code,'MODEL_INCOMPLETE_RESPONSE');assert.equal(run.output_tokens,5);
});

test('incomplete cited answer fails closed after a real authorized evidence read', async () => {
  const u=await user('incomplete-answer');await capture(u,'I prefer concise answers.');
  const s=await session(u,{model:scripted([turn('search_personal_memory',{query:'concise'}),{...final('You prefer concise answers [E1].'),truncated:true}])});
  const r=await s.run();noDisclosure(r);assert.equal(r.errorCode,'MODEL_INCOMPLETE_RESPONSE');
  assert.equal(r.receipts.length,1);assert.equal(r.receipts[0].status,'succeeded');
  const run=h.db.sql.prepare('SELECT status,error_code FROM agent_runs WHERE request_id=?').get(s.requestId);
  assert.equal(run.status,'failed');assert.equal(run.error_code,'MODEL_INCOMPLETE_RESPONSE');
});

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

test('HTTP model mode rejects truncated and filtered responses with persisted failed runs', async () => {
  for(const reason of ['length','content_filter']) for(const phase of ['selection','answer']) {
    // Each independent case has its own synthetic account; keep real admission limits intact.
    const u=await user(`terminal-${reason}-${phase}`,true);await capture(u,'I prefer concise answers.');
    const requestId=crypto.randomUUID();let calls=0;
    const result=await m('model-run').runModelIntelligence(u,{mode:'model',requestId,message:'Find my concise preference'},h.db.d1,modelEnv,async()=>{
      calls++;const selecting=calls===1;
      return Response.json({choices:[{finish_reason:(phase==='selection'||!selecting)?reason:'tool_calls',message:selecting?
        {content:null,tool_calls:[{id:'terminal-lookup',type:'function',function:{name:'search_personal_memory',arguments:'{"query":"concise"}'}}]}:
        {content:'You prefer concise answers [E1].'}}],usage:{prompt_tokens:10,completion_tokens:5}});
    });
    assert.equal(result.status,503);assert.equal(result.body.text,null);assert.deepEqual(result.body.sources,[]);
    assert.equal(result.body.execution.errorCode,'MODEL_INCOMPLETE_RESPONSE');
    assert.equal(calls,phase==='selection'?1:2);
    const receipts=h.db.sql.prepare('SELECT status FROM agent_execution_receipts WHERE request_id=?').all(requestId);
    assert.equal(receipts.length,phase==='selection'?0:1);assert.ok(receipts.every(r=>r.status==='succeeded'));
    const run=h.db.sql.prepare('SELECT status,error_code,output_tokens FROM agent_runs WHERE request_id=?').get(requestId);
    assert.equal(run.status,'failed');assert.equal(run.error_code,'MODEL_INCOMPLETE_RESPONSE');assert.equal(run.output_tokens,5*calls);
    assert.doesNotMatch(JSON.stringify(run),/concise/);
  }
});

test('chat protocol requires a recognized terminal reason without treating truncated prefixes as complete', () => {
  const parse=m('chat-completions-adapter').parseChatCompletionsBody;
  for(const reason of [undefined,null,'','in_progress','function_call','SYNTHETIC_PRIVATE_ERROR']) {
    assert.throws(()=>parse({choices:[{finish_reason:reason,message:{content:'Unverified'}}]}),e=>e.code==='MODEL_MALFORMED_RESPONSE'&&!e.message.includes('SYNTHETIC'));
  }
  assert.throws(()=>parse({choices:[{finish_reason:'tool_calls',message:{content:'Done'}}]}),e=>e.code==='MODEL_MALFORMED_RESPONSE');
  for(const reason of ['length','content_filter']) assert.equal(parse({choices:[{finish_reason:reason,message:{content:'Prefix'}}]}).truncated,true);
  assert.equal(parse({choices:[{finish_reason:'stop',message:{content:'Complete'}}]}).truncated,false);
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

const transportRequest={instructions:'Synthetic',items:[],tools:[],toolChoice:'none',maxOutputTokens:10};
test('synchronous transport abort and exception cannot leave an unhandled rejection', async () => {
  const controller=new AbortController();
  const model=m('chat-completions-adapter').createChatCompletionsModel({endpoint:modelEnv.TWIN_AGENT_ENDPOINT,model:'synthetic',fetchImpl:()=>{
    controller.abort();throw Error('SYNTHETIC_PRIVATE_TRANSPORT_DETAIL');
  }});
  await assert.rejects(()=>model.respond(transportRequest,controller.signal),e=>e.code==='MODEL_TIMEOUT'&&!e.message.includes('SYNTHETIC'));
  // Let Node's test runner observe any unhandled abort-promise rejection.
  await new Promise(r=>setImmediate(r));
});
test('chat transport skips pre-aborted requests and cancels rejected HTTP bodies', async () => {
  const adapter=m('chat-completions-adapter');let calls=0;
  const aborted=new AbortController();aborted.abort();
  const pre=adapter.createChatCompletionsModel({endpoint:modelEnv.TWIN_AGENT_ENDPOINT,model:'synthetic',fetchImpl:async()=>{calls++;return chatResponse({content:'Complete'});}});
  await assert.rejects(()=>pre.respond(transportRequest,aborted.signal),e=>e.code==='MODEL_TIMEOUT');assert.equal(calls,0);
  for(const status of [302,401,503]) {
    let cancelled=false;
    const model=adapter.createChatCompletionsModel({endpoint:modelEnv.TWIN_AGENT_ENDPOINT,model:'synthetic',fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{status})});
    await assert.rejects(()=>model.respond(transportRequest,new AbortController().signal),e=>e.code==='MODEL_UNAVAILABLE');
    assert.equal(cancelled,true,`unread ${status} response must be cancelled`);
  }
});

test('chat transport abort settles stalled reads and cancels late fetch responses', async () => {
  const adapter=m('chat-completions-adapter');
  for(const phase of ['body','fetch']) {
    let cancelled=false,resolveFetch,streamController;const controller=new AbortController();
    const response=new Response(new ReadableStream({start(c){streamController=c;},cancel(){cancelled=true;}}));
    const model=adapter.createChatCompletionsModel({endpoint:modelEnv.TWIN_AGENT_ENDPOINT,model:'synthetic',fetchImpl:()=>phase==='body'?Promise.resolve(response):new Promise(r=>{resolveFetch=r;})});
    const pending=model.respond(transportRequest,controller.signal).then(()=> 'UNEXPECTED_SUCCESS',e=>e.code);
    await new Promise(r=>setImmediate(r));controller.abort();
    let timer;const result=await Promise.race([pending,new Promise(r=>{timer=setTimeout(()=>r('DID_NOT_STOP'),200);})]);clearTimeout(timer);
    if(resolveFetch)resolveFetch(response);
    await new Promise(r=>setImmediate(r));
    if(!cancelled)streamController.close();
    assert.equal(result,'MODEL_TIMEOUT',phase);assert.equal(cancelled,true,phase);
  }
});

test('chat transport does not wait indefinitely for an oversized stream cancellation', async () => {
  let cancelled=false;
  const model=m('chat-completions-adapter').createChatCompletionsModel({endpoint:modelEnv.TWIN_AGENT_ENDPOINT,model:'synthetic',fetchImpl:async()=>new Response(new ReadableStream({
    pull(c){c.enqueue(new Uint8Array(600000));},cancel(){cancelled=true;return new Promise(()=>{});}
  }))});
  let timer;
  const result=await Promise.race([model.respond(transportRequest,new AbortController().signal).then(()=> 'UNEXPECTED_SUCCESS',e=>e.code),new Promise(r=>{timer=setTimeout(()=>r('DID_NOT_STOP'),200);})]);clearTimeout(timer);
  assert.equal(result,'MODEL_MALFORMED_RESPONSE');assert.equal(cancelled,true);
});

test('evidence-required model requests a lookup first and still abstains if provider ignores it', async () => {
  const u = await user('required-lookup');
  const model = scripted([final('Invented personal answer')]);
  const s = await session(u, {model});
  s.deps.requireEvidence = true;
  const r = await s.run();
  assert.equal(model.calls[0].toolChoice, 'required');
  assert.equal(r.grounding, 'no_evidence');
  assert.notEqual(r.answer, 'Invented personal answer');
});

test('provider tool schemas expose the same status enum and text bounds enforced by execution', () => {
  const registry=m('intelligence-tools').createIntelligenceRegistry(h.db.d1);
  const properties=registry.get('find_commitments').parameters.properties;
  assert.deepEqual(properties.status.enum,['active','confirmed','completed','overdue','no-deadline','follow-up']);
  assert.equal(properties.person.maxLength,160);
  assert.equal(registry.get('search_personal_memory').parameters.properties.query.maxLength,500);
});

test('model lookup denied by schema is a failed run, not successful missing evidence', async () => {
 const u=await user('denied-lookup');
 const s=await session(u,{model:scripted([turn('find_commitments',{status:'invented',person:'',project:''}),final('No commitments found')])});
 s.deps.requireEvidence=true;
 const r=await s.run();
 assert.equal(r.status,'failed');assert.equal(r.errorCode,'INVALID_ARGUMENTS');assert.equal(r.answer,null);
 assert.equal(r.receipts[0].status,'denied');
});

test('server-selected initial lookup maps to a named function without granting additional authority', async () => {
 const u=await user('initial-tool');
 const model=scripted([turn('send_email',{}),final('Sent')]);
 const s=await session(u,{model});s.deps.requireEvidence=true;s.deps.initialTool='search_personal_memory';
 const r=await s.run();
 assert.deepEqual(model.calls[0].toolChoice,{name:'search_personal_memory'});
 assert.equal(r.receipts[0].errorCode,'UNKNOWN_TOOL');assert.equal(r.answer,null);
 const body=m('chat-completions-adapter').buildChatCompletionsBody('synthetic',model.calls[0]);
 assert.deepEqual(body.tool_choice,{type:'function',function:{name:'search_personal_memory'}});
 assert.equal(body.tools.length,5);
});

test('valid citation cannot launder a fabricated numeric budget into a personal answer', async () => {
  const u = await user('numeric-budget');
  await capture(u, 'I prefer the amber folder for the Orion budget spreadsheet.');
  const s = await session(u, { model: scripted([
    turn('search_personal_memory', { query: 'Orion budget' }),
    final('Your Orion budget is INR 9000000 [E1].'),
  ]) });
  const r = await s.run();
  assert.equal(r.errorCode, 'GROUNDING_UNSUPPORTED_NUMBER');
  assert.equal(r.answerSource, 'runtime_evidence_fallback');
  assert.doesNotMatch(r.answer, /9000000/);
  assert.equal(r.receipts[0].status, 'succeeded');
});

test('numeric grounding keeps values atomic and does not borrow metadata or uncited sources', () => {
  const {createEvidenceLedger, verifyCitations, hasSupportedNumericLiterals} = m('evidence');
  const ledger = createEvidenceLedger();
  ledger.add([
    {sourceId:'memory:one',kind:'memory',label:'Misleading label INR 9000000',createdAt:2026,updatedAt:2027,
      excerpt:'Budget INR 20 million; rate 5%; departure 18:15; deadline 2026-12-01T10:00:00Z; balance -20; charge $50. The reference is 2e3.'},
    {sourceId:'memory:two',kind:'memory',label:'Other',createdAt:1,updatedAt:1,excerpt:'Unrelated cost INR 9000000.'},
  ]);
  const check = (answer) => {const c=verifyCitations(answer,ledger);return c.kind==='cited' && hasSupportedNumericLiterals(answer,c.cited);};
  for (const answer of ['Budget INR 20 million [E1].','Rate 5% [E1].','Departure 18:15 [E1].',
    'Deadline 2026-12-01T10:00:00Z [E1].','Balance -20 [E1].','Charge $50 [E1].','Reference 2e3 [E1].',
    'Budget ＩＮＲ ２０ million [E1].','Budget INR 2\u200b0 million [E1].','No numeric assertion [E1].'])
    assert.equal(check(answer),true,answer);
  for (const answer of ['Budget INR 9000000 [E1].','Budget INR 20 billion [E1].','Budget USD 20 million [E1].',
    'Rate 50% [E1].','Departure 15:18 [E1].','Deadline 2026-01-12T10:00:00Z [E1].',
    'Balance +20 [E1].','Charge ₹50 [E1].','Charge -$50 [E1].','Charge $-50 [E1].',
    'Charge - $50 [E1].','Reference 2e6 [E1].','Value 2027 [E1].',
    '[E1, INR 9000000]','Budget INR ９００００００ [E1].','Budget INR 9\u200b000000 [E1].'])
    assert.equal(check(answer),false,answer);
  assert.equal(check('Cost INR 9000000 [E2].'),true);
});

test('numeric grounding rejects novel values across a deterministic mutation set', () => {
  const {hasSupportedNumericLiterals} = m('evidence');
  for(let value=11;value<=60;value++) {
    const cited=[{citation:'E1',excerpt:`The budget is INR ${value} million.`}];
    assert.equal(hasSupportedNumericLiterals(`Budget INR ${value} million [E1].`,cited),true);
    assert.equal(hasSupportedNumericLiterals(`Budget INR ${value+100} million [E1].`,cited),false);
    assert.equal(hasSupportedNumericLiterals(`Budget INR ${value} billion [E1].`,cited),false);
  }
});

test('numeric fallback retains authorization and fails closed if its run receipt cannot be saved', async () => {
  const u=await user('numeric-receipt');await capture(u,'I prefer amber folders.');
  const s=await session(u,{model:scripted([turn('search_personal_memory',{query:'amber'}),final('Budget INR 9000000 [E1].')])});
  h.db.setFailPattern(/UPDATE agent_runs/);
  try{const r=await s.run();noDisclosure(r);assert.equal(r.errorCode,'RECEIPT_WRITE_FAILED');}
  finally{h.db.setFailPattern(null);}
});

test('numeric grounding records only a sanitized reason in the run receipt', async () => {
  const u=await user('numeric-audit');await capture(u,'I prefer amber folders.');
  const s=await session(u,{model:scripted([turn('search_personal_memory',{query:'amber'}),final('Budget INR 9000000 [E1].')])});
  const r=await s.run();assert.equal(r.errorCode,'GROUNDING_UNSUPPORTED_NUMBER');
  const row=h.db.sql.prepare('SELECT * FROM agent_runs WHERE request_id=?').get(s.requestId);
  assert.equal(row.error_code,'GROUNDING_UNSUPPORTED_NUMBER');
  assert.doesNotMatch(JSON.stringify(row),/9000000|amber|folders/);
});
