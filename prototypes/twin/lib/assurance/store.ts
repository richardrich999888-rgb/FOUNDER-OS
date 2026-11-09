import type { Identity } from "../security/identity";
import { authorize } from "../security/authorize";
import type { Snapshot } from "../intelligence/model";
import { readSnapshot } from "../intelligence/store";
import { runBounded } from "../agent/deadline";
import { AssuranceError, type Workflow, type WorkflowState, type Reason } from "./model";
import { correlationId, span } from "./telemetry";
export const sqlNow = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
export async function bounded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await runBounded(fn, 5000, new AbortController().signal, "DEADLINE_EXCEEDED");
  } catch (e) {
    if (e instanceof AssuranceError) throw e;
    throw new AssuranceError("UNAVAILABLE");
  }
}
export async function current(user: Identity, db: D1Database) {
  authorize(user, "assurance.read", user?.userId);
  return bounded(() => readSnapshot(user, db));
}
export async function workflow(user: Identity, db: D1Database, id: string): Promise<Workflow> {
  authorize(user, "assurance.read", user?.userId);
  const w = await bounded(() =>
    db
      .prepare(
        "SELECT w.* FROM twin_workflows w JOIN twin_accounts a ON a.user_id=w.owner AND a.generation=w.generation WHERE w.owner=? AND w.id=?",
      )
      .bind(user.userId, id)
      .first<Workflow>(),
  );
  authorize(user, "assurance.read", user.userId);
  if (!w) throw new AssuranceError("NOT_FOUND");
  return w;
}
type Change = {
  state: WorkflowState;
  reason: Reason;
  actor: Workflow["actor"];
  authorizationId?: string | null;
  runId?: string;
  leaseUntil?: number;
  attempts?: number;
};
export async function transition(
  user: Identity,
  db: D1Database,
  s: Snapshot,
  w: Workflow,
  c: Change,
  extra: D1PreparedStatement[] = [],
) {
  authorize(user, "assurance.write", w.owner);
  const now = Date.now();
  const guard = db
    .prepare("INSERT INTO twin_workflow_guard VALUES(?,?,?,?,?,?)")
    .bind(
      user.userId,
      s.generation,
      w.id,
      w.version,
      s.epoch,
      Math.min(user.expiresAt, now + 5000),
    );
  try {
    await span("workflow.transition", () =>
      bounded(() =>
        db.batch([
          guard,
          ...extra,
          db
            .prepare(
              "UPDATE twin_workflows SET state=?,reason=?,actor=?,authorization_id=?,run_id=?,lease_until=?,attempts=?,version=version+1,updated_at=?,correlation_id=? WHERE owner=? AND generation=? AND id=? AND version=?",
            )
            .bind(
              c.state,
              c.reason,
              c.actor,
              c.authorizationId === undefined ? w.authorization_id : c.authorizationId,
              c.runId ?? w.run_id,
              c.leaseUntil ?? w.lease_until,
              c.attempts ?? w.attempts,
              now,
              correlationId(),
              user.userId,
              s.generation,
              w.id,
              w.version,
            ),
          db
            .prepare("DELETE FROM twin_workflow_guard WHERE owner=? AND workflow_id=?")
            .bind(user.userId, w.id),
        ]),
      ),
    );
  } catch {
    // The guarded batch is atomic. A changed account/workflow is a conflict; unknown DB errors stay unavailable.
    const fresh = await workflow(user, db, w.id);
    if (fresh.version !== w.version || fresh.generation !== w.generation)
      throw new AssuranceError("CONFLICT");
    throw new AssuranceError("UNAVAILABLE");
  }
  return workflow(user, db, w.id);
}
export async function listWorkflows(user: Identity, db: D1Database) {
  authorize(user, "assurance.read", user?.userId);
  const result = await bounded(() =>
    db
      .prepare("SELECT * FROM twin_workflows WHERE owner=? ORDER BY updated_at DESC LIMIT 101")
      .bind(user.userId)
      .all<Workflow>(),
  );
  if (result.results.length > 100) throw new AssuranceError("LIMIT");
  return result.results;
}
