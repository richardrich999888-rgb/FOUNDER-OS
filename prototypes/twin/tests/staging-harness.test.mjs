import test from "node:test";
import assert from "node:assert/strict";
import { hosted, prerequisites } from "../scripts/staging-security.mjs";
test("staging missing credentials is BLOCKED and sends no network traffic", async () => {
  let calls = 0;
  const r = await hosted(undefined, {}, async () => {
    calls++;
    throw Error("must not run");
  });
  assert.equal(r.status, "BLOCKED");
  assert.equal(calls, 0);
  assert.equal(r.checks.length, 0);
  assert.ok(r.blockers.length);
});
test("production or ambiguous manifest is blocked before any synthetic writes", async () => {
  for (const environment of ["production", undefined]) {
    const c = {
      environment,
      syntheticOnly: true,
      authorizedSyntheticWrites: true,
      baseURL: "https://test.example",
      directURL: "https://direct.example",
    };
    assert.ok(prerequisites(c, {}).some((s) => s.includes("authorization")));
    let calls = 0;
    const r = await hosted(c, {}, async () => {
      calls++;
    });
    assert.equal(r.status, "BLOCKED");
    assert.equal(calls, 0);
  }
});
test("hosted configuration never accepts missing direct boundary, same-account tokens or untrusted redirects", () => {
  const p = prerequisites(
    {
      environment: "staging",
      syntheticOnly: true,
      authorizedSyntheticWrites: true,
      baseURL: "https://same.example",
      directURL: "https://same.example",
    },
    {},
  );
  assert.ok(p.some((s) => s.includes("direct ingress")));
  assert.ok(p.some((s) => s.includes("TWIN_STAGING_JWT_A")));
});
