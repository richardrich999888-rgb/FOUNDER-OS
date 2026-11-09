/**
 * ModelPort adapter for OpenAI-compatible Chat Completions endpoints
 * (llama.cpp `llama-server`, vLLM, Hugging Face router and similar).
 *
 * Adapted from P0-002 commit a522a04 for the secured P0-003 model port.
 * Used by /api/agent model mode and configured /api/chat Live AI.
 *
 * Mapping (neutral -> Chat Completions):
 *   instructions                 -> { role: 'system', content }
 *   user_message                 -> { role: 'user', content }
 *   consecutive tool_call items  -> ONE { role: 'assistant', content: null, tool_calls: [...] }
 *   tool_result                  -> { role: 'tool', tool_call_id, content }
 * Validation mirrors the Responses adapter: strict per-field checks, fail closed on malformed
 * tool calls, usage parsed leniently (degrades to null).
 */
import { z } from "zod";
import { AgentError } from "./errors";
import type {
  ConversationItem,
  ModelPort,
  ModelRequest,
  ModelToolCall,
  ModelTurn,
} from "./model-port";

export type ChatCompletionsConfig = Readonly<{
  /** Full endpoint URL, e.g. http://127.0.0.1:8080/v1/chat/completions */
  endpoint: string;
  model: string;
  /** Optional bearer token. Omit for local servers; prefer proxy-injected credentials. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}>;

const MAX_RESPONSE_CHARS = 1_000_000;
const MAX_TOOL_CALLS_PER_TURN = 32;

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: null;
      tool_calls: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

/** Map the neutral transcript to Chat Completions messages. Pure. */
export function toChatMessages(
  instructions: string,
  items: readonly ConversationItem[],
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: instructions }];
  for (const item of items) {
    if (item.type === "user_message") {
      messages.push({ role: "user", content: item.text });
    } else if (item.type === "tool_call") {
      const last = messages[messages.length - 1];
      const call = {
        id: item.callId,
        type: "function" as const,
        function: { name: item.name, arguments: item.argumentsJson },
      };
      if (last && last.role === "assistant") last.tool_calls.push(call);
      else messages.push({ role: "assistant", content: null, tool_calls: [call] });
    } else {
      messages.push({ role: "tool", tool_call_id: item.callId, content: item.output });
    }
  }
  return messages;
}

/** Build the exact JSON body sent to the endpoint. Pure; exported for contract tests. */
export function buildChatCompletionsBody(
  model: string,
  request: ModelRequest,
): Record<string, unknown> {
  return {
    model,
    messages: toChatMessages(request.instructions, request.items),
    tools: request.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: typeof request.toolChoice === "object"
      ? { type: "function", function: { name: request.toolChoice.name } }
      : request.toolChoice,
    max_tokens: request.maxOutputTokens,
    // Deterministic decoding for evaluation reproducibility (greedy). Not a security control.
    temperature: 0,
    stream: false,
  };
}

const toolCallSchema = z
  .object({
    id: z.string().min(1).max(256),
    type: z.literal("function").optional(),
    function: z.object({ name: z.string().min(1).max(256), arguments: z.string() }).passthrough(),
  })
  .passthrough();
const responseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            finish_reason: z.string().nullable().optional(),
            message: z
              .object({
                content: z.string().nullable().optional(),
                tool_calls: z.array(z.unknown()).nullable().optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z.unknown().optional(),
  })
  .passthrough();
const usageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
  })
  .passthrough();

/** Parse a Chat Completions response into a ModelTurn. Throws MODEL_MALFORMED_RESPONSE. */
export function parseChatCompletionsBody(body: unknown): ModelTurn {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new AgentError("MODEL_MALFORMED_RESPONSE");
  const choice = parsed.data.choices[0];
  const toolCalls: ModelToolCall[] = [];
  for (const raw of choice.message.tool_calls ?? []) {
    const call = toolCallSchema.safeParse(raw);
    if (!call.success) throw new AgentError("MODEL_MALFORMED_RESPONSE");
    toolCalls.push({
      callId: call.data.id,
      name: call.data.function.name,
      argumentsJson: call.data.function.arguments,
    });
  }
  if (toolCalls.length > MAX_TOOL_CALLS_PER_TURN) throw new AgentError("MODEL_MALFORMED_RESPONSE");
  const usage = usageSchema.safeParse(parsed.data.usage);
  return {
    text: choice.message.content ?? "",
    toolCalls,
    usage: usage.success
      ? { inputTokens: usage.data.prompt_tokens, outputTokens: usage.data.completion_tokens }
      : null,
    truncated: choice.finish_reason === "length",
  };
}

/** Create the Chat Completions adapter. */
export function createChatCompletionsModel(config: ChatCompletionsConfig): ModelPort {
  if (!config.endpoint || !config.model) throw new AgentError("MODEL_UNAVAILABLE");
  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new AgentError("MODEL_UNAVAILABLE");
  }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    endpoint.search ||
    !(endpoint.protocol === "https:" || (endpoint.protocol === "http:" && loopback))
  )
    throw new AgentError("MODEL_UNAVAILABLE");
  const doFetch = config.fetchImpl ?? fetch;
  return Object.freeze({
    async respond(request: ModelRequest, signal: AbortSignal): Promise<ModelTurn> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      let response: Response;
      try {
        response = await doFetch(config.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(buildChatCompletionsBody(config.model, request)),
          redirect: "manual",
          signal,
        });
      } catch {
        throw new AgentError(signal.aborted ? "MODEL_TIMEOUT" : "MODEL_UNAVAILABLE");
      }
      if (!response.ok) throw new AgentError("MODEL_UNAVAILABLE");
      let raw: string;
      try {
        if (!response.body) throw new AgentError("MODEL_MALFORMED_RESPONSE");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        raw = "";
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > MAX_RESPONSE_CHARS) {
              await reader.cancel();
              throw new AgentError("MODEL_MALFORMED_RESPONSE");
            }
            raw += decoder.decode(chunk.value, { stream: true });
          }
          raw += decoder.decode();
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        if (error instanceof AgentError) throw error;
        throw new AgentError(signal.aborted ? "MODEL_TIMEOUT" : "MODEL_UNAVAILABLE");
      }
      if (raw.length > MAX_RESPONSE_CHARS) throw new AgentError("MODEL_MALFORMED_RESPONSE");
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new AgentError("MODEL_MALFORMED_RESPONSE");
      }
      return parseChatCompletionsBody(body);
    },
  });
}
