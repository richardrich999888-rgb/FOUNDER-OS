// Deterministic model stubs implementing the ModelPort contract. No randomness.
const PERSONAL = /\b(my|me|i|i'm|i've|mine|myself|remember|jarvis)\b/i;

export const estimateTokens = (value) => Math.ceil(String(value).length / 4);

function usageFor(request, text) {
  return { inputTokens: estimateTokens(JSON.stringify(request.items) + request.instructions), outputTokens: estimateTokens(text) };
}

function lastObservation(items) {
  for (let i = items.length - 1; i >= 0; i -= 1) if (items[i].type === 'tool_result') return JSON.parse(items[i].output);
  return null;
}

/**
 * Reference policy: searches memory for personal questions, answers with citations from the
 * observation, abstains on no_evidence, answers general questions directly. Used as the
 * deterministic baseline model; it is NOT a substitute for measuring a real model.
 */
export function policyModel() {
  const calls = [];
  return {
    calls,
    async respond(request) {
      calls.push(request);
      const user = request.items.find((i) => i.type === 'user_message').text;
      const observation = lastObservation(request.items);
      if (!observation && request.toolChoice === 'auto' && PERSONAL.test(user)) {
        return { text: '', toolCalls: [{ callId: `call_${calls.length}`, name: 'search_personal_memory', argumentsJson: JSON.stringify({ query: user }) }], usage: usageFor(request, ''), truncated: false };
      }
      let text;
      if (!observation) text = `General answer: ${user.slice(0, 60)}`;
      else if (observation.status === 'ok') text = `From your saved information: ${observation.evidence.map((e) => `${e.content} [${e.citation}]`).join(' ')}`;
      else text = 'I could not find that in your saved information.';
      return { text, toolCalls: [], usage: usageFor(request, text), truncated: false };
    },
  };
}

/** Scripted model: each entry is a turn or a function(request, index) returning a turn. */
export function scriptedModel(script) {
  const calls = [];
  return {
    calls,
    async respond(request, signal) {
      const index = calls.length;
      calls.push(request);
      const step = script[Math.min(index, script.length - 1)];
      const turn = typeof step === 'function' ? await step(request, index, signal) : step;
      return { text: '', toolCalls: [], usage: null, truncated: false, ...turn };
    },
  };
}

export const call = (name, args, id) => ({ callId: id, name, argumentsJson: typeof args === 'string' ? args : JSON.stringify(args) });

/** A model whose call never resolves (ignores its abort signal) — provider hang. */
export function hangingModel() {
  const calls = [];
  return { calls, respond: (request) => { calls.push(request); return new Promise(() => {}); } };
}

/** Build a Responses API JSON body from a neutral turn (for fake-fetch provider tests). */
export function responsesBody({ text = '', toolCalls = [], status = 'completed', usage = { input_tokens: 10, output_tokens: 5 } } = {}) {
  const output = [];
  if (text) output.push({ type: 'message', id: 'msg_1', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] });
  for (const c of toolCalls) output.push({ type: 'function_call', id: `fc_${c.callId}`, call_id: c.callId, name: c.name, arguments: c.argumentsJson, status: 'completed' });
  return { id: 'resp_1', object: 'response', status, output, usage };
}

/** Fake fetch that emulates the Responses endpoint by delegating to a neutral model stub. */
export function fakeOpenAIFetch(model, { status = 200, rawBody = null } = {}) {
  const requests = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, headers: init.headers, body });
    if (status !== 200) return new Response(rawBody ?? '{"error":{"message":"upstream failure"}}', { status });
    const items = body.input.map((i) => (i.role === 'user' ? { type: 'user_message', text: i.content } : i.type === 'function_call' ? { type: 'tool_call', callId: i.call_id, name: i.name, argumentsJson: i.arguments } : { type: 'tool_result', callId: i.call_id, output: i.output }));
    const turn = await model.respond({ instructions: body.instructions, items, tools: body.tools, toolChoice: body.tool_choice, maxOutputTokens: body.max_output_tokens }, init.signal);
    const usage = turn.usage ? { input_tokens: turn.usage.inputTokens, output_tokens: turn.usage.outputTokens } : undefined;
    return new Response(JSON.stringify(responsesBody({ text: turn.text, toolCalls: turn.toolCalls, usage })), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  fn.requests = requests;
  return fn;
}
