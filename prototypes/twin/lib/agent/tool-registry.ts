/**
 * Typed, closed tool registry.
 *
 * Each tool carries two schema views of the same contract:
 *  - `argsSchema` (Zod): the authoritative server-side validator.
 *  - `parameters` (JSON Schema): the model-facing declaration sent to the provider.
 * Definitions require closed objects with every declared field required; the executor
 * validates each call against the authoritative Zod schema. The registry is frozen after construction; there is no API to
 * register tools at request time, so the set of executable tools is fixed at deploy time.
 */
import type { z } from "zod";
import type { Scope, VerifiedPrincipal } from "./principal";

/** JSON Schema subset accepted for tool parameters (strict-mode compatible object). */
export type ToolParametersSchema = Readonly<{
  type: "object";
  properties: Readonly<
    Record<
      string,
      Readonly<{ type: "string" | "integer" | "number" | "boolean"; description: string }>
    >
  >;
  required: readonly string[];
  additionalProperties: false;
}>;

/** Evidence item produced by a tool. Content is user data and is untrusted by the model. */
export type EvidenceItem = Readonly<{
  sourceId: string;
  kind: "memory" | "document" | "intelligence";
  provenanceId?: string;
  label: string;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
}>;

/** Structured outcome summary every tool must provide for the runtime ledger. */
export type ToolResultSummary = Readonly<{
  status: "ok" | "no_evidence";
  evidence: readonly EvidenceItem[];
}>;

/** Execution context handed to a tool. Contains no secrets and no environment bindings. */
export type ToolContext = Readonly<{
  principal: VerifiedPrincipal;
  signal: AbortSignal;
}>;

export type ToolDefinition<TArgs, TResult> = Readonly<{
  /** Stable identifier; also the function name exposed to the model. */
  name: string;
  description: string;
  requiredScope: Scope;
  /** Only read-only tools are admissible in P0-002. */
  sideEffects: "none";
  argsSchema: z.ZodType<TArgs>;
  parameters: ToolParametersSchema;
  resultSchema: z.ZodType<TResult>;
  execute(args: TArgs, context: ToolContext): Promise<TResult>;
  summarize(result: TResult): ToolResultSummary;
}>;

// Type-erased definition stored in the registry. `unknown` args/results are re-validated by the
// executor via the tool's own Zod schemas before and after execution.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, any>;

/** Function tool declaration in the provider-neutral form consumed by the model adapter. */
export type ToolSpec = Readonly<{
  name: string;
  description: string;
  parameters: ToolParametersSchema;
}>;

export type ToolRegistry = Readonly<{
  get(name: string): AnyToolDefinition | undefined;
  names(): readonly string[];
  specs(): readonly ToolSpec[];
}>;

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** Validate the static shape of a definition. Throws at startup, never at request time. */
function assertDefinition(tool: AnyToolDefinition): void {
  if (!TOOL_NAME_PATTERN.test(tool.name)) throw new Error(`Invalid tool name: ${tool.name}`);
  if (tool.sideEffects !== "none") throw new Error(`Tool ${tool.name} declares side effects`);
  const { parameters } = tool;
  if (parameters.type !== "object" || parameters.additionalProperties !== false) {
    throw new Error(`Tool ${tool.name} parameters must be a closed object schema`);
  }
  const keys = Object.keys(parameters.properties).sort();
  const required = [...parameters.required].sort();
  if (keys.length !== required.length || keys.some((key, i) => key !== required[i])) {
    throw new Error(`Tool ${tool.name}: every declared property must be required`);
  }
}

/** Build a frozen registry. Duplicate names are rejected. */
export function createToolRegistry(tools: readonly AnyToolDefinition[]): ToolRegistry {
  const byName = new Map<string, AnyToolDefinition>();
  for (const tool of tools) {
    assertDefinition(tool);
    if (byName.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
    byName.set(tool.name, Object.freeze({ ...tool }));
  }
  const specs = Object.freeze(
    [...byName.values()].map((t) =>
      Object.freeze({ name: t.name, description: t.description, parameters: t.parameters }),
    ),
  );
  const names = Object.freeze([...byName.keys()]);
  return Object.freeze({
    // Own-property lookup only: a model-supplied name such as "constructor" or "__proto__" never resolves.
    get: (name: string) => (byName.has(name) ? byName.get(name) : undefined),
    names: () => names,
    specs: () => specs,
  });
}
