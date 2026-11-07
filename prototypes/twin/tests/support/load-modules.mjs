// Transpiles the real TypeScript sources into an isolated directory and rewrites only
// platform bindings: `cloudflare:workers` (env), `@/app/chatgpt-auth` (Sites identity)
// and `@/db` (D1). Production modules are executed unmodified otherwise.
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve('.');
const SOURCES = [
  'lib/twin/core.ts', 'lib/twin/server.ts', 'db/schema.ts',
  'app/api/chat/route.ts', 'app/api/twin/route.ts',
];
const STUBS = {
  'cloudflare:workers': '__stubs/env.mjs',
  '@/app/chatgpt-auth': '__stubs/context.mjs',
  '@/db': '__stubs/db.mjs',
};

const STUB_SOURCE = {
  'env.mjs': 'export const env = {};',
  'context.mjs': "export let current=null; export const setUser=(id)=>current=id?{userId:id,email:'qa@example.test',displayName:'QA',fullName:null}:null; export async function getChatGPTUser(){return current;}",
  'db.mjs': `import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import fs from 'node:fs';
import path from 'node:path';
export const sqlite = new DatabaseSync(':memory:');
const dir = ${JSON.stringify(path.join(ROOT, 'drizzle'))};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
// Fault injection: statements matching failPattern reject, emulating a D1 outage.
let failPattern = null;
export const setFailPattern = (re) => { failPattern = re; };
export const statements = [];
const guard = (q) => { statements.push(q); if (failPattern && failPattern.test(q)) throw new Error('D1_INJECTED_FAILURE'); };
class Statement {
  constructor(query, args = []) { this.query = query; this.args = args; }
  bind(...args) { return new Statement(this.query, args); }
  async all() { guard(this.query); const results = sqlite.prepare(this.query).all(...this.args); return { results, success: true, meta: { changes: sqlite.prepare('SELECT changes() as n').get().n } }; }
  async run() { return this.all(); }
  async raw() { guard(this.query); const s = sqlite.prepare(this.query); s.setReturnArrays(true); return s.all(...this.args); }
  async first(column) { guard(this.query); const r = sqlite.prepare(this.query).get(...this.args); return column ? r?.[column] : r; }
}
const d1 = { prepare: (q) => new Statement(q), batch: async (s) => Promise.all(s.map((x) => x.all())) };
const db = drizzle(d1);
export const getDb = () => db;`,
};

async function listAgentSources() {
  const out = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(rel);
      else if (entry.name.endsWith('.ts')) out.push(rel);
    }
  }
  await walk('lib/agent');
  return out;
}

function rewrite(specifier, fromRel, outDir) {
  const fromDir = path.dirname(path.join(outDir, fromRel));
  let target = null;
  if (STUBS[specifier]) target = path.join(outDir, STUBS[specifier]);
  else if (specifier.startsWith('@/')) target = path.join(outDir, `${specifier.slice(2)}.mjs`);
  else if (specifier.startsWith('./') || specifier.startsWith('../')) target = path.join(fromDir, `${specifier}.mjs`);
  if (!target) return specifier;
  let rel = path.relative(fromDir, target);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/** Build the module tree once per test process and return the output directory. */
export async function buildModules(name) {
  const outDir = path.join(ROOT, '.sites-runtime', name);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outDir, '__stubs'), { recursive: true });
  for (const [file, source] of Object.entries(STUB_SOURCE)) await fs.writeFile(path.join(outDir, '__stubs', file), source);
  for (const rel of [...SOURCES, ...(await listAgentSources())]) {
    const source = await fs.readFile(path.join(ROOT, rel), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const rewritten = js.replace(/(from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\2/g, (_m, pre, q, spec) => `${pre}${q}${rewrite(spec, rel, outDir)}${q}`);
    const outFile = path.join(outDir, rel.replace(/\.ts$/, '.mjs'));
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, rewritten);
  }
  return outDir;
}

/** Import a transpiled module by its source path, e.g. 'lib/agent/runtime.ts'. */
export function importBuilt(outDir, rel) {
  return import(path.join(outDir, rel.replace(/\.ts$/, '.mjs')));
}
