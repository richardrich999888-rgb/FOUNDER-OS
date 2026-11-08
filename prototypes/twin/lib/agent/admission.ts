import { principalBinding, verifyCurrentPrincipal, type VerifiedPrincipal } from "./principal";
export type AdmissionResult = "admitted" | "duplicate" | "rate_limited";
export async function admitAgent(
  principal: VerifiedPrincipal,
  requestId: string,
  now: number,
  db: D1Database,
): Promise<AdmissionResult> {
  await verifyCurrentPrincipal(principal, db);
  const b = principalBinding(principal),
    owner = principal.userId;
  const r = await db
    .prepare(
      `INSERT INTO twin_ai_requests(id,user_id,created_at) SELECT ?,a.user_id,? FROM twin_accounts a JOIN twin_intelligence_heads h ON h.owner=a.user_id AND h.generation=a.generation WHERE a.user_id=? AND h.generation=? AND h.epoch=?
 AND ?>=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND (SELECT COUNT(*) FROM twin_ai_requests WHERE user_id=? AND created_at>=?)<40
 AND (SELECT COUNT(*) FROM twin_ai_requests WHERE user_id=? AND created_at>?)<3
 ON CONFLICT(id) DO NOTHING RETURNING id`,
    )
    .bind(
      requestId,
      now,
      owner,
      b.generation,
      b.epoch,
      b.identity.expiresAt,
      owner,
      now - 86400000,
      owner,
      now - 60000,
    )
    .all();
  if (r.results.length === 1) return "admitted";
  await verifyCurrentPrincipal(principal, db);
  const duplicate = await db
    .prepare("SELECT id FROM twin_ai_requests WHERE id=?")
    .bind(requestId)
    .first();
  return duplicate ? "duplicate" : "rate_limited";
}
