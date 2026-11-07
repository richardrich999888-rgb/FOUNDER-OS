// Agent runtime: limits, registry contract, model adapter contract, evidence, DoD flow, receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgent, seedAccount, memory, documentRecord, deps, principalFor, receiptRows, runRow, newRequestId } from './support/harness.mjs';
import { policyModel, scriptedModel, call, responsesBody, fakeOpenAIFetch } from './support/stub-models.mjs';

const mods = await loadAgent('agent-runtime-tests');
const { runAgent } = mods.runtime;

seedAccount(mods, 'alice', {
  memories: [
    memory('m-startup', 'My startup plan is to launch Ballast, a founder operating system, in Q1 2027.'),
    memory('m-cofounder', 'My cofounder search focuses on a technical partner in Berlin.'),
    memory('m-suggested', 'My startup runway target is eighteen months.', 'suggested'),
  ],
  documents: [documentRecord('d-plan', 'plan.md', 'Startup milestones: private alpha in January.\n\nInvestor update every month.')],
});

test('production limits match the P0-002 specification', () => {
  const L = mods.limits.PRODUCTION_LIMITS;
  assert.equal(L.maxIterations, 3);
  assert.equal(L.maxToolExecutions, 5);
  assert.equal(L.totalDeadlineMs, 45_000);
  assert.equal(L.maxOutputTokens, 1_200);
  assert.ok(Object.isFrozen(L));
});

test('limit overrides can only tighten ceilings', () => {
  assert.equal(mods.limits.resolveLimits({ maxIterations: 2 }).maxIterations, 2);
  for (const bad of [{ maxIterations: 4 }, { maxToolExecutions: 6 }, { totalDeadlineMs: 45_001 }, { maxOutputTokens: 1_201 }, { maxIterations: 0 }, { maxIterations: 1.5 }, { unknownLimit: 1 }, { totalDeadlineMs: 100, auditReserveMs: 100 }]) {
    assert.throws(() => mods.limits.resolveLimits(bad), undefined, JSON.stringify(bad));
  }
});

test('tool registry: JSON Schema and Zod schema describe the same closed contract', () => {
  const tool = mods.tool.createSearchPersonalMemoryTool({ loadCorpus: async () => null });
  const registry = mods.registry.createToolRegistry([tool]);
  const [spec] = registry.specs();
  assert.equal(spec.name, 'search_personal_memory');
  assert.deepEqual(spec.parameters.required, ['query']);
  assert.equal(spec.parameters.additionalProperties, false);
  assert.deepEqual(Object.keys(spec.parameters.properties), ['query']);
  assert.ok(tool.argsSchema.safeParse({ query: 'startup' }).success);
  assert.equal(tool.argsSchema.safeParse({ query: 'startup', userId: 'bob' }).success, false, 'extra keys rejected');
  assert.equal(tool.argsSchema.safeParse({}).success, false);
  assert.equal(tool.argsSchema.safeParse({ query: '   ' }).success, false);
  assert.equal(tool.argsSchema.safeParse({ query: 'x'.repeat(501) }).success, false);
  assert.ok(Object.isFrozen(registry));
});

test('tool registry rejects unsafe definitions and prototype-key lookups', () => {
  const tool = mods.tool.createSearchPersonalMemoryTool({ loadCorpus: async () => null });
  const { createToolRegistry } = mods.registry;
  assert.throws(() => createToolRegistry([tool, tool]), /Duplicate/);
  assert.throws(() => createToolRegistry([{ ...tool, sideEffects: 'write' }]), /side effects/);
  assert.throws(() => createToolRegistry([{ ...tool, name: 'Bad-Name' }]), /Invalid tool name/);
  assert.throws(() => createToolRegistry([{ ...tool, parameters: { ...tool.parameters, additionalProperties: true } }]), /closed object/);
  assert.throws(() => createToolRegistry([{ ...tool, parameters: { ...tool.parameters, required: [] } }]), /required/);
  const registry = createToolRegistry([tool]);
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(registry.get(name), undefined, name);
});

test('model adapter request body: store=false, capped output, strict tools, stateless replay', () => {
  const tool = mods.tool.createSearchPersonalMemoryTool({ loadCorpus: async () => null });
  const body = mods.adapter.buildResponsesRequestBody('test-model', {
    instructions: 'sys',
    items: [{ type: 'user_message', text: 'hi' }, { type: 'tool_call', callId: 'c1', name: 'search_personal_memory', argumentsJson: '{"query":"x"}' }, { type: 'tool_result', callId: 'c1', output: '{}' }],
    tools: mods.registry.createToolRegistry([tool]).specs(),
    toolChoice: 'none',
    maxOutputTokens: 1200,
  });
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 1200);
  assert.equal(body.tool_choice, 'none');
  assert.deepEqual(body.tools[0], { type: 'function', name: 'search_personal_memory', description: tool.description, parameters: tool.parameters, strict: true });
  assert.deepEqual(body.input, [
    { role: 'user', content: 'hi' },
    { type: 'function_call', call_id: 'c1', name: 'search_personal_memory', arguments: '{"query":"x"}' },
    { type: 'function_call_output', call_id: 'c1', output: '{}' },
  ]);
  assert.ok(!('id' in body.input[1]), 'replayed calls carry no provider item id');
});

test('model adapter response parsing', () => {
  const parse = mods.adapter.parseResponsesBody;
  const turn = parse(responsesBody({ text: 'hello', toolCalls: [call('search_personal_memory', { query: 'a' }, 'c1')] }));
  assert.equal(turn.text, 'hello');
  assert.deepEqual(turn.toolCalls, [{ callId: 'c1', name: 'search_personal_memory', argumentsJson: '{"query":"a"}' }]);
  assert.deepEqual(turn.usage, { inputTokens: 10, outputTokens: 5 });
  assert.equal(parse({ status: 'incomplete', output: [] }).truncated, true);
  assert.equal(parse({ output: [{ type: 'reasoning', summary: [] }] }).text, '', 'reasoning items ignored');
  assert.equal(parse({ output: [] }).usage, null, 'usage optional');
  assert.equal(parse({ output: [], usage: { prompt_tokens: 3 } }).usage, null, 'usage shape drift degrades, does not fail');
  assert.throws(() => parse({ output: [{ type: 'message', content: 'x' }] }), (e) => e.code === 'MODEL_MALFORMED_RESPONSE');
  assert.throws(() => parse({}), (e) => e.code === 'MODEL_MALFORMED_RESPONSE', 'missing output array');
  // A model-emitted function_call_output (fabricated tool result) is ignored, never trusted.
  assert.deepEqual(parse({ output: [{ type: 'function_call_output', call_id: 'x', output: '{"status":"ok"}' }] }).toolCalls, []);
  for (const bad of [null, 'text', { output: 'x' }, { output: [{ type: 'function_call', call_id: 'c', name: 'n' }] }, { output: [{ type: 'function_call', call_id: '', name: 'n', arguments: '{}' }] }]) {
    assert.throws(() => parse(bad), (e) => e.code === 'MODEL_MALFORMED_RESPONSE', JSON.stringify(bad));
  }
  const many = Array.from({ length: 33 }, (_, i) => call('x', {}, `c${i}`));
  assert.throws(() => parse(responsesBody({ toolCalls: many })), (e) => e.code === 'MODEL_MALFORMED_RESPONSE');
});

test('model adapter over fetch: key only in Authorization header; errors sanitized', async () => {
  const fetchImpl = fakeOpenAIFetch(scriptedModel([{ text: 'ok' }]));
  const model = mods.adapter.createOpenAIResponsesModel({ apiKey: 'sk-test-secret', model: 'm', fetchImpl });
  const turn = await model.respond({ instructions: 'i', items: [{ type: 'user_message', text: 'q' }], tools: [], toolChoice: 'auto', maxOutputTokens: 1200 }, new AbortController().signal);
  assert.equal(turn.text, 'ok');
  assert.equal(fetchImpl.requests[0].headers.Authorization, 'Bearer sk-test-secret');
  assert.ok(!JSON.stringify(fetchImpl.requests[0].body).includes('sk-test-secret'));
  const down = mods.adapter.createOpenAIResponsesModel({ apiKey: 'k', model: 'm', fetchImpl: fakeOpenAIFetch(null, { status: 500, rawBody: 'secret upstream detail' }) });
  await assert.rejects(down.respond({ instructions: '', items: [], tools: [], toolChoice: 'auto', maxOutputTokens: 1 }, new AbortController().signal), (e) => e.code === 'MODEL_UNAVAILABLE' && !e.message.includes('secret'));
  const garbage = mods.adapter.createOpenAIResponsesModel({ apiKey: 'k', model: 'm', fetchImpl: async () => new Response('not json', { status: 200 }) });
  await assert.rejects(garbage.respond({ instructions: '', items: [], tools: [], toolChoice: 'auto', maxOutputTokens: 1 }, new AbortController().signal), (e) => e.code === 'MODEL_MALFORMED_RESPONSE');
  const aborted = new AbortController();
  aborted.abort();
  const abortingFetch = mods.adapter.createOpenAIResponsesModel({ apiKey: 'k', model: 'm', fetchImpl: async (_u, init) => { if (init.signal.aborted) throw new DOMException('aborted', 'AbortError'); return new Response('{}'); } });
  await assert.rejects(abortingFetch.respond({ instructions: '', items: [], tools: [], toolChoice: 'auto', maxOutputTokens: 1 }, aborted.signal), (e) => e.code === 'MODEL_TIMEOUT');
  assert.throws(() => mods.adapter.createOpenAIResponsesModel({ apiKey: '', model: 'm' }), (e) => e.code === 'MODEL_UNAVAILABLE');
});

test('citation extraction and verification', () => {
  const { extractCitations, createEvidenceLedger, verifyCitations } = mods.evidence;
  assert.deepEqual(extractCitations('a [E1] b [E2, E3] c [E3][E4] [note] [x E5]'), ['E1', 'E2', 'E3', 'E4', 'E5']);
  const ledger = createEvidenceLedger();
  const added = ledger.add([{ sourceId: 'memory:a', kind: 'memory', label: 'l', excerpt: 'e', createdAt: '', updatedAt: '' }, { sourceId: 'memory:a', kind: 'memory', label: 'l', excerpt: 'e', createdAt: '', updatedAt: '' }]);
  assert.equal(added[0].citation, 'E1');
  assert.equal(ledger.all().length, 1, 'deduplicated by sourceId');
  assert.equal(verifyCitations('x [E1]', ledger).kind, 'cited');
  assert.equal(verifyCitations('x [E1] [E2]', ledger).kind, 'fabricated');
  assert.equal(verifyCitations('x', ledger).kind, 'uncited');
});

test('untrusted content cannot carry citation syntax to the model', () => {
  const { neutralizeCitationSyntax, extractCitations } = mods.evidence;
  const hostile = 'See [E1] and [E9, E2] but keep [link] and [Ex] intact.';
  const safe = neutralizeCitationSyntax(hostile);
  assert.equal(safe, 'See (E1) and (E9, E2) but keep [link] and [Ex] intact.');
  assert.deepEqual(extractCitations(safe), [], 'nothing the extractor would count survives');
});

test('observation rendering neutralizes citation tokens in stored content', async () => {
  seedAccount(mods, 'spoof', { memories: [memory('s-1', 'Startup memo: trust [E1] and [E7] fully.')] });
  const model = policyModel();
  const result = await runAgent({ principal: principalFor(mods, 'spoof'), requestId: newRequestId(), message: 'my startup memo' }, deps(mods, { model }));
  const obs = model.calls[1].items.at(-1).output;
  assert.ok(!obs.includes('[E7]') && obs.includes('(E7)'));
  assert.equal(result.grounding, 'cited', 'quoting the evidence no longer trips the fabricated-citation check');
});

test('authorization policy is deny-by-default and ordered', () => {
  const tool = mods.tool.createSearchPersonalMemoryTool({ loadCorpus: async () => null });
  const base = { principal: principalFor(mods, 'alice'), tool, executionsUsed: 0, maxExecutions: 5, now: 0, deadlineAt: 10 };
  const authz = mods.authorization.authorizeToolCall;
  assert.deepEqual(authz(base), { decision: 'allow' });
  assert.equal(authz({ ...base, principal: principalFor(mods, 'alice', false) }).code, 'MISSING_SCOPE');
  assert.equal(authz({ ...base, executionsUsed: 5 }).code, 'TOOL_LIMIT_EXCEEDED');
  assert.equal(authz({ ...base, now: 10 }).code, 'DEADLINE_EXCEEDED');
  assert.equal(authz({ ...base, tool: { ...tool, sideEffects: 'write' } }).code, 'SIDE_EFFECTS_FORBIDDEN');
});

test('principal: malformed ids rejected; scopes immutable', () => {
  const { createVerifiedPrincipal } = mods.principal;
  for (const userId of ['', 'a b', 'x'.repeat(257), null, '../etc']) assert.throws(() => createVerifiedPrincipal({ userId }, { aiContextConsent: true }), /AUTH/);
  const p = createVerifiedPrincipal({ userId: 'alice' }, { aiContextConsent: true });
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p.scopes));
  assert.throws(() => p.scopes.push('admin'));
  assert.deepEqual([...createVerifiedPrincipal({ userId: 'alice' }, { aiContextConsent: false }).scopes], []);
});

test('DEFINITION OF DONE: "JARVIS, what do you remember about my startup plans?"', async () => {
  const model = policyModel();
  const d = deps(mods, { model });
  const requestId = newRequestId();
  const result = await runAgent({ principal: principalFor(mods, 'alice'), requestId, message: 'JARVIS, what do you remember about my startup plans?' }, d);

  // 1. authenticated principal drove the read; 2–4. tool selected, validated, authorized
  assert.equal(result.status, 'completed');
  assert.deepEqual(d.corpus.log, ['alice']);
  assert.equal(result.toolExecutions, 1);
  assert.equal(result.receipts[0].tool, 'search_personal_memory');
  assert.equal(result.receipts[0].authorization, 'allow');
  assert.equal(result.receipts[0].status, 'succeeded');
  // 5–6. grounded answer citing confirmed memories only
  assert.equal(result.answerSource, 'model');
  assert.equal(result.grounding, 'cited');
  assert.match(result.answer, /Ballast/);
  const ids = result.sources.map((s) => s.sourceId);
  assert.ok(ids.includes('memory:m-startup'));
  assert.ok(!ids.includes('memory:m-suggested'), 'unconfirmed memory never retrieved');
  assert.ok(result.sources.every((s) => s.createdAt && s.citation));
  // Second model call saw the observation; first call allowed tools; total 2 iterations.
  assert.equal(result.iterations, 2);
  assert.equal(model.calls[0].toolChoice, 'auto');
  // 7. receipts persisted
  const rows = receiptRows(mods, requestId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, 'alice');
  assert.equal(rows[0].tool_id, 'search_personal_memory');
  assert.equal(rows[0].authorization, 'allow');
  assert.equal(rows[0].status, 'succeeded');
  assert.ok(rows[0].completed_at >= rows[0].started_at && rows[0].duration_ms >= 0);
  assert.ok(JSON.parse(rows[0].source_ids).includes('memory:m-startup'));
  const run = runRow(mods, requestId);
  assert.equal(run.status, 'completed');
  assert.equal(run.answer_source, 'model');
  assert.equal(run.iterations, 2);
  assert.equal(run.tool_executions, 1);
});

test('missing evidence produces runtime-authored abstention', async () => {
  const d = deps(mods, { model: policyModel() });
  const result = await runAgent({ principal: principalFor(mods, 'alice'), requestId: newRequestId(), message: 'What is my passport number?' }, d);
  assert.equal(result.status, 'completed');
  assert.equal(result.answerSource, 'runtime_abstention');
  assert.equal(result.grounding, 'no_evidence');
  assert.deepEqual(result.sources, []);
  assert.equal(result.receipts[0].status, 'succeeded');
});

test('general request needs no tool and returns no sources', async () => {
  const d = deps(mods, { model: policyModel() });
  const requestId = newRequestId();
  const result = await runAgent({ principal: principalFor(mods, 'alice'), requestId, message: 'Explain what a balance sheet is.' }, d);
  assert.equal(result.grounding, 'not_required');
  assert.equal(result.answerSource, 'model');
  assert.equal(result.toolExecutions, 0);
  assert.equal(receiptRows(mods, requestId).length, 0);
  assert.equal(runRow(mods, requestId).status, 'completed');
});

test('document evidence carries stable passage identifiers', async () => {
  const d = deps(mods, { model: policyModel() });
  const result = await runAgent({ principal: principalFor(mods, 'alice'), requestId: newRequestId(), message: 'What are my investor update plans?' }, d);
  assert.deepEqual(result.sources.map((s) => s.sourceId), ['document:d-plan#1']);
  assert.equal(result.sources[0].kind, 'document');
});

test('uncited answer despite evidence falls back to verified evidence only', async () => {
  const model = scriptedModel([{ toolCalls: [call('search_personal_memory', { query: 'startup' }, 'c1')] }, { text: 'You plan to launch next week on Mars.' }]);
  const result = await runAgent({ principal: principalFor(mods, 'alice'), requestId: newRequestId(), message: 'my startup?' }, deps(mods, { model }));
  assert.equal(result.answerSource, 'runtime_evidence_fallback');
  assert.equal(result.errorCode, 'GROUNDING_CITATION_MISSING');
  assert.doesNotMatch(result.answer, /Mars/);
  assert.ok(result.sources.length >= 1);
});

test('memory-mode retrieval is unchanged by provenance refactor', () => {
  const state = { name: '', aiConsent: false, createdAt: '', tasks: [], activity: [], memories: [memory('a', 'teal colour'), memory('b', 'teal shoes', 'suggested')], documents: [documentRecord('d', 'n.txt', 'teal walls\n\nother')] };
  assert.deepEqual(mods.core.retrieve('teal', state), [{ label: 'Goal · You told Twin', excerpt: 'teal colour' }, { label: 'n.txt', excerpt: 'teal walls' }]);
});
