import { AsyncLocalStorage } from "node:async_hooks";
import { sanitizeErrorCode } from "../agent/errors";

export const operations = [
  "request.admission",
  "agent.plan",
  "identity.verify",
  "authorization.check",
  "memory.retrieve",
  "model.invoke",
  "tool.validate",
  "tool.execute",
  "receipt.persist",
  "workflow.transition",
  "workflow.cancel",
  "workflow.recover",
  "workflow.reconcile",
] as const;
type Operation = (typeof operations)[number];
const tools = new Set([
  "search_personal_memory",
  "find_commitments",
  "get_person_context",
  "get_project_context",
  "retrieve_procedure",
]);
type Attributes = Record<string, string | number>;
type NativeTracing = {
  startSpan(name: string): { setAttribute(k: string, v: string | number): void; end(): void };
};
export type DiagnosticSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: Operation;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attributes;
  status: { code: number };
};
type Trace = {
  id: string;
  root: string;
  spans: DiagnosticSpan[];
  enabled: boolean;
  native?: NativeTracing;
};
const storage = new AsyncLocalStorage<Trace>();
const randomHex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export function parseTraceparent(value: string | null) {
  if (!value || !/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(value)) return null;
  const [, traceId, parentSpanId, flags] = value.split("-");
  if (/^0+$/.test(traceId) || /^0+$/.test(parentSpanId)) return null;
  return { traceId, parentSpanId, sampled: (parseInt(flags, 16) & 1) === 1 };
}
// Closed schema AND closed string values: even a known key cannot carry arbitrary text.
export function safeAttributes(input: Record<string, unknown>): Attributes {
  const out: Attributes = {};
  if (
    input["gen_ai.operation.name"] === "chat" ||
    input["gen_ai.operation.name"] === "execute_tool"
  )
    out["gen_ai.operation.name"] = input["gen_ai.operation.name"];
  if (tools.has(String(input["gen_ai.tool.name"])))
    out["gen_ai.tool.name"] = String(input["gen_ai.tool.name"]);
  for (const k of ["gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens", "twin.duration_ms"]) {
    const n = input[k];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e9) out[k] = Math.trunc(n);
  }
  if (input["error.type"] !== undefined) out["error.type"] = sanitizeErrorCode(input["error.type"]);
  if (["ok", "failed", "denied", "unknown"].includes(String(input["twin.outcome"])))
    out["twin.outcome"] = String(input["twin.outcome"]);
  return out;
}
export function correlationId() {
  return storage.getStore()?.id ?? randomHex(16);
}
export function traceHeaders(): Record<string, string> {
  const t = storage.getStore();
  return t ? { traceparent: `00-${t.id}-${t.root}-${t.enabled ? "01" : "00"}` } : {};
}
export async function span<T>(
  name: Operation,
  fn: () => Promise<T>,
  attrs: Record<string, unknown> = {},
): Promise<T> {
  const t = storage.getStore();
  if (!t?.enabled || t.spans.length >= 96) return fn();
  const start = Date.now(),
    mono = performance.now();
  const s: DiagnosticSpan = {
    traceId: t.id,
    spanId: name === "request.admission" ? t.root : randomHex(8),
    ...(name === "request.admission" ? {} : { parentSpanId: t.root }),
    name,
    startTimeUnixNano: String(BigInt(start) * BigInt(1_000_000)),
    endTimeUnixNano: "0",
    attributes: safeAttributes(attrs),
    status: { code: 1 },
  };
  t.spans.push(s);
  let native: ReturnType<NativeTracing["startSpan"]> | undefined;
  try {
    native = t.native?.startSpan(name);
  } catch {
    /* diagnostic failures cannot change authority */
  }
  try {
    const result = await fn();
    s.attributes["twin.outcome"] = "ok";
    return result;
  } catch (e) {
    s.status.code = 2;
    s.attributes["twin.outcome"] = "failed";
    s.attributes["error.type"] = sanitizeErrorCode(
      e && typeof e === "object" && "code" in e ? e.code : null,
    );
    throw e;
  } finally {
    s.attributes["twin.duration_ms"] = Math.max(0, Math.round(performance.now() - mono));
    s.endTimeUnixNano = String(BigInt(Date.now()) * BigInt(1_000_000));
    try {
      for (const [k, v] of Object.entries(s.attributes)) native?.setAttribute(k, v);
      native?.end();
    } catch {
      /* no raw exceptions */
    }
  }
}
export function recordUsage(usage: { inputTokens: number; outputTokens: number } | null) {
  const t = storage.getStore(),
    s = t?.spans.findLast((s) => s.name === "model.invoke");
  if (s && usage)
    Object.assign(
      s.attributes,
      safeAttributes({
        "gen_ai.usage.input_tokens": usage.inputTokens,
        "gen_ai.usage.output_tokens": usage.outputTokens,
      }),
    );
}
export function otlp(spans: readonly DiagnosticSpan[]) {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "twin" } }] },
        scopeSpans: [
          {
            scope: { name: "twin.assurance", version: "1" },
            spans: spans.map((s) => ({
              ...s,
              kind: 1,
              attributes: Object.entries(s.attributes).map(([key, v]) => ({
                key,
                value: typeof v === "number" ? { intValue: String(v) } : { stringValue: v },
              })),
            })),
          },
        ],
      },
    ],
  };
}
export async function withDiagnostics<T>(
  request: Request,
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
  native?: NativeTracing,
  sink?: (s: readonly DiagnosticSpan[]) => void,
) {
  if (storage.getStore()) return fn();
  // Public trace IDs are attacker-controlled identifiers. Parse for correctness, then start a fresh root.
  // No inbound baggage/tracestate, user IDs or account-linked request IDs are recorded or forwarded.
  parseTraceparent(request.headers.get("traceparent"));
  const t: Trace = {
    id: randomHex(16),
    root: randomHex(8),
    spans: [],
    enabled: env.TWIN_DIAGNOSTICS === "1",
    native,
  };
  return storage.run(t, async () => {
    try {
      return await span("request.admission", fn);
    } finally {
      try {
        sink?.(t.spans);
        if (t.enabled && env.TWIN_OTLP_ENDPOINT) {
          const url = new URL(env.TWIN_OTLP_ENDPOINT);
          if (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          ) {
            const response = await fetch(url, {
              method: "POST",
              redirect: "manual",
              signal: AbortSignal.timeout(500),
              headers: {
                "Content-Type": "application/json",
                ...(env.TWIN_OTLP_TOKEN ? { Authorization: `Bearer ${env.TWIN_OTLP_TOKEN}` } : {}),
              },
              body: JSON.stringify(otlp(t.spans)),
            });
            await response.body?.cancel();
          }
        }
      } catch {
        /* bounded best-effort diagnostics; never retry or treat as execution evidence */
      }
    }
  });
}
