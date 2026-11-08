// Shared harness: real runtime + real D1 receipt store/admission on in-memory SQLite.
import { buildModules, importBuilt } from './load-modules.mjs';

export async function loadAgent(name) {
  const dir = await buildModules(name);
  const m = async (p) => importBuilt(dir, p);
  const mods = {
    dir,
    runtime: await m('lib/agent/runtime.ts'),
    limits: await m('lib/agent/limits.ts'),
    principal: await m('lib/agent/principal.ts'),
    registry: await m('lib/agent/tool-registry.ts'),
    receipts: await m('lib/agent/receipts.ts'),
    admission: await m('lib/agent/admission.ts'),
    adapter: await m('lib/agent/model-adapter.ts'),
    chatAdapter: await m('lib/agent/chat-completions-adapter.ts'),
    evidence: await m('lib/agent/evidence.ts'),
    errors: await m('lib/agent/errors.ts'),
    executor: await m('lib/agent/executor.ts'),
    authorization: await m('lib/agent/authorization.ts'),
    deadline: await m('lib/agent/deadline.ts'),
    liveAi: await m('lib/agent/live-ai.ts'),
    tool: await m('lib/agent/tools/search-personal-memory.ts'),
    core: await m('lib/twin/core.ts'),
    db: await import(`${dir}/__stubs/db.mjs`),
    schema: await m('db/schema.ts'),
  };
  return mods;
}

export const ISO = '2026-11-01T09:00:00.000Z';

export function memory(id, text, status = 'confirmed', category = 'Goal') {
  return { id, text, category, source: 'You told Twin', status, createdAt: ISO, updatedAt: ISO };
}
export function documentRecord(id, name, text) {
  return { id, name, text, createdAt: ISO };
}

/** Insert or replace an account row directly (test fixture). */
export function seedAccount(mods, userId, { memories = [], documents = [], aiConsent = true } = {}) {
  const state = { name: userId, aiConsent, createdAt: ISO, memories, tasks: [], documents, activity: [] };
  mods.db.sqlite.prepare('INSERT OR REPLACE INTO twin_accounts (user_id, state, version) VALUES (?, ?, 0)').run(userId, JSON.stringify(state));
  return state;
}

/** Corpus reader backed by twin_accounts; records every userId it is asked to load. */
export function d1CorpusReader(mods, log = []) {
  return {
    log,
    async loadCorpus(userId) {
      log.push(userId);
      const row = mods.db.sqlite.prepare('SELECT state FROM twin_accounts WHERE user_id = ?').get(userId);
      if (!row) return null;
      const s = JSON.parse(row.state);
      return { memories: s.memories, documents: s.documents };
    },
  };
}

let seq = 0;
/** Deterministic id generator (UUID-shaped). */
export function sequentialIds(prefix = '00000000') {
  return () => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
}

/** Build runtime dependencies. `overrides` may replace any dependency. */
export function deps(mods, { model, reader, limits, receipts, consent = true } = {}) {
  const corpus = reader ?? d1CorpusReader(mods);
  return {
    model,
    registry: mods.registry.createToolRegistry([mods.tool.createSearchPersonalMemoryTool(corpus)]),
    receipts: receipts ?? mods.receipts.createD1ReceiptStore(mods.db.getDb()),
    clock: mods.deadline.systemClock,
    newId: sequentialIds(),
    limits: limits ? mods.limits.resolveLimits(limits) : mods.limits.PRODUCTION_LIMITS,
    corpus,
    consent,
  };
}

export function principalFor(mods, userId, consent = true) {
  return mods.principal.createVerifiedPrincipal({ userId }, { aiContextConsent: consent });
}

export function receiptRows(mods, requestId) {
  return mods.db.sqlite.prepare('SELECT * FROM agent_execution_receipts WHERE request_id = ? ORDER BY call_index').all(requestId);
}
export function runRow(mods, requestId) {
  return mods.db.sqlite.prepare('SELECT * FROM agent_runs WHERE request_id = ?').get(requestId);
}
export const newRequestId = () => crypto.randomUUID();
