/**
 * Atomic admission control for Live AI requests (duplicate + rate limit).
 *
 * The original route did SELECT-then-INSERT, which (a) let two concurrent requests both pass
 * the rate check and (b) turned a concurrent duplicate requestId into a 500 (PK violation).
 * Here admission is ONE conditional INSERT statement; SQLite/D1 executes a single statement
 * atomically, so the count check and the insert cannot interleave with another request.
 */
import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/** Existing prototype limits, unchanged: 40 requests / 24h and 3 requests / 60s per user. */
export const DAILY_REQUEST_LIMIT = 40;
export const MINUTE_REQUEST_LIMIT = 3;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export type AdmissionResult = 'admitted' | 'duplicate' | 'rate_limited';

export type AdmissionPort = Readonly<{
  admit(userId: string, requestId: string, now: number): Promise<AdmissionResult>;
}>;

type Db = DrizzleD1Database<Record<string, unknown>>;

export function createD1Admission(db: Db): AdmissionPort {
  return Object.freeze({
    async admit(userId: string, requestId: string, now: number): Promise<AdmissionResult> {
      const inserted = await db.all<{ id: string }>(sql`
        INSERT INTO twin_ai_requests (id, user_id, created_at)
        SELECT ${requestId}, ${userId}, ${now}
        WHERE (SELECT COUNT(*) FROM twin_ai_requests WHERE user_id = ${userId} AND created_at >= ${now - DAY_MS}) < ${DAILY_REQUEST_LIMIT}
          AND (SELECT COUNT(*) FROM twin_ai_requests WHERE user_id = ${userId} AND created_at > ${now - MINUTE_MS}) < ${MINUTE_REQUEST_LIMIT}
        ON CONFLICT(id) DO NOTHING
        RETURNING id`);
      if (inserted.length === 1) return 'admitted';
      const existing = await db.all<{ id: string }>(sql`SELECT id FROM twin_ai_requests WHERE id = ${requestId}`);
      return existing.length ? 'duplicate' : 'rate_limited';
    },
  });
}
