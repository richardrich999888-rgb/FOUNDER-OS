import { embeddingScores, type EmbeddingPort } from "../intelligence/embeddings";
import { principalBinding } from "./principal";
import { IntelligenceError } from "../intelligence/model";
import { z } from "zod";
import { intelligenceTools, type IntelligenceTool } from "../intelligence/agent-adapter";
import { retrieveContext } from "../intelligence/retrieval";
import { compatibleState } from "../intelligence/service";
import { tokens } from "../twin/core";
import { AgentError } from "./errors";
import { verifyCurrentPrincipal } from "./principal";
import { createToolRegistry, type AnyToolDefinition, type EvidenceItem } from "./tool-registry";
const schemas = {
  search_personal_memory: z.object({ query: z.string().trim().min(1).max(500) }).strict(),
  find_commitments: z
    .object({
      status: z.enum(["active", "confirmed", "completed", "overdue", "no-deadline", "follow-up"]),
      person: z.string().max(160),
      project: z.string().max(160),
    })
    .strict(),
  get_person_context: z.object({ entityId: z.string().uuid() }).strict(),
  get_project_context: z.object({ entityId: z.string().uuid() }).strict(),
  retrieve_procedure: z.object({ query: z.string().trim().min(1).max(500) }).strict(),
};
const evidence = z
  .object({
    sourceId: z.string().max(100),
    provenanceId: z.string().uuid().optional(),
    kind: z.enum(["memory", "document", "intelligence"]),
    label: z.string().max(500),
    excerpt: z.string().min(1).max(4000),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const result = z
  .object({ status: z.enum(["ok", "no_evidence"]), evidence: z.array(evidence).max(5) })
  .strict();
export function createIntelligenceRegistry(db: D1Database, embeddings?: EmbeddingPort) {
  const tools: AnyToolDefinition[] = intelligenceTools.map((name) => {
    const keys =
      name === "find_commitments"
        ? ["status", "person", "project"]
        : name === "get_person_context" || name === "get_project_context"
          ? ["entityId"]
          : ["query"];
    return {
      name,
      description: `Read the signed-in user's confirmed ${name.replaceAll("_", " ")}; no writes or external actions.`,
      requiredScope: "memory:read",
      sideEffects: "none",
      argsSchema: schemas[name],
      parameters: {
        type: "object",
        properties: Object.fromEntries(keys.map((k) => [k,
          k === "status" ? { type: "string", description: "Commitment lifecycle filter", enum: ["active", "confirmed", "completed", "overdue", "no-deadline", "follow-up"] } :
          k === "entityId" ? { type: "string", description: "Verified entity UUID", format: "uuid" } :
          k === "query" ? { type: "string", description: "Memory search terms", minLength: 1, maxLength: 500 } :
          { type: "string", maxLength: 160, description: "Exact name, or empty string for no filter" }
        ])),
        required: keys,
        additionalProperties: false,
      },
      resultSchema: result,
      async execute(raw: unknown, ctx) {
        if (ctx.signal.aborted) throw new AgentError("DEADLINE_EXCEEDED");
        const parsed = schemas[name].parse(raw) as {
          query?: string;
          entityId?: string;
          status?: string;
          person?: string;
          project?: string;
        };
        const s = await verifyCurrentPrincipal(ctx.principal, db);
        if (parsed.entityId) {
          const entity = s.records.find((r) => r.id === parsed.entityId)?.content;
          if (
            entity?.kind !== "entity" ||
            entity.entityType !== (name === "get_person_context" ? "person" : "project")
          )
            return { status: "no_evidence", evidence: [] };
        }
        const query =
          name === "find_commitments"
            ? {
                kind: "commitment",
                commitmentStatus: parsed.status,
                ...(parsed.person ? { person: parsed.person } : {}),
                ...(parsed.project ? { project: parsed.project } : {}),
              }
            : parsed.entityId
              ? { entityId: parsed.entityId }
              : name === "retrieve_procedure"
                ? { query: parsed.query, kind: "procedure" }
                : { query: parsed.query };
        let scores: ReadonlyMap<string,number> | undefined;
        if (embeddings && parsed.query) {
          // Local-only principals cannot cause provider disclosure, even with a miswired registry.
          if (principalBinding(ctx.principal).destination !== "provider") throw new AgentError("AUTHORIZATION_REVOKED");
          scores = await embeddingScores(s, parsed.query, embeddings, ctx.signal);
          await verifyCurrentPrincipal(ctx.principal, db);
        }
        let recalled;
        try { recalled = retrieveContext(s, query, Date.now(), scores); }
        catch (error) {
          if (error instanceof IntelligenceError && error.code === "LIMIT")
            throw new AgentError("TOOL_RESULT_TOO_LARGE");
          throw error;
        }
        // Do not turn known evidence into a false "no evidence" response or silently
        // truncate a procedure's safety-relevant steps. The full memory API remains available.
        if (recalled.results.some((r) => r.text.length > 4000))
          throw new AgentError("TOOL_RESULT_TOO_LARGE");
        const found: EvidenceItem[] = recalled.results.map((r) => ({
          sourceId: `intelligence:${r.id}:v${r.version}`,
          provenanceId: r.sourceId,
          kind: "intelligence",
          label: r.sourceLabel,
          excerpt: r.text,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        if (name === "search_personal_memory" && found.length < 5) {
          const state = compatibleState(s),
            words = tokens(parsed.query ?? "");
          const graphIds = new Set(s.records.map((r) => r.id));
          const legacy = [
            ...state.memories
              .filter((m) => m.status === "confirmed" && !graphIds.has(m.id))
              .map((m) => ({
                sourceId: `memory:${m.id}`,
                kind: "memory" as const,
                label: m.source,
                excerpt: m.text,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
              })),
            ...state.documents.flatMap((d) =>
              d.text
                .split(/\n\s*\n/)
                .flatMap((p) => p.match(/[\s\S]{1,650}/g) ?? [])
                .map((text, i) => ({
                  sourceId: `document:${d.id}#${i}`,
                  kind: "document" as const,
                  label: d.name,
                  excerpt: text,
                  createdAt: d.createdAt,
                  updatedAt: d.createdAt,
                })),
            ),
          ];
          found.push(
            ...legacy
              .map((r) => ({ r, score: words.filter((w) => tokens(r.excerpt).includes(w)).length }))
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5 - found.length)
              .map((x) => x.r),
          );
        }
        await verifyCurrentPrincipal(ctx.principal, db);
        if (ctx.signal.aborted) throw new AgentError("DEADLINE_EXCEEDED");
        let budget = 16000;
        const bounded = found.filter((r) => {
          const size = JSON.stringify(r).length;
          if (size > budget) return false;
          budget -= size;
          return true;
        });
        return { status: bounded.length ? "ok" : "no_evidence", evidence: bounded };
      },
      summarize: (r) => r,
    };
  });
  return createToolRegistry(tools);
}
export { intelligenceTools };
export type { IntelligenceTool };
