// Real workerd, Web Crypto, remote-JWKS verifier, Drizzle and local D1.
// Only Next's request-header context and the external Access JWKS are emulated.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
const wranglerRequire = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = await import(wranglerRequire.resolve("esbuild"));
const { Miniflare, Log, LogLevel } = await import(wranglerRequire.resolve("miniflare"));

test("Cloudflare Worker HTTP identity boundary and D1 account isolation", async () => {
  const dir = path.resolve(".sites-runtime/worker-security");
  await fs.mkdir(dir, { recursive: true });
  const contextFile = path.join(dir, "context.mjs");
  await fs.writeFile(
    contextFile,
    `import {AsyncLocalStorage} from 'node:async_hooks';
    export const context=new AsyncLocalStorage();export const headers=async()=>context.getStore();`,
  );
  const entry = path.join(dir, "entry.mjs");
  await fs.writeFile(
    entry,
    `import {context} from './context.mjs';
    import * as agent from '@/app/api/agent/route';
    import * as intelligence from '@/app/api/intelligence/route';
    import * as twin from '@/app/api/twin/route';import * as chat from '@/app/api/chat/route';
    export default {fetch(request){return context.run(request.headers,()=>
      new URL(request.url).pathname==='/api/agent'?agent.POST(request):
      new URL(request.url).pathname==='/api/intelligence'?(request.method==='POST'?intelligence.POST(request):intelligence.GET()):
      new URL(request.url).pathname==='/api/chat'?chat.POST(request):
      request.method==='POST'?twin.POST(request):twin.GET());}};`,
  );
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    alias: { "@": process.cwd(), "next/headers": contextFile },
    external: ["cloudflare:workers", "node:async_hooks"],
  });
  const pair = await generateKeyPair("RS256", { extractable: true });
  const wrong = await generateKeyPair("RS256");
  const key = {
    ...(await exportJWK(pair.publicKey)),
    alg: "RS256",
    use: "sig",
    kid: "worker-test",
  };
  const issuer = "https://worker-test.cloudflareaccess.com",
    audience = "c".repeat(64);
  let networkCalls = 0;
  const mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    log: new Log(LogLevel.ERROR),
    bindings: {
      TWIN_AUTH_PROVIDER: "cloudflare-access",
      TWIN_AUTH_ISSUER: issuer,
      TWIN_AUTH_AUDIENCE: audience,
    },
    outboundService: async (request) => {
      assert.equal(request.url, `${issuer}/cdn-cgi/access/certs`);
      networkCalls++;
      return Response.json({ keys: [key] });
    },
  });
  try {
    const db = await mf.getD1Database("DB");
    for (const file of (await fs.readdir("drizzle")).filter((f) => f.endsWith(".sql")).sort()) {
      const migration = await fs.readFile("drizzle/" + file, "utf8");
      for (const statement of migration.split("--> statement-breakpoint"))
        await db.prepare(statement.trim()).run();
      if (file === "0000_last_chameleon.sql")
        await db
          .prepare(
            "INSERT INTO twin_accounts(user_id,state,version) VALUES('migration-control','{\"synthetic\":true}',7)",
          )
          .run();
      if (file === "0001_persistent_intelligence.sql")
        await db
          .prepare(
            "INSERT INTO twin_intelligence_records(owner,generation,id,kind,source_id,content,quote,created_at,updated_at,confirmation,validity,valid_from,privacy,version) SELECT owner,generation,'11111111-1111-4111-8111-111111111111','source','11111111-1111-4111-8111-111111111111','{\"upgradeControl\":true}','','2026-01-01','2026-01-01','proposed','valid','2026-01-01','private',0 FROM twin_intelligence_heads WHERE owner='migration-control'",
          )
          .run();
    }
    assert.equal(
      (
        await db
          .prepare("SELECT content FROM twin_intelligence_records WHERE owner='migration-control'")
          .first()
      ).content,
      '{"upgradeControl":true}',
    );
    async function token(subject, claims = {}, signer = pair.privateKey) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({
        iss: issuer,
        aud: [audience],
        sub: subject,
        type: "app",
        iat: now,
        nbf: now,
        exp: now + 300,
        ...claims,
      })
        .setProtectedHeader({ alg: "RS256", kid: "worker-test", typ: "JWT" })
        .sign(signer);
    }
    async function request(assertion, payload, extra = {}, endpoint = "twin") {
      const r = await mf.dispatchFetch(`https://direct-worker.test/api/${endpoint}`, {
        method: payload ? "POST" : "GET",
        headers: {
          Origin: "https://direct-worker.test",
          ...(assertion ? { "Cf-Access-Jwt-Assertion": assertion } : {}),
          ...extra,
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      return { status: r.status, ...(await r.json()) };
    }
    const migrated = await db
      .prepare(
        "SELECT state,version,generation FROM twin_accounts WHERE user_id='migration-control'",
      )
      .first();
    assert.equal(migrated.state, '{\"synthetic\":true}');
    assert.equal(migrated.version, 7);
    assert.ok(migrated.generation);
    assert.equal(
      (
        await db
          .prepare("SELECT generation FROM twin_intelligence_heads WHERE owner='migration-control'")
          .first()
      ).generation,
      migrated.generation,
    );
    await db.prepare("DELETE FROM twin_accounts WHERE user_id='migration-control'").run();
    assert.equal((await request()).status, 401);
    assert.equal(
      (
        await request(null, undefined, {
          "oai-authenticated-user-id": "a",
          "oai-authenticated-user-email": "a@example.test",
        })
      ).status,
      401,
    );
    for (const jwt of [
      await token("a", { exp: 1 }),
      await token("a", { iss: "https://evil.test" }),
      await token("a", { aud: ["wrong"] }),
      await token("a", {}, wrong.privateKey),
    ]) {
      assert.equal((await request(jwt)).status, 401);
    }
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM twin_accounts").first()).n, 0);
    const jwtA = await token("a"),
      jwtB = await token("b");
    let a = await request(jwtA, { action: "initialize", name: "Worker Alice" });
    assert.equal(a.status, 200);
    a = await request(jwtA, {
      action: "memory.add",
      text: "Worker synthetic secret",
      category: "Context",
      version: a.version,
    });
    const b = await request(jwtB, { action: "initialize", name: "Worker Bob" });
    const isolated = await request(jwtB, undefined, {
      "oai-authenticated-user-id": "a",
      "oai-authenticated-user-email": "a@example.test",
    });
    assert.equal(isolated.state.name, "Worker Bob");
    assert.doesNotMatch(JSON.stringify(isolated), /Worker synthetic secret/);
    assert.equal(
      (
        await request(jwtB, {
          action: "memory.delete",
          id: a.state.memories[0].id,
          version: b.version,
        })
      ).status,
      404,
    );
    // New graph routes use the same real JWT adapter on direct Worker access.
    const intel = (jwt, payload, headers = {}) => request(jwt, payload, headers, "intelligence");
    assert.equal((await intel(null)).status, 401);
    assert.equal((await intel(null, undefined, { "oai-authenticated-user-id": "a" })).status, 401);
    const before = await intel(jwtA);
    const writes = await Promise.all(
      ["cobalt", "copper"].map((value) =>
        intel(jwtA, {
          action: "capture",
          epoch: before.epoch,
          text: `I prefer ${value} answers.`,
          label: "Worker synthetic",
        }),
      ),
    );
    assert.deepEqual(writes.map((r) => r.status).sort(), [200, 409]);
    let graph = await intel(jwtA);
    const fact = graph.records.find((r) => r.kind === "fact");
    assert.equal(
      (await intel(jwtA, { action: "confirm", epoch: graph.epoch, id: fact.id })).status,
      200,
    );
    graph = await intel(jwtA);
    const runId = crypto.randomUUID();
    const agentResult = await request(
      jwtA,
      { requestId: runId, tool: "search_personal_memory", args: { query: "answers" } },
      {},
      "agent",
    );
    assert.equal(agentResult.status, 200, JSON.stringify(agentResult));
    assert.equal(agentResult.execution.receipts[0].status, "succeeded");
    assert.equal(agentResult.execution.planner, "deterministic-local");
    assert.equal(
      (await db.prepare("SELECT status FROM agent_runs WHERE request_id=?").bind(runId).first())
        .status,
      "completed",
    );
    assert.equal(
      (
        await request(
          null,
          {
            requestId: crypto.randomUUID(),
            tool: "search_personal_memory",
            args: { query: "answers" },
          },
          { "oai-authenticated-user-id": "a" },
          "agent",
        )
      ).status,
      401,
    );

    const other = await intel(jwtB);
    assert.equal(
      (
        await intel(jwtB, {
          action: "forget",
          epoch: other.epoch,
          id: fact.id,
          confirmation: "FORGET EVIDENCE",
        })
      ).status,
      404,
    );
    assert.equal(
      (await intel(jwtB, { action: "search", query: { query: "answers" } })).results.length,
      0,
    );
    assert.equal(
      (await intel(jwtA, { action: "search", query: { query: "answers" } })).results.length,
      1,
    );
    const owner = (
      await db
        .prepare("SELECT owner FROM twin_intelligence_records WHERE id=?")
        .bind(fact.id)
        .first()
    ).owner;
    // Inject a real SQLite trigger failure after the CAS write. Entire D1.batch rolls back.
    await db
      .prepare(
        "CREATE TRIGGER test_reject BEFORE INSERT ON twin_intelligence_dependencies BEGIN SELECT RAISE(ABORT,'synthetic failure'); END",
      )
      .run();
    const failed = await intel(jwtA, {
      action: "capture",
      epoch: graph.epoch,
      text: "I prefer green meetings.",
      label: "Rollback control",
    });
    assert.equal(failed.status, 503);
    assert.equal((await intel(jwtA)).epoch, graph.epoch);
    await db.prepare("DROP TRIGGER test_reject").run();
    assert.equal(
      (
        await intel(jwtA, {
          action: "forget",
          epoch: graph.epoch,
          id: fact.id,
          confirmation: "FORGET EVIDENCE",
        })
      ).status,
      200,
    );
    assert.equal(
      (await intel(jwtA, { action: "search", query: { query: "answers" } })).results.length,
      0,
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM twin_intelligence_records WHERE owner=? AND content IS NOT NULL",
          )
          .bind(owner)
          .first()
      ).n,
      0,
    );
    const updates = await Promise.all(
      ["first", "second"].map((title) =>
        request(jwtA, { action: "task.add", title, due: null, version: a.version }),
      ),
    );
    assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (
        await request(jwtB, {
          action: "erase",
          confirmation: "DELETE MY DATA",
          userId: "a",
          version: b.version,
        })
      ).status,
      200,
    );
    assert.equal((await request(jwtA)).state.memories[0].text, "Worker synthetic secret");
    const current = await request(jwtA);
    assert.equal(
      (
        await request(jwtA, {
          action: "erase",
          confirmation: "DELETE MY DATA",
          version: current.version,
        })
      ).status,
      200,
    );
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM twin_accounts").first()).n, 0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM agent_runs").first()).n, 0);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM agent_execution_receipts").first()).n,
      0,
    );
    assert.ok(networkCalls >= 1);
  } finally {
    await mf.dispose();
  }
});
