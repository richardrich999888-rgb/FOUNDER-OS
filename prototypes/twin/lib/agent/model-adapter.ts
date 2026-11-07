/**
 * Model port and OpenAI Responses API adapter.
 *
 * The runtime only sees the provider-neutral `ModelPort`. The adapter:
 *  - sends `store: false` (no provider-side conversation state),
 *  - replays prior tool calls as `function_call` items WITHOUT provider item ids
 *    (stateless replay; ids reference stored items, which do not exist with store=false),
 *  - sets `max_output_tokens` from runtime limits on every call,
 *  - validates the response shape and treats all model output as untrusted data.
 * Output item types other than `message` and `function_call` (e.g. `reasoning`) are ignored.
 *
 * Unverified provider details (see docs/agent/p0-002-architecture.md §Research): exact
 * strict-mode schema rules and `usage` field names. Usage is therefore parsed as optional.
 */
import { z } from 'zod';
import { AgentError } from './errors';
import type { ToolSpec } from './tool-registry';

export type ConversationItem =
  | Readonly<{ type: 'user_message'; text: string }>
  | Readonly<{ type: 'tool_call'; callId: string; name: string; argumentsJson: string }>
  | Readonly<{ type: 'tool_result'; callId: string; output: string }>;

export type ModelRequest = Readonly<{
  instructions: string;
  items: readonly ConversationItem[];
  tools: readonly ToolSpec[];
  /** 'none' forbids tool selection (used on the final permitted iteration). */
  toolChoice: 'auto' | 'none';
  maxOutputTokens: number;
}>;

export type ModelToolCall = Readonly<{ callId: string; name: string; argumentsJson: string }>;
export type ModelUsage = Readonly<{ inputTokens: number; outputTokens: number }>;

export type ModelTurn = Readonly<{
  text: string;
  toolCalls: readonly ModelToolCall[];
  usage: ModelUsage | null;
  /** Provider reported an incomplete response (e.g. output-token cap reached). */
  truncated: boolean;
}>;

export type ModelPort = Readonly<{
  respond(request: ModelRequest, signal: AbortSignal): Promise<ModelTurn>;
}>;

export type OpenAIResponsesConfig = Readonly<{
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}>;

export const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
/** Upper bound on response body size accepted from the provider (bytes of text). */
const MAX_RESPONSE_CHARS = 1_000_000;
const MAX_TOOL_CALLS_PER_TURN = 32;

// Response validation. Each known item type is validated by its OWN schema; there is no
// catch-all branch that could accept a malformed `message` or `function_call` item.
const contentSchema = z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() }).passthrough();
const messageItemSchema = z.object({ type: z.literal('message'), content: z.array(contentSchema) }).passthrough();
const functionCallItemSchema = z
  .object({ type: z.literal('function_call'), call_id: z.string().min(1).max(256), name: z.string().min(1).max(256), arguments: z.string() })
  .passthrough();
const responseSchema = z
  .object({
    status: z.string().optional(),
    output: z.array(z.object({ type: z.string() }).passthrough()),
    usage: z.unknown().optional(),
  })
  .passthrough();
// Usage is accounting metadata with unverified field names: parsed separately so a shape drift
// degrades usage to null instead of failing an otherwise valid response.
const usageSchema = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).passthrough();

/** Map a neutral conversation item to a Responses API input item. */
export function toResponsesInputItem(item: ConversationItem): Record<string, string> {
  switch (item.type) {
    case 'user_message':
      return { role: 'user', content: item.text };
    case 'tool_call':
      return { type: 'function_call', call_id: item.callId, name: item.name, arguments: item.argumentsJson };
    case 'tool_result':
      return { type: 'function_call_output', call_id: item.callId, output: item.output };
  }
}

/** Build the exact JSON body sent to the provider. Pure; exported for contract tests. */
export function buildResponsesRequestBody(model: string, request: ModelRequest): Record<string, unknown> {
  return {
    model,
    store: false,
    instructions: request.instructions,
    input: request.items.map(toResponsesInputItem),
    tools: request.tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: true })),
    tool_choice: request.toolChoice,
    parallel_tool_calls: true,
    max_output_tokens: request.maxOutputTokens,
  };
}

/** Parse a provider response body into a ModelTurn. Throws MODEL_MALFORMED_RESPONSE. */
export function parseResponsesBody(body: unknown): ModelTurn {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new AgentError('MODEL_MALFORMED_RESPONSE');
  const texts: string[] = [];
  const toolCalls: ModelToolCall[] = [];
  for (const item of parsed.data.output) {
    if (item.type === 'message') {
      const message = messageItemSchema.safeParse(item);
      if (!message.success) throw new AgentError('MODEL_MALFORMED_RESPONSE');
      for (const part of message.data.content) {
        if (part.type === 'output_text' && typeof part.text === 'string') texts.push(part.text);
        else if (part.type === 'refusal' && typeof part.refusal === 'string') texts.push(part.refusal);
      }
    } else if (item.type === 'function_call') {
      const fn = functionCallItemSchema.safeParse(item);
      if (!fn.success) throw new AgentError('MODEL_MALFORMED_RESPONSE');
      toolCalls.push({ callId: fn.data.call_id, name: fn.data.name, argumentsJson: fn.data.arguments });
    }
    // Any other item type (reasoning, model-emitted function_call_output, ...) is ignored.
  }
  if (toolCalls.length > MAX_TOOL_CALLS_PER_TURN) throw new AgentError('MODEL_MALFORMED_RESPONSE');
  const usageParsed = usageSchema.safeParse(parsed.data.usage);
  const usage = usageParsed.success ? { inputTokens: usageParsed.data.input_tokens, outputTokens: usageParsed.data.output_tokens } : null;
  return { text: texts.join('\n'), toolCalls, usage, truncated: parsed.data.status === 'incomplete' };
}

/** Create the OpenAI Responses adapter. The API key is held only in this closure. */
export function createOpenAIResponsesModel(config: OpenAIResponsesConfig): ModelPort {
  if (!config.apiKey || !config.model) throw new AgentError('MODEL_UNAVAILABLE');
  const doFetch = config.fetchImpl ?? fetch;
  const endpoint = config.endpoint ?? OPENAI_RESPONSES_ENDPOINT;
  return Object.freeze({
    async respond(request: ModelRequest, signal: AbortSignal): Promise<ModelTurn> {
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildResponsesRequestBody(config.model, request)),
          signal,
        });
      } catch {
        throw new AgentError(signal.aborted ? 'MODEL_TIMEOUT' : 'MODEL_UNAVAILABLE');
      }
      if (!response.ok) throw new AgentError('MODEL_UNAVAILABLE');
      let raw: string;
      try {
        raw = await response.text();
      } catch {
        throw new AgentError(signal.aborted ? 'MODEL_TIMEOUT' : 'MODEL_UNAVAILABLE');
      }
      if (raw.length > MAX_RESPONSE_CHARS) throw new AgentError('MODEL_MALFORMED_RESPONSE');
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new AgentError('MODEL_MALFORMED_RESPONSE');
      }
      return parseResponsesBody(body);
    },
  });
}
