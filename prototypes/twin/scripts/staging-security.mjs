// Adapted from P0-004 commit 98174493e4a2b242a3b8eb8385f7ac41e13ea4aa.
// No deployment, migrations, identity-setting changes, or production writes are performed here.
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";


class CheckFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

// One deadline covers fetch AND body consumption. Never follow redirects carrying
// credentials, buffer an unbounded body, or serialize external exception text.
export async function requestJSON(url, init, transport = fetch, { timeoutMs = 15_000, maxBytes = 1_000_000 } = {}) {
  const controller = new AbortController();
  let reader, timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new CheckFailure("REQUEST_TIMEOUT")); }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await transport(url, { ...init, redirect: "manual", signal: controller.signal });
      if (controller.signal.aborted) {
        if (response.body) void response.body.cancel().catch(() => {});
        throw new CheckFailure("REQUEST_TIMEOUT");
      }
      reader = response.body?.getReader();
      const parts = []; let length = 0;
      if (reader) for (;;) {
        const { done, value } = await reader.read();
        if (controller.signal.aborted) throw new CheckFailure("REQUEST_TIMEOUT");
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) throw new CheckFailure("RESPONSE_TOO_LARGE");
        parts.push(Buffer.from(value));
      }
      let body;
      try { body = JSON.parse(Buffer.concat(parts, length).toString("utf8")); }
      catch { body = {}; }
      if (!body || typeof body !== "object" || Array.isArray(body)) body = {};
      return { status: response.status, body };
    })()]);
  } finally {
    clearTimeout(timer); controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
}
const isOwned = (view, owned) => Boolean(owned && view.status === 200 &&
  view.body.state?.name === owned.name && view.body.generation === owned.generation &&
  view.body.version === owned.version);
// D1 migration 0001 creates generation with lower(hex(randomblob(16))).
const isGeneration = (value) => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);

const requiredTokens = [
  "A",
  "B",
  "A_REFRESH",
  "B_REFRESH",
  "LEGACY",
  "EXPIRED",
  "WRONG_ISSUER",
  "WRONG_AUDIENCE",
];
export function prerequisites(config, env) {
  const missing = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return ["TWIN_STAGING_CONFIG: reviewed staging manifest is missing"];
  if (config.suite !== "p0-003") missing.push("suite must be p0-003 for this branch");
  if (
    config.environment !== "staging" ||
    config.syntheticOnly !== true ||
    config.authorizedSyntheticWrites !== true
  )
    missing.push("explicit staging-only synthetic-write authorization");
  for (const k of ["baseURL", "directURL"]) {
    try {
      const u = new URL(config[k]);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash || u.origin !== config[k]
      )
        throw Error();
    } catch {
      missing.push(k + ": HTTPS origin required");
    }
  }
  if (config.baseURL === config.directURL)
    missing.push(
      "separate direct ingress or an independently verified disabled-ingress assessment (manual blocker)",
    );
  if (!/^[a-f0-9]{40}$/.test(config.expectedCommit ?? ""))
    missing.push("expected reviewed commit SHA");
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.issuer ?? ""))
    missing.push("exact Access issuer");
  if (!/^[a-f0-9]{64}$/.test(config.audience ?? "")) missing.push("exact Access audience");
  if (
    !/^[a-f0-9]{32}$/.test(config.cloudflareAccountId ?? "") ||
    !/^[a-f0-9-]{36}$/.test(config.stagingDatabaseId ?? "")
  )
    missing.push("dedicated synthetic staging D1 account/database identifiers");
  if (typeof config.deploymentEvidenceReference !== "string" || !config.deploymentEvidenceReference.trim() || config.deploymentEvidenceReference.length > 1024)
    missing.push("operator deployment/commit evidence reference");
  if (!/^TWIN-STAGING-LEGACY-[A-Za-z0-9-]+$/.test(config.legacyMarker ?? ""))
    missing.push("operator-verified synthetic legacy marker and mapping");
  for (const suffix of requiredTokens)
    if (typeof env[`TWIN_STAGING_JWT_${suffix}`] !== "string" || !env[`TWIN_STAGING_JWT_${suffix}`] || env[`TWIN_STAGING_JWT_${suffix}`].length > 16384 || /[\r\n]/.test(env[`TWIN_STAGING_JWT_${suffix}`])) missing.push(`TWIN_STAGING_JWT_${suffix}`);
  if (typeof env.TWIN_STAGING_CF_API_TOKEN !== "string" || !env.TWIN_STAGING_CF_API_TOKEN || env.TWIN_STAGING_CF_API_TOKEN.length > 16384 || /[\r\n]/.test(env.TWIN_STAGING_CF_API_TOKEN))
    missing.push("TWIN_STAGING_CF_API_TOKEN for read-only D1 queries");
  return missing;
}
function tokenData(jwt) {
  try {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) return null;
    const [encodedHeader, encodedClaims] = jwt.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
    const payload = JSON.parse(Buffer.from(encodedClaims, "base64url").toString());
    const audience = Array.isArray(payload?.aud) ? payload.aud : [payload?.aud];
    if (!header || header.alg !== "RS256" || header.typ !== "JWT" || typeof header.kid !== "string" || !header.kid || header.jku || header.x5u || header.jwk ||
      !payload || payload.type !== "app" || typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 512 || /[\u0000-\u001f]/.test(payload.sub) ||
      !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(payload.iss ?? "") ||
      !audience.length || audience.some(a => typeof a !== "string" || !/^[a-f0-9]{64}$/.test(a)) ||
      ![payload.iat, payload.nbf, payload.exp].every(Number.isFinite) || payload.exp <= payload.iat) return null;
    return { ...payload, aud: audience };
  } catch { return null; }
}
export async function hosted(config, env, transport = fetch) {
  const report = {
    schemaVersion: 1,
    mode: "hosted-cloudflare-observation",
    status: "BLOCKED",
    expectedCommit: /^[a-f0-9]{40}$/.test(config?.expectedCommit ?? "") ? config.expectedCommit : null,
    checks: [],
    blockers: prerequisites(config, env),
    realModel: "NOT_EXECUTED",
  };
  if (report.blockers.length) return report;
  // This is configuration screening, not signature verification. Actual Worker
  // requests below must verify the supplied assertions; no claims grant authority here.
  const sessions = Object.fromEntries(requiredTokens.map(n => [n, tokenData(env[`TWIN_STAGING_JWT_${n}`])]));
  if (Object.values(sessions).some(c => !c)) {
    report.blockers.push("well-formed RS256 Access assertions with required claims for all test roles");
    return report;
  }
  const now = Date.now() / 1000, ca = sessions.A, cb = sessions.B;
  const current = c => c.exp > now && c.iat <= now && c.nbf <= now;
  const pinned = c => c.iss === config.issuer && c.aud.includes(config.audience);
  if (ca.sub === cb.sub || [ca, cb, sessions.A_REFRESH, sessions.B_REFRESH, sessions.LEGACY].some(c => !current(c) || !pinned(c))) {
    report.blockers.push("distinct current synthetic Access sessions matching issuer/audience");
    return report;
  }
  if (sessions.A_REFRESH.sub !== ca.sub || sessions.B_REFRESH.sub !== cb.sub ||
      env.TWIN_STAGING_JWT_A === env.TWIN_STAGING_JWT_A_REFRESH || env.TWIN_STAGING_JWT_B === env.TWIN_STAGING_JWT_B_REFRESH ||
      [ca.sub, cb.sub].includes(sessions.LEGACY.sub)) {
    report.blockers.push("fresh same-subject tokens and a separate synthetic legacy identity");
    return report;
  }
  const expired = sessions.EXPIRED, wrongIssuer = sessions.WRONG_ISSUER, wrongAud = sessions.WRONG_AUDIENCE;
  if (!(expired.exp < now - 60 && expired.iat <= now && expired.nbf <= now && pinned(expired)) ||
      !current(wrongIssuer) || wrongIssuer.iss === config.issuer ||
      !current(wrongAud) || wrongAud.iss !== config.issuer || wrongAud.aud.includes(config.audience)) {
    report.blockers.push("separately sourced expired / other-tenant / wrong-audience test assertions with current negative controls");
    return report;
  }
  const assert = (ok, code) => {
    if (!ok) throw new CheckFailure(code);
  };
  const check = async (id, fn) => {
    try {
      const detail = await fn();
      report.checks.push({ id, status: "PASS", ...detail });
    } catch (e) {
      report.checks.push({
        id,
        status: "FAIL",
        code: e instanceof CheckFailure ? e.code : "CHECK_FAILED",
      });
      throw e;
    }
  };
  async function call(origin, path, jwt, payload, extra = {}) {
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      ...(jwt
        ? {
            "Cf-Access-Jwt-Assertion": jwt,
            ...(origin === config.baseURL ? { Cookie: `CF_Authorization=${jwt}` } : {}),
          }
        : {}),
      ...extra,
    };
    return requestJSON(origin + path, {
      method: payload ? "POST" : "GET", headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }, transport);
  }

  async function query(sql, params = []) {
    if (!/^(SELECT|PRAGMA foreign_key_check)/.test(sql)) throw new CheckFailure("READ_ONLY_QUERY_REQUIRED");
    const r = await requestJSON(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/d1/database/${config.stagingDatabaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TWIN_STAGING_CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      }, transport,
    );
    const data = r.body;
    assert(r.status >= 200 && r.status < 300 && data.success === true && data.result?.[0]?.success, "D1_INSPECTION_FAILED");
    return data.result[0].results;
  }
  const token = (n) => env[`TWIN_STAGING_JWT_${n}`],
    origin = config.baseURL,
    seeded = [],
    owned = new Map(), fixtures = {};
  try {
    await check("migration-sequence", async () => {
      const names = (await query("SELECT name FROM d1_migrations ORDER BY id")).map((r) => r.name);
      const required = [
        "0000_last_chameleon.sql",
        "0001_persistent_intelligence.sql",
        "0002_verified_agent_runtime.sql",

      ];
      assert(
        names.length === required.length && required.every((n, i) => names[i] === n),
        "MIGRATION_SEQUENCE_MISMATCH",
      );
      assert((await query("PRAGMA foreign_key_check")).length === 0, "FOREIGN_KEY_FAILURE");
      return { migrationNames: required, recordedMigrationCount: names.length };
    });
    const bad = [
      { name: "missing", jwt: null },
      {
        name: "unsigned-spoof",
        jwt: null,
        headers: {
          "oai-authenticated-user-id": "synthetic-victim",
          "oai-authenticated-user-email": "spoof@example.test",
        },
      },
      { name: "malformed", jwt: "not-a-jwt" },
      {
        name: "tampered",
        jwt:
          token("A").split(".").slice(0, 2).join(".") +
          "." +
          Buffer.from("bad-signature").toString("base64url"),
      },
      ...["EXPIRED", "WRONG_ISSUER", "WRONG_AUDIENCE"].map((n) => ({
        name: n.toLowerCase(),
        jwt: token(n),
      })),
    ];
    for (const boundary of ["gateway", "direct"])
      for (const b of bad)
        await check(`${boundary}-${b.name}`, async () => {
          for (const path of [
            "/api/twin",
            "/api/intelligence",
            "/api/agent",
            "/api/chat",

          ]) {
            const r = await call(
              boundary === "gateway" ? origin : config.directURL,
              path,
              b.jwt,
              path === "/api/agent"
                ? {
                    requestId: randomUUID(),
                    tool: "search_personal_memory",
                    args: { query: "synthetic" },
                  }
                : path === "/api/chat"
                  ? { requestId: randomUUID(), mode: "memory", message: "synthetic" }
                  : null,
              b.headers,
            );
            assert(
              boundary === "gateway"
                ? [301, 302, 303, 307, 308, 401, 403].includes(r.status)
                : r.status === 401,
              "IDENTITY_REJECTION_FAILED",
            );
            assert(!["state", "records", "workflows", "text", "sources", "execution", "memories", "tasks", "documents"].some((key) => Object.hasOwn(r.body, key)), "PRIVATE_DATA_DISCLOSED");
          }
          return {
            boundary,
            meaning: boundary === "gateway" ? "edge rejection only" : "configured Worker rejection",
            ...(b.name === "wrong_issuer" ? { controlScope: "other-tenant rejection; audience and signing key may also differ, so issuer is not isolated" } : {}),
          };
        });
    for (const n of ["A", "B"])
      await check(`seed-synthetic-${n}`, async () => {
        const old = await call(origin, "/api/twin", token(n));
        assert(old.body.generationPrecondition === true, "GENERATION_PRECONDITION_UNSUPPORTED");
        assert(
          old.status === 200 && old.body.initialized === false,
          "ACCOUNT_NOT_EMPTY_REFUSE_MUTATION",
        );
        const name = `TWIN-STAGING-${n}-${randomUUID()}`;
        let r = await call(origin, "/api/twin", token(n), { action: "initialize", name });
        assert(r.status === 200, "INITIALIZE_FAILED");
        // initialize is idempotent: 200 may be somebody else's concurrent account.
        assert(r.body.state?.name === name && r.body.version === 0 && isGeneration(r.body.generation), "INITIALIZE_OWNERSHIP_UNPROVEN");
        owned.set(n, { name, generation: r.body.generation, version: 0 });
        seeded.push(n);
        const marker = `TWIN-STAGING-${n}-${randomUUID()}`;
        r = await call(origin, "/api/twin", token(n), {
          action: "memory.add",
          version: r.body.version,
          expectedGeneration: owned.get(n).generation,
          category: "Context",
          text: marker,
        });
        assert(r.status === 200 && r.body.state?.name === owned.get(n).name && r.body.version === 1, "SEED_FAILED");
        owned.get(n).version = r.body.version;
        fixtures[`marker${n}`] = marker;
        fixtures[`memory${n}`] = r.body.state.memories.find((m) => m.text === marker).id;
        return {};
      });
    await check("two-account-isolation-refresh-and-direct", async () => {
      for (const suffix of ["A", "B", "A_REFRESH", "B_REFRESH"]) {
        const n = suffix[0],
          other = n === "A" ? "B" : "A";
        for (const base of [origin, config.directURL]) {
          const r = await call(base, "/api/twin", token(suffix), null, {
            "oai-authenticated-user-id": "synthetic-victim",
          });
          assert(
            r.status === 200 &&
              JSON.stringify(r.body).includes(fixtures[`marker${n}`]) &&
              !JSON.stringify(r.body).includes(fixtures[`marker${other}`]),
            "ACCOUNT_ISOLATION_FAILED",
          );
        }
      }
      return {};
    });
    await check("cross-account-edit-forget-authorization", async () => {
      for (const n of ["A", "B"]) {
        const other = n === "A" ? "B" : "A",
          view = await call(origin, "/api/twin", token(n));
        for (const action of ["memory.update", "memory.delete"]) {
          const r = await call(origin, "/api/twin", token(n), {
            action,
            id: fixtures[`memory${other}`],
            version: view.body.version,
            expectedGeneration: owned.get(n).generation,
            text: "FORGED",
            category: "Context",
          });
          assert([400, 403, 404].includes(r.status), "CROSS_ACCOUNT_MUTATION_ACCEPTED");
        }
      }
      const denied = await call(origin, "/api/agent", token("A"), {
        requestId: randomUUID(),
        tool: "send_email",
        args: {},
      });
      assert(denied.status === 400, "UNREGISTERED_TOOL_ACCEPTED");
      return {};
    });
    await check("all-read-tools-and-owner-generation-receipts", async () => {
      const graph = await call(origin, "/api/intelligence", token("A"));
      assert(graph.status === 200, "GRAPH_READ_FAILED");
      const attempts = [
        ["search_personal_memory", { query: fixtures.markerA }],
        ["find_commitments", { status: "active", person: "", project: "" }],
        ["get_person_context", { entityId: randomUUID() }],
        ["get_project_context", { entityId: randomUUID() }],
        ["retrieve_procedure", { query: "synthetic" }],
      ];
      for (const [i, [tool, args]] of attempts.entries()) {
        const n = i % 2 ? "B" : "A",
          account = await call(origin, "/api/twin", token(n));
        const id = randomUUID(),
          r = await call(origin, "/api/agent", token(n), { requestId: id, tool, args });
        assert(r.status === 200 && r.body.execution?.receipts?.length === 1, "TOOL_RUN_FAILED");
        const rows = await query(
          "SELECT e.*,r.status AS run_status,h.epoch AS current_epoch FROM agent_execution_receipts e JOIN agent_runs r ON r.request_id=e.request_id AND r.user_id=e.user_id AND r.generation=e.generation JOIN twin_intelligence_heads h ON h.owner=e.user_id AND h.generation=e.generation WHERE e.request_id=?",
          [id],
        );
        assert(
          rows.length === 1 &&
            rows[0].generation === account.body.generation &&
            rows[0].run_status === "completed" &&
            rows[0].authorization === "allow" &&
            rows[0].status === "succeeded" &&
            rows[0].tool_id === tool &&
            rows[0].execution_id === r.body.execution.receipts[0].executionId,
          "RECEIPT_MISMATCH",
        );
        const replay = await call(origin, "/api/agent", token(n), { requestId: id, tool, args });
        assert(replay.status === 409, "REPLAY_ACCEPTED");
      }
      return {};
    });
    await check("legacy-mapping", async () => {
      const r = await call(origin, "/api/twin", token("LEGACY"));
      assert(
        r.status === 200 && JSON.stringify(r.body).includes(config.legacyMarker),
        "LEGACY_LINK_NOT_VALIDATED",
      );
      return { scope: "operator-provisioned synthetic legacy account" };
    });
    await check("generation-change-erasure", async () => {
      const before = await call(origin, "/api/twin", token("A"));
      assert(isOwned(before, owned.get("A")), "ERASE_OWNER_CHECK_FAILED");
      const a = before;
      assert(
        (
          await call(origin, "/api/twin", token("A"), {
            action: "erase",
            confirmation: "DELETE MY DATA",
            version: a.body.version,
            expectedGeneration: owned.get("A").generation,
          })
        ).status === 200,
        "ERASE_FAILED",
      );
      owned.delete("A"); // Do not clean up a reinitialization whose ownership is unknown.
      const name = `TWIN-STAGING-A-${randomUUID()}`;
      const initialized = await call(origin, "/api/twin", token("A"), { action: "initialize", name });
      assert(initialized.status === 200 && initialized.body.state?.name === name && initialized.body.version === 0 && isGeneration(initialized.body.generation), "REINITIALIZE_OWNERSHIP_UNPROVEN");
      owned.set("A", { name, generation: initialized.body.generation, version: 0 });
      const after = await call(origin, "/api/twin", token("A"));
      assert(isOwned(after, owned.get("A")), "REINITIALIZE_OWNER_CHECK_FAILED");
      assert(
        after.status === 200 &&
          typeof before.body.generation === "string" &&
          typeof after.body.generation === "string" &&
          before.body.generation !== after.body.generation &&
          !JSON.stringify(after.body).includes(fixtures.markerA),
        "GENERATION_CHANGE_FAILED",
      );
      return {};
    });
    report.status = "PASS";
  } catch {
    report.status = "FAIL";
  } finally {
    for (const n of seeded) {
      await check(`cleanup-${n}`, async () => {
        const current = await call(origin, "/api/twin", token(n));
        assert(
          isOwned(current, owned.get(n)),
          "CLEANUP_OWNER_CHECK_FAILED",
        );
        const r = await call(origin, "/api/twin", token(n), {
          action: "erase",
          confirmation: "DELETE MY DATA",
          version: current.body.version,
          expectedGeneration: owned.get(n).generation,
        });
        assert(r.status === 200, "CLEANUP_FAILED");
        return {};
      }).catch(() => {
        report.status = "FAIL";
      });
    }
  }
  // A successful finite suite is not operational approval, a live-model result or independent review.
  report.hostedReadiness = "BLOCKED_PENDING_MANUAL_GATES";
  report.remainingManualGates = [
    "approved deployment/commit attribution",
    "Access logout/revocation policy and full ingress inventory",
    "hosted log privacy inspection",
    "backup erasure reconciliation and operational review",
    "hosted in-flight restart/revocation fault injection",
  ];
  return report;
}
export async function main(args = process.argv.slice(2), env = process.env) {
  const output = args.includes("--report") ? args[args.indexOf("--report") + 1] : null;
  let report;
  const valid = args.filter((a, i) => a === "--local" || a === "--hosted" || a === "--report" || (args[i-1] === "--report" && !a.startsWith("--")));
  if (args.filter(a => a === "--local" || a === "--hosted").length !== 1 || valid.length !== args.length || args.filter(a => a === "--report").length > 1 || (args.includes("--report") && (!output || output.startsWith("--")))) {
    console.log(JSON.stringify({schemaVersion:1,status:"BLOCKED",blockers:["Specify exactly one of --local or --hosted, with an optional --report path"]}));
    return 2;
  }
  if (args.includes("--local")) {
    const tests = [
      "tests/security.test.mjs",
      "tests/worker-security.test.mjs",
      "tests/agent-integration.test.mjs",
      "tests/remediation.test.mjs",
      "tests/semantic.test.mjs",
      "tests/intelligence.test.mjs",
      "tests/staging-harness.test.mjs",
    ];
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...tests], {
      encoding: "utf8",
      env: { ...env, CLOUDFLARE_CF_FETCH_ENABLED: "false" },
      timeout: 180_000,
      maxBuffer: 12_000_000,
    });
    report = {
      schemaVersion: 1,
      mode: "local-signed-synthetic-jwt-and-worker-d1",
      status: run.status === 0 ? "PASS" : "FAIL",
      exitCode: run.status,
      timedOut: run.error?.code === "ETIMEDOUT",
      tests,
      logSha256: createHash("sha256")
        .update((run.stdout ?? "") + (run.stderr ?? ""))
        .digest("hex"),
      summary: (run.stdout ?? "")
        .split("\n")
        .filter((l) => /^ℹ (tests|pass|fail|skipped)|^# (tests|pass|fail|skipped)/.test(l)),
      hosted: {
        status: "BLOCKED",
        reason: "Local workerd and synthetic JWKS do not validate hosted Access.",
      },
    };
    if (run.status !== 0) process.stderr.write((run.stdout ?? "").slice(-8000));
  } else {
    let config;
    try {
      if (env.TWIN_STAGING_CONFIG)
        config = JSON.parse(await fs.readFile(env.TWIN_STAGING_CONFIG, "utf8"));
    } catch {
      /* explicit missing manifest */
    }
    report = await hosted(config, env);
  }
  if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  return report.status === "PASS" ? 0 : report.status === "BLOCKED" ? 2 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
