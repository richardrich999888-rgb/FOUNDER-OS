import { createEmbeddingPort } from "../intelligence/embeddings";
import { z } from "zod";
import type { Identity } from "../security/identity";
import { createChatCompletionsModel } from "./chat-completions-adapter";
import { createVerifiedPrincipal, verifyCurrentPrincipal } from "./principal";
import { createIntelligenceRegistry, intelligenceTools } from "./intelligence-tools";
import { admitAgent } from "./admission";
import { createD1ReceiptStore } from "./receipts";
import { runAgent } from "./runtime";
import { systemClock } from "./deadline";
import { PRODUCTION_LIMITS } from "./limits";

export const modelRunSchema = z
  .object({
    mode: z.literal("model"),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(4000),
  })
  .strict();

// Configuration is server-owned; request bodies cannot select a destination or credential.
export async function runModelIntelligence(
  user: Identity,
  input: unknown,
  db: D1Database,
  env: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
) {
  const p = modelRunSchema.parse(input);
  if (!env.TWIN_AGENT_ENDPOINT || !env.TWIN_AGENT_MODEL)
    return { status: 503, body: { error: "The agent model is not configured." } };
  // Even loopback inference requires explicit context-sharing consent. It is a separate process.
  const principal = await createVerifiedPrincipal(user, intelligenceTools, "provider", db);
  const model = createChatCompletionsModel({
    endpoint: env.TWIN_AGENT_ENDPOINT,
    model: env.TWIN_AGENT_MODEL,
    apiKey: env.TWIN_AGENT_API_KEY,
    fetchImpl,
  });
  const embeddings = createEmbeddingPort(env, fetchImpl);
  const admission = await admitAgent(principal, p.requestId, Date.now(), db);
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
  const result = await runAgent(
    { principal, requestId: p.requestId, message: p.message },
    {
      model,
      registry: createIntelligenceRegistry(db, embeddings),
      receipts: createD1ReceiptStore(
        db,
        principal,
        p.requestId,
        Date.now() + PRODUCTION_LIMITS.totalDeadlineMs,
      ),
      clock: systemClock,
      newId: () => crypto.randomUUID(),
      limits: PRODUCTION_LIMITS,
      requireEvidence: true,
      initialTool: "search_personal_memory",
      validateContext: () => verifyCurrentPrincipal(principal, db).then(() => undefined),
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
      mode: "ai",
      sources: result.sources,
      execution: {
        ...result,
        answer: undefined,
        sources: undefined,
        requestId: p.requestId,
        planner: "chat-completions",
        model: env.TWIN_AGENT_MODEL,
      },
      ...(result.status === "failed"
        ? { error: "The run could not safely return current evidence." }
        : {}),
    },
  };
}
