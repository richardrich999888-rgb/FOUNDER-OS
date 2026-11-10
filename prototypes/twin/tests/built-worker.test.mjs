// Run after npm run build. Tests the unmodified production bundle/entrypoint.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, Log, LogLevel } = await import(require.resolve("miniflare"));
test("production bundle fails closed without verified identity configuration", async () => {
  const root = path.resolve("dist/server");
  const files = (await fs.readdir(root, { recursive: true })).filter(
    (f) => f.endsWith(".js") && f !== "index.js",
  );
  const modules = ["index.js", ...files].map((file) => ({
    type: "ESModule",
    path: path.join(root, file),
  }));
  const mf = new Miniflare({
    cf: false, // Use local metadata; never fetch workers.cloudflare.com during tests.
    modules,
    modulesRoot: root,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    log: new Log(LogLevel.ERROR),
  });
  try {
    for (const endpoint of ["/api/twin", "/api/chat", "/api/intelligence", "/api/agent"])
      for (const spoof of [false, true]) {
        const r = await mf.dispatchFetch(`https://direct-worker.test${endpoint}`, {
          method: endpoint === "/api/chat" || endpoint === "/api/agent" ? "POST" : "GET",
          headers: {
            Origin: "https://direct-worker.test",
            ...(spoof
              ? {
                  "oai-authenticated-user-id": "synthetic-victim",
                  "oai-authenticated-user-email": "synthetic@example.test",
                }
              : {}),
          },
          ...(endpoint === "/api/chat" || endpoint === "/api/agent"
            ? {
                body: JSON.stringify({
                  message: "Read private data",
                  mode: "memory",
                  requestId: crypto.randomUUID(),
                }),
              }
            : {}),
        });
        assert.equal(r.status, 503);
        assert.deepEqual(await r.json(), {
          error: "Secure sign-in is not configured. Contact the app owner.",
        });
        assert.equal(r.headers.get("cache-control"), "private, no-store");
      }
  } finally {
    await mf.dispose();
  }
});
