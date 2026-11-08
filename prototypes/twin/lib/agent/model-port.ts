// Provider-neutral planning port. No provider adapter, key or network call.
import type { ToolSpec } from "./tool-registry";
export type ConversationItem =
  | Readonly<{ type: "user_message"; text: string }>
  | Readonly<{ type: "tool_call"; callId: string; name: string; argumentsJson: string }>
  | Readonly<{ type: "tool_result"; callId: string; output: string }>;

export type ModelRequest = Readonly<{
  instructions: string;
  items: readonly ConversationItem[];
  tools: readonly ToolSpec[];
  /** 'none' forbids tool selection (used on the final permitted iteration). */
  toolChoice: "auto" | "none";
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
