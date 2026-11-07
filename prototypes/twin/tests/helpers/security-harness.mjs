import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

export const issuer = "https://twin-test.cloudflareaccess.com";
export const audience = "a".repeat(64);
export const config = {
  TWIN_AUTH_PROVIDER: "cloudflare-access",
  TWIN_AUTH_ISSUER: issuer,
  TWIN_AUTH_AUDIENCE: audience,
};

export async function createHarness(name) {
  const dir = path.resolve(".sites-runtime", `security-${name}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "context.mjs"),
    `import { AsyncLocalStorage } from 'node:async_hooks';
    const context = new AsyncLocalStorage();
    export const run = (headers, callback) => context.run(headers, callback);
    export const headers = async () => context.getStore() ?? new Headers();`,
  );
  await fs.writeFile(path.join(dir, "env.mjs"), `export const env = ${JSON.stringify(config)};`);
  await fs.writeFile(
    path.join(dir, "db.mjs"),
    `import { DatabaseSync } from 'node:sqlite';
    import { drizzle } from 'drizzle-orm/d1'; import fs from 'node:fs';
    export const sql = new DatabaseSync(':memory:');
    sql.exec(fs.readFileSync('drizzle/0000_last_chameleon.sql','utf8'));
    export let queries = 0;
    class Statement {
      constructor(query,args=[]) { this.query=query; this.args=args; }
      bind(...args) { return new Statement(this.query,args); }
      async all() { queries++; const results=sql.prepare(this.query).all(...this.args); return {results,success:true,meta:{changes:sql.prepare('SELECT changes() as n').get().n}}; }
      async run() { return this.all(); }
      async raw() { queries++; const s=sql.prepare(this.query);s.setReturnArrays(true);return s.all(...this.args); }
      async first(column) { queries++;const r=sql.prepare(this.query).get(...this.args);return column?r?.[column]:r; }
    }
    const d1={prepare:q=>new Statement(q),batch:async s=>Promise.all(s.map(v=>v.all()))};
    const db=drizzle(d1);export const getDb=()=>db;`,
  );
  const files = {
    "schema.mjs": "db/schema.ts",
    "core.mjs": "lib/twin/core.ts",
    "server.mjs": "lib/twin/server.ts",
    "twin.mjs": "app/api/twin/route.ts",
    "chat.mjs": "app/api/chat/route.ts",
    ...Object.fromEntries(
      [
        "identity",
        "verify-token",
        "authorize",
        "audit",
        "tool-permissions",
        "request-identity",
      ].map((n) => [`${n}.mjs`, `lib/security/${n}.ts`]),
    ),
  };
  const aliases = {
    "cloudflare:workers": "./env.mjs",
    "next/headers": "./context.mjs",
    "@/db": "./db.mjs",
  };
  for (const [out, input] of Object.entries(files))
    aliases[`@/${input.replace(/\.ts$/, "")}`] = `./${out}`;
  for (const [out, input] of Object.entries(files)) {
    let source = await fs.readFile(input, "utf8");
    source = source.replace(/(from\s+)(['"])([^'"]+)\2/g, (match, prefix, quote, specifier) => {
      const relative = specifier.startsWith(".")
        ? `@/${path.posix.normalize(path.posix.join(path.posix.dirname(input), specifier))}`
        : specifier;
      return `${prefix}${quote}${aliases[relative] ?? specifier}${quote}`;
    });
    await fs.writeFile(
      path.join(dir, out),
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    );
  }
  const pair = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", use: "sig", alg: "RS256" };
  const network = [];
  globalThis.fetch = async (url, options) => {
    network.push({ url: String(url), redirect: options?.redirect });
    if (String(url) !== `${issuer}/cdn-cgi/access/certs`)
      throw new Error("Unexpected network request");
    return Response.json({ keys: [jwk] });
  };
  const context = await import(path.join(dir, "context.mjs"));
  const { env } = await import(path.join(dir, "env.mjs"));
  const route = await import(path.join(dir, "twin.mjs")),
    chat = await import(path.join(dir, "chat.mjs"));
  async function token(subject, claims = {}, options = {}) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuer,
      aud: [audience],
      sub: subject,
      type: "app",
      iat: now,
      nbf: now,
      exp: now + 600,
      ...claims,
    };
    for (const [key, value] of Object.entries(payload))
      if (value === undefined) delete payload[key];
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT", ...options.header })
      .sign(options.key ?? pair.privateKey);
  }
  async function raw(headers = {}, payload, isChat = false, suffix = "") {
    const req = new Request(`https://twin.test/api/${isChat ? "chat" : "twin"}${suffix}`, {
      method: payload ? "POST" : "GET",
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const r = await context.run(req.headers, () =>
      isChat ? chat.POST(req) : payload ? route.POST(req) : route.GET(),
    );
    return { status: r.status, ...(await r.json()) };
  }
  async function call(user, payload, origin = "https://twin.test", isChat = false) {
    return raw(
      {
        ...(user ? { "Cf-Access-Jwt-Assertion": await token(user) } : {}),
        ...(origin ? { Origin: origin } : {}),
        "Content-Type": "application/json",
      },
      payload,
      isChat,
    );
  }
  const modules = {};
  for (const name of ["identity", "authorize", "tool-permissions", "audit", "server", "core"])
    modules[name] = await import(path.join(dir, `${name}.mjs`));
  return {
    call,
    raw,
    token,
    env,
    network,
    pair,
    other,
    jwk,
    modules,
    db: await import(path.join(dir, "db.mjs")),
  };
}
