// No deployment, migrations, identity-setting changes, or production writes are performed here.
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";

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
  if (!config) return ["TWIN_STAGING_CONFIG: reviewed staging manifest is missing"];
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
        u.hash
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
  if (!config.deploymentEvidenceReference)
    missing.push("operator deployment/commit evidence reference");
  if (!/^TWIN-STAGING-LEGACY-[A-Za-z0-9-]+$/.test(config.legacyMarker ?? ""))
    missing.push("operator-verified synthetic legacy marker and mapping");
  for (const suffix of requiredTokens)
    if (!env[`TWIN_STAGING_JWT_${suffix}`]) missing.push(`TWIN_STAGING_JWT_${suffix}`);
  if (!env.TWIN_STAGING_CF_API_TOKEN)
    missing.push("TWIN_STAGING_CF_API_TOKEN for read-only D1 queries");
  return missing;
}
function claims(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}
export async function hosted(config, env, transport = fetch) {
  const report = {
    schemaVersion: 1,
    mode: "hosted-cloudflare-observation",
    status: "BLOCKED",
    expectedCommit: config?.expectedCommit ?? null,
    checks: [],
    blockers: prerequisites(config, env),
    realModel: "NOT_EXECUTED",
  };
  if (report.blockers.length) return report;
  const ca = claims(env.TWIN_STAGING_JWT_A),
    cb = claims(env.TWIN_STAGING_JWT_B);
  // These checks only detect configuration mistakes. The Worker must cryptographically verify the assertions.
  if (
    !ca.sub ||
    !cb.sub ||
    ca.sub === cb.sub ||
    [ca, cb].some(
      (c) =>
        c.iss !== config.issuer ||
        !(Array.isArray(c.aud) ? c.aud : [c.aud]).includes(config.audience),
    )
  ) {
    report.blockers.push("two distinct synthetic Access sessions matching issuer/audience");
    return report;
  }
  if (
    claims(env.TWIN_STAGING_JWT_A_REFRESH).sub !== ca.sub ||
    claims(env.TWIN_STAGING_JWT_B_REFRESH).sub !== cb.sub ||
    env.TWIN_STAGING_JWT_A === env.TWIN_STAGING_JWT_A_REFRESH ||
    env.TWIN_STAGING_JWT_B === env.TWIN_STAGING_JWT_B_REFRESH
  ) {
    report.blockers.push("fresh, distinct post-login tokens for each same synthetic subject");
    return report;
  }
  const expected = claims(env.TWIN_STAGING_JWT_EXPIRED),
    wrongIssuer = claims(env.TWIN_STAGING_JWT_WRONG_ISSUER),
    wrongAud = claims(env.TWIN_STAGING_JWT_WRONG_AUDIENCE);
  if (
    !(expected.exp * 1000 < Date.now() - 60_000) ||
    wrongIssuer.iss === config.issuer ||
    (Array.isArray(wrongAud.aud) ? wrongAud.aud : [wrongAud.aud]).includes(config.audience)
  ) {
    report.blockers.push("genuine expired / wrong-issuer / wrong-audience signed test assertions");
    return report;
  }
  const assert = (ok, code) => {
    if (!ok) throw new Error(code);
  };
  const check = async (id, fn) => {
    try {
      const detail = await fn();
      report.checks.push({ id, status: "PASS", ...detail });
    } catch (e) {
      report.checks.push({
        id,
        status: "FAIL",
        code: /^[A-Z0-9_]+$/.test(e.message) ? e.message : "CHECK_FAILED",
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
    const r = await transport(origin + path, {
      method: payload ? "POST" : "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const text = await r.text();
    if (text.length > 1_000_000) throw Error("RESPONSE_TOO_LARGE");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
    return { status: r.status, body };
  }
  async function query(sql, params = []) {
    if (!/^(SELECT|PRAGMA foreign_key_check)/.test(sql)) throw Error("READ_ONLY_QUERY_REQUIRED");
    const r = await transport(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/d1/database/${config.stagingDatabaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TWIN_STAGING_CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await r.json();
    assert(r.ok && data.success === true && data.result?.[0]?.success, "D1_INSPECTION_FAILED");
    return data.result[0].results;
  }
  const token = (n) => env[`TWIN_STAGING_JWT_${n}`],
    origin = config.baseURL,
    seeded = [];
  try {
    await check("migration-sequence", async () => {
      const names = (await query("SELECT name FROM d1_migrations ORDER BY id")).map((r) => r.name);
      const required = [
        "0000_last_chameleon.sql",
        "0001_persistent_intelligence.sql",
        "0002_verified_agent_runtime.sql",
        ...(config.suite === "p0-003" ? [] : ["0003_personal_agency_assurance.sql"]),
      ];
      assert(
        required.every((n, i) => names[i] === n) && !names.includes("0001_agent_receipts.sql"),
        "MIGRATION_SEQUENCE_MISMATCH",
      );
      assert((await query("PRAGMA foreign_key_check")).length === 0, "FOREIGN_KEY_FAILURE");
      return { migrationNames: names };
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
            ...(config.suite === "p0-003" ? [] : ["/api/assurance"]),
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
            assert(!r.body.state && !r.body.records && !r.body.workflows, "PRIVATE_DATA_DISCLOSED");
          }
          return {
            boundary,
            meaning: boundary === "gateway" ? "edge rejection only" : "configured Worker rejection",
          };
        });
    for (const n of ["A", "B"])
      await check(`seed-synthetic-${n}`, async () => {
        const old = await call(origin, "/api/twin", token(n));
        assert(
          old.status === 200 && old.body.initialized === false,
          "ACCOUNT_NOT_EMPTY_REFUSE_MUTATION",
        );
        let r = await call(origin, "/api/twin", token(n), {
          action: "initialize",
          name: `TWIN-STAGING-${n}-${randomUUID()}`,
        });
        assert(r.status === 200, "INITIALIZE_FAILED");
        seeded.push(n);
        const marker = `TWIN-STAGING-${n}-${randomUUID()}`;
        r = await call(origin, "/api/twin", token(n), {
          action: "memory.add",
          version: r.body.version,
          category: "Context",
          text: marker,
        });
        assert(r.status === 200, "SEED_FAILED");
        config[`marker${n}`] = marker;
        config[`memory${n}`] = r.body.state.memories.find((m) => m.text === marker).id;
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
              JSON.stringify(r.body).includes(config[`marker${n}`]) &&
              !JSON.stringify(r.body).includes(config[`marker${other}`]),
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
            id: config[`memory${other}`],
            version: view.body.version,
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
        ["search_personal_memory", { query: config.markerA }],
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
      const a = before;
      assert(
        (
          await call(origin, "/api/twin", token("A"), {
            action: "erase",
            confirmation: "DELETE MY DATA",
            version: a.body.version,
          })
        ).status === 200,
        "ERASE_FAILED",
      );
      assert(
        (
          await call(origin, "/api/twin", token("A"), {
            action: "initialize",
            name: `TWIN-STAGING-A-${randomUUID()}`,
          })
        ).status === 200,
        "REINITIALIZE_FAILED",
      );
      const after = await call(origin, "/api/twin", token("A"));
      assert(
        after.status === 200 &&
          typeof before.body.generation === "string" &&
          typeof after.body.generation === "string" &&
          before.body.generation !== after.body.generation &&
          !JSON.stringify(after.body).includes(config.markerA),
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
          current.status === 200 && current.body.state?.name?.startsWith(`TWIN-STAGING-${n}-`),
          "CLEANUP_OWNER_CHECK_FAILED",
        );
        const r = await call(origin, "/api/twin", token(n), {
          action: "erase",
          confirmation: "DELETE MY DATA",
          version: current.body.version,
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
  if (args.includes("--local")) {
    const tests = [
      "tests/security.test.mjs",
      "tests/worker-security.test.mjs",
      "tests/agent-integration.test.mjs",
      "tests/remediation.test.mjs",
      "tests/semantic.test.mjs",
      "tests/assurance.test.mjs",
      "tests/migrations.test.mjs",
      "tests/staging-harness.test.mjs",
    ];
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...tests], {
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 12_000_000,
    });
    report = {
      schemaVersion: 1,
      mode: "local-signed-synthetic-jwt-and-worker-d1",
      status: run.status === 0 ? "PASS" : "FAIL",
      exitCode: run.status,
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
