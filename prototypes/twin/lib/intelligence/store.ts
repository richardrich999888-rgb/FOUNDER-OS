import { env } from "cloudflare:workers";
import { authorize } from "../security/authorize";
import type { Identity } from "../security/identity";
import {
  contentSchema,
  IntelligenceError,
  type Snapshot,
  type RecordNode,
  type Dependency,
} from "./model";

export function intelligenceDb(): D1Database {
  if (!env.DB) throw new IntelligenceError("UNAVAILABLE");
  return env.DB;
}

// D1 batch executes these reads in one transaction: legacy state, graph and epoch
// cannot describe different committed instants. No global or per-user result cache.
export async function readSnapshot(user: Identity, db = intelligenceDb()): Promise<Snapshot> {
  authorize(user, "intelligence.read", user?.userId);
  try {
    const result = await db.batch([
      db
        .prepare(
          "SELECT h.owner,h.generation,h.epoch,a.state,a.version FROM twin_intelligence_heads h JOIN twin_accounts a ON a.user_id=h.owner AND a.generation=h.generation WHERE h.owner=?",
        )
        .bind(user.userId),
      db
        .prepare("SELECT * FROM twin_intelligence_records WHERE owner=? LIMIT 1001")
        .bind(user.userId),
      db
        .prepare(
          "SELECT record_id,ancestor_id FROM twin_intelligence_dependencies WHERE owner=? LIMIT 8001",
        )
        .bind(user.userId),
    ]);
    authorize(user, "intelligence.read", user.userId);
    const header = result[0].results[0] as
      | { owner: string; generation: string; epoch: number; state: string; version: number }
      | undefined;
    if (!header) throw new IntelligenceError("NOT_FOUND");
    if (result[1].results.length > 1000 || result[2].results.length > 8000)
      throw new IntelligenceError("LIMIT");
    const records = result[1].results.map((raw) => {
      const row = raw as Record<string, unknown>;
      const content =
        row.content === null ? null : contentSchema.parse(JSON.parse(row.content as string));
      return {
        id: row.id,
        owner: row.owner,
        generation: row.generation,
        kind: row.kind,
        sourceId: row.source_id,
        content,
        quote: row.quote,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        confirmation: row.confirmation,
        validity: row.validity,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        privacy: row.privacy,
        version: row.version,
      } as RecordNode;
    });
    return {
      owner: header.owner,
      generation: header.generation,
      epoch: header.epoch,
      accountVersion: header.version,
      legacy: JSON.parse(header.state),
      records,
      dependencies: result[2].results.map((raw) => {
        const r = raw as { record_id: string; ancestor_id: string };
        return { recordId: r.record_id, ancestorId: r.ancestor_id };
      }),
    };
  } catch (error) {
    if (
      error instanceof IntelligenceError ||
      (error instanceof Error && error.message === "DENIED")
    )
      throw error;
    throw new IntelligenceError("UNAVAILABLE");
  }
}

export type Mutation = {
  upsert: RecordNode[];
  dependencies?: Dependency[];
  legacy?: Snapshot["legacy"];
};
export async function commitMutation(
  user: Identity,
  s: Snapshot,
  change: Mutation,
  db = intelligenceDb(),
) {
  authorize(user, "intelligence.write", s.owner);
  if (
    s.records.length +
      change.upsert.filter((r) => !s.records.some((old) => old.id === r.id)).length >
    1000
  )
    throw new IntelligenceError("LIMIT");
  const edges = new Set(s.dependencies.map((d) => `${d.recordId}:${d.ancestorId}`));
  for (const d of change.dependencies ?? []) edges.add(`${d.recordId}:${d.ancestorId}`);
  if (edges.size > 8000) throw new IntelligenceError("LIMIT");
  const statements = [
    db
      .prepare("INSERT INTO twin_intelligence_guard(owner,generation,expected_epoch) VALUES(?,?,?)")
      .bind(user.userId, s.generation, s.epoch),
  ];
  // Changing legacy state is reserved for an explicit forget operation. Its
  // version must still match the snapshot; NULL deliberately aborts the batch.
  if (change.legacy)
    statements.push(
      db
        .prepare(
          "UPDATE twin_accounts SET state=?,version=CASE WHEN version=? THEN version+1 ELSE NULL END WHERE user_id=? AND generation=?",
        )
        .bind(JSON.stringify(change.legacy), s.accountVersion, user.userId, s.generation),
    );
  for (const r of change.upsert) {
    if (r.owner !== user.userId || r.generation !== s.generation)
      throw new IntelligenceError("DENIED");
    statements.push(
      db
        .prepare(
          `INSERT INTO twin_intelligence_records(owner,generation,id,kind,source_id,content,quote,created_at,updated_at,confirmation,validity,valid_from,valid_to,privacy,version)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET content=excluded.content,quote=excluded.quote,updated_at=excluded.updated_at,confirmation=excluded.confirmation,validity=excluded.validity,valid_to=excluded.valid_to,privacy=excluded.privacy,version=excluded.version`,
        )
        .bind(
          user.userId,
          s.generation,
          r.id,
          r.kind,
          r.sourceId,
          r.content ? JSON.stringify(r.content) : null,
          r.quote,
          r.createdAt,
          r.updatedAt,
          r.confirmation,
          r.validity,
          r.validFrom,
          r.validTo,
          r.privacy,
          r.version,
        ),
    );
  }
  for (const d of change.dependencies ?? [])
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO twin_intelligence_dependencies(owner,record_id,ancestor_id) VALUES(?,?,?)",
        )
        .bind(user.userId, d.recordId, d.ancestorId),
    );
  statements.push(
    db
      .prepare("DELETE FROM twin_intelligence_guard WHERE owner=? AND generation=?")
      .bind(user.userId, s.generation),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    // Error text is inspected only for classification, never returned or logged.
    const msg = error instanceof Error ? error.message : "";
    if (
      /INTELLIGENCE_CONFLICT|NOT NULL constraint failed: twin_accounts.version|FOREIGN KEY constraint failed/.test(
        msg,
      )
    )
      throw new IntelligenceError("CONFLICT");
    throw new IntelligenceError("UNAVAILABLE");
  }
  return s.epoch + 1;
}

export async function eraseAccount(
  user: Identity,
  version: number,
  generation: string,
  db = intelligenceDb(),
) {
  authorize(user, "erase", user.userId);
  const result = await db.batch([
    db
      .prepare(
        "DELETE FROM twin_ai_requests WHERE user_id=? AND EXISTS(SELECT 1 FROM twin_accounts WHERE user_id=? AND version=? AND generation=?)",
      )
      .bind(user.userId, user.userId, version, generation),
    db
      .prepare(
        "DELETE FROM twin_accounts WHERE user_id=? AND version=? AND generation=? RETURNING user_id",
      )
      .bind(user.userId, version, generation),
  ]);
  return result[1].results.length === 1;
}

// Conditional INSERT is atomic with account deletion on D1. An in-flight live-AI
// request cannot recreate usage metadata after erase/reinitialization.
export async function reserveAiRequest(
  user: Identity,
  s: Snapshot,
  id: string,
  now: number,
  db = intelligenceDb(),
) {
  authorize(user, "chat.ai", s.owner);
  const inserted = await db
    .prepare(
      "INSERT INTO twin_ai_requests(id,user_id,created_at) SELECT ?,user_id,? FROM twin_accounts WHERE user_id=? AND generation=? AND version=? RETURNING id",
    )
    .bind(id, now, user.userId, s.generation, s.accountVersion)
    .all();
  return inserted.results.length === 1;
}
