import { z } from "zod";
import { isVerifiedIdentity, type Identity } from "../security/identity";
import { authorize } from "../security/authorize";
import { IntelligenceError } from "./model";
import { readSnapshot, intelligenceDb } from "./store";
import { retrieveContext } from "./retrieval";

export const intelligenceTools = [
  "search_personal_memory",
  "find_commitments",
  "get_person_context",
  "get_project_context",
  "retrieve_procedure",
] as const;
export type IntelligenceTool = (typeof intelligenceTools)[number];
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
declare const brand: unique symbol;
export type IntelligenceGrant = Readonly<{ [brand]: true }>;
const grants = new WeakMap<
  object,
  {
    identity: Identity;
    generation: string;
    tools: ReadonlySet<string>;
    expiresAt: number;
    used: number;
  }
>();

// Trusted composition-root capability. Never expose this as an agent tool or
// accept serialized grants, owner IDs, scopes or approval claims from a model.
export async function grantIntelligenceTools(
  user: Identity,
  tools: readonly IntelligenceTool[],
  db?: D1Database,
): Promise<IntelligenceGrant> {
  authorize(user, "tools.delegate", user?.userId);
  if (!tools.length || tools.some((t) => !intelligenceTools.includes(t)))
    throw new IntelligenceError("DENIED");
  const s = await readSnapshot(user, db);
  if (!s.legacy.aiConsent) throw new IntelligenceError("DENIED");
  const grant = Object.freeze({}) as IntelligenceGrant;
  grants.set(grant, {
    identity: user,
    generation: s.generation,
    tools: new Set(tools),
    expiresAt: Math.min(user.expiresAt, Date.now() + 60000),
    used: 0,
  });
  return grant;
}

export async function executeIntelligenceTool(
  grant: IntelligenceGrant,
  tool: string,
  args: unknown,
  db = intelligenceDb(),
) {
  const g = typeof grant === "object" && grant !== null ? grants.get(grant) : undefined;
  if (!g || !isVerifiedIdentity(g.identity) || g.expiresAt <= Date.now() || g.used >= 5)
    throw new IntelligenceError("DENIED");
  g.used++;
  const validTool = intelligenceTools.includes(tool as IntelligenceTool) && g.tools.has(tool);
  const parsed = validTool ? schemas[tool as IntelligenceTool].safeParse(args) : null;
  const s = await readSnapshot(g.identity, db);
  if (s.generation !== g.generation || !s.legacy.aiConsent) throw new IntelligenceError("DENIED");
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  const allowed = !!parsed?.success;
  await db
    .prepare(
      "INSERT INTO twin_intelligence_receipts(id,owner,generation,tool,status,created_at,completed_at,epoch) VALUES(?,?,?,?,?,?,?,?)",
    )
    .bind(
      id,
      s.owner,
      s.generation,
      validTool ? tool : "unregistered",
      allowed ? "started" : "denied",
      now,
      allowed ? null : now,
      s.epoch,
    )
    .run();
  if (!allowed || !parsed?.success) throw new IntelligenceError("DENIED");
  try {
    const a = parsed.data as {
      query?: string;
      entityId?: string;
      status?: string;
      person?: string;
      project?: string;
    };
    if (a.entityId) {
      const entity = s.records.find((r) => r.id === a.entityId);
      if (
        entity?.content?.kind !== "entity" ||
        entity.content.entityType !== (tool === "get_person_context" ? "person" : "project")
      )
        throw new IntelligenceError("PROVENANCE");
    }
    const query =
      tool === "find_commitments"
        ? {
            query: "",
            kind: "commitment",
            commitmentStatus: a.status,
            ...(a.person ? { person: a.person } : {}),
            ...(a.project ? { project: a.project } : {}),
          }
        : a.entityId
          ? { query: "", entityId: a.entityId }
          : tool === "retrieve_procedure"
            ? { query: a.query, kind: "procedure" }
            : { query: a.query };
    const result = retrieveContext(s, query);
    const current = await readSnapshot(g.identity, db);
    if (
      !isVerifiedIdentity(g.identity) ||
      g.expiresAt <= Date.now() ||
      current.generation !== s.generation ||
      current.epoch !== s.epoch ||
      !current.legacy.aiConsent
    )
      throw new IntelligenceError("CONFLICT");
    const completed = await db
      .prepare(
        "UPDATE twin_intelligence_receipts SET status='succeeded',completed_at=? WHERE id=? AND owner=? AND generation=? AND status='started' AND EXISTS(SELECT 1 FROM twin_intelligence_heads WHERE owner=? AND generation=? AND epoch=?) RETURNING id",
      )
      .bind(new Date().toISOString(), id, s.owner, s.generation, s.owner, s.generation, s.epoch)
      .all();
    if (completed.results.length !== 1) throw new IntelligenceError("CONFLICT");
    return {
      ...result,
      receipt: { id, tool, status: "succeeded" as const, source: "standalone-adapter" as const },
    };
  } catch (error) {
    await db
      .prepare(
        "UPDATE twin_intelligence_receipts SET status='failed',completed_at=? WHERE id=? AND owner=? AND generation=? AND status='started'",
      )
      .bind(new Date().toISOString(), id, s.owner, s.generation)
      .run();
    throw error;
  }
}

// An eventual agent must call this again immediately before every provider
// disclosure/final response. A receipt is evidence of a read, not lasting authority.
export async function validateContextEnvelope(
  user: Identity,
  envelope: { epoch: number; generation: string },
  db?: D1Database,
) {
  const s = await readSnapshot(user, db);
  if (s.epoch !== envelope.epoch || s.generation !== envelope.generation || !s.legacy.aiConsent)
    throw new IntelligenceError("CONFLICT");
}
