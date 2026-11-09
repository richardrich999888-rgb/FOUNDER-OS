// Deterministic, local-only planner over the real P0-002 executor. No model call.
import { z } from "zod";
import type { Identity } from "../security/identity";
import { admitAgent } from "./admission";
import { createVerifiedPrincipal, verifyCurrentPrincipal } from "./principal";
import { createD1ReceiptStore } from "./receipts";
import { runAgent } from "./runtime";
import { createIntelligenceRegistry, intelligenceTools } from "./intelligence-tools";
import { PRODUCTION_LIMITS } from "./limits";
import { systemClock } from "./deadline";
import type { ModelPort } from "./model-port";
import type { RunControls } from "./run-controls";
export const localRunSchema = z
  .object({ requestId: z.string().uuid(), tool: z.enum(intelligenceTools), args: z.unknown() })
  .strict();
export async function runLocalIntelligence(user: Identity, input: unknown, db: D1Database, controls: RunControls = {}) {
  const p = localRunSchema.parse(input),
    registry = createIntelligenceRegistry(db);
  const args = registry.get(p.tool)!.argsSchema.parse(p.args);
  const principal = await createVerifiedPrincipal(user, [p.tool], "local", db),
    admission = await admitAgent(principal, p.requestId, Date.now(), db);
  if (admission !== "admitted")
    return {
      status: admission === "duplicate" ? 409 : 429,
      body: {
        error:
          admission === "duplicate"
            ? "This request was already submitted."
            : "The private-alpha request limit has been reached.",
      },
    };
  const planner: ModelPort = {
    async respond(request) {
      return request.items.some((i) => i.type === "tool_result")
        ? { text: "", toolCalls: [], usage: null, truncated: false }
        : {
            text: "",
            toolCalls: [
              { callId: crypto.randomUUID(), name: p.tool, argumentsJson: JSON.stringify(args) },
            ],
            usage: null,
            truncated: false,
          };
    },
  };
  const result = await runAgent(
    {
      principal,
      requestId: p.requestId,
      message: "Retrieve explicitly selected personal evidence.",
    },
    {
      model: planner,
      registry,
      receipts: createD1ReceiptStore(
        db,
        principal,
        p.requestId,
        Math.min(Date.now() + PRODUCTION_LIMITS.totalDeadlineMs, controls.deadlineAt ?? Infinity),
        controls.workflow,
      ),
      clock: systemClock,
      newId: () => crypto.randomUUID(),
      limits: PRODUCTION_LIMITS,
      evidenceOnly: true,
      plannerKind: "deterministic-local",
      controls,
      validateContext: async () => { await verifyCurrentPrincipal(principal, db); await controls.validateContext?.(); },
    },
  );
  return {
    status:
      result.status === "completed"
        ? 200
        : result.errorCode === "AUTHORIZATION_REVOKED"
          ? 409
          : 503,
    body: {
      text: result.answer,
      mode: "memory",
      sources: result.sources.map((s) => ({
        label: s.label,
        excerpt: s.excerpt,
        sourceId: s.sourceId,
        provenanceId: s.provenanceId,
        citation: s.citation,
      })),
      execution: {
        requestId: p.requestId,
        planner: "deterministic-local",
        ...result,
        answer: undefined,
        sources: undefined,
      },
      ...(result.status === "failed"
        ? { error: "The run could not safely return current evidence." }
        : {}),
    },
  };
}
