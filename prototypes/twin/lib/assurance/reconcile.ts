import type { Identity } from "../security/identity";
import { authorize } from "../security/authorize";
import { intelligenceTools } from "../agent/intelligence-tools";
import { checkpoint, digest, planSchema, type Workflow } from "./model";
import { bounded } from "./store";
import { span } from "./telemetry";
export type Run = {
  request_id: string;
  user_id: string;
  generation: string;
  epoch: number;
  status: string;
  started_at: number;
  completed_at: number | null;
  deadline_at: number;
  tool_executions: number;
  error_code: string | null;
};
export type Receipt = {
  execution_id: string;
  request_id: string;
  user_id: string;
  generation: string;
  call_index: number;
  tool_id: string;
  authorization: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  error_code: string | null;
  source_ids: string;
};
export type Authorization = {
  id: string;
  owner: string;
  generation: string;
  workflow_id: string;
  epoch: number;
  plan_hash: string;
  issued_at: number;
  expires_at: number;
  requires_consent: number;
};
export type Outcome = {
  manifest_hash: string;
  receipt_count: number;
  observed_at: number;
  authorization_id: string;
  run_id: string;
};
export type Conclusion = {
  conclusion: "VERIFIED" | "DIVERGENT" | "CANNOT_PROVE";
  reason: string;
  scope: "bounded-read-execution";
  receiptCount: number;
  partial: boolean;
};
export const manifest = (run: Run, receipts: Receipt[]) => digest([run, receipts]);
export async function readEvidence(user: Identity, db: D1Database, id: string) {
  authorize(user, "assurance.read", user?.userId);
  const where = "owner=? AND w.id=?";
  const rs = await bounded(() =>
    db.batch([
      db.prepare(`SELECT w.* FROM twin_workflows w WHERE w.${where}`).bind(user.userId, id),
      db
        .prepare(
          `SELECT a.* FROM twin_workflow_authorizations a JOIN twin_workflows w ON w.owner=a.owner AND w.authorization_id=a.id WHERE w.${where}`,
        )
        .bind(user.userId, id),
      db
        .prepare(
          `SELECT r.* FROM agent_runs r JOIN twin_workflows w ON w.owner=r.user_id AND w.generation=r.generation AND w.run_id=r.request_id WHERE w.${where}`,
        )
        .bind(user.userId, id),
      db
        .prepare(
          `SELECT e.* FROM agent_execution_receipts e JOIN twin_workflows w ON w.owner=e.user_id AND w.generation=e.generation AND w.run_id=e.request_id WHERE w.${where} ORDER BY e.call_index`,
        )
        .bind(user.userId, id),
      db
        .prepare(
          `SELECT o.* FROM twin_workflow_outcomes o JOIN twin_workflows w ON w.owner=o.owner AND w.generation=o.generation AND w.run_id=o.run_id WHERE w.${where}`,
        )
        .bind(user.userId, id),
      db
        .prepare(
          "SELECT version,previous_state,new_state,at,actor,authorization_id,run_id,reason,correlation_id FROM twin_workflow_events WHERE owner=? AND workflow_id=? ORDER BY version",
        )
        .bind(user.userId, id),
    ]),
  );
  authorize(user, "assurance.read", user.userId);
  return {
    w: rs[0].results[0] as Workflow | undefined,
    auth: rs[1].results[0] as Authorization | undefined,
    run: rs[2].results[0] as Run | undefined,
    receipts: rs[3].results as Receipt[],
    outcome: rs[4].results[0] as Outcome | undefined,
    events: rs[5].results as {
      version: number;
      previous_state: string | null;
      new_state: string;
    }[],
  };
}
export async function checkExecution(
  w: Workflow,
  a: Authorization | undefined,
  r: Run | undefined,
  receipts: Receipt[],
): Promise<Conclusion> {
  const result = (conclusion: Conclusion["conclusion"], reason: string): Conclusion => ({
    conclusion,
    reason,
    scope: "bounded-read-execution",
    receiptCount: receipts.length,
    partial:
      receipts.some((e) => e.status === "succeeded") &&
      receipts.some((e) => e.status !== "succeeded"),
  });
  try {
    const plan = planSchema.parse(JSON.parse(w.plan));
    if ((await digest(plan)) !== w.plan_hash || (await checkpoint(w)) !== w.checkpoint_hash)
      return result("DIVERGENT", "CHECKPOINT_MISMATCH");
    if (!a || !r || !receipts.length) return result("CANNOT_PROVE", "MISSING_EXECUTION_EVIDENCE");
    if (
      a.id !== w.authorization_id ||
      a.owner !== w.owner ||
      a.generation !== w.generation ||
      a.workflow_id !== w.id ||
      a.plan_hash !== w.plan_hash ||
      r.user_id !== w.owner ||
      r.generation !== w.generation ||
      r.request_id !== w.run_id ||
      r.epoch !== a.epoch
    )
      return result("DIVERGENT", "AUTHORITY_MISMATCH");
    if (
      r.started_at < a.issued_at ||
      (r.completed_at !== null &&
        (r.completed_at > a.expires_at ||
          r.completed_at > w.deadline_at ||
          r.completed_at > (w.lease_until ?? 0) ||
          r.completed_at < r.started_at))
    )
      return result("DIVERGENT", "EXECUTION_OUTSIDE_AUTHORIZATION");
    if (
      r.status !== "completed" ||
      r.completed_at === null ||
      receipts.some((e) => e.status !== "succeeded")
    )
      return result("CANNOT_PROVE", "EXECUTION_UNFINISHED");
    if (
      !Number.isInteger(r.tool_executions) ||
      r.tool_executions < receipts.length ||
      receipts.some(
        (e, i) =>
          !Number.isInteger(e.call_index) ||
          e.call_index < 0 ||
          e.call_index >= r.tool_executions ||
          (i > 0 && e.call_index <= receipts[i - 1].call_index) ||
          e.request_id !== r.request_id ||
          e.user_id !== w.owner ||
          e.generation !== w.generation ||
          e.authorization !== "allow" ||
          e.error_code !== null ||
          e.completed_at === null ||
          e.started_at < r.started_at ||
          e.completed_at < e.started_at ||
          e.completed_at > r.completed_at! ||
          e.duration_ms !== e.completed_at - e.started_at ||
          !intelligenceTools.includes(e.tool_id as (typeof intelligenceTools)[number]),
      )
    )
      return result("DIVERGENT", "RECEIPT_CONTRADICTION");
    if (r.tool_executions > receipts.length)
      return result("CANNOT_PROVE", "MISSING_EXECUTION_RECEIPTS");
    if (plan.mode === "local" && (receipts.length !== 1 || receipts[0].tool_id !== plan.tool))
      return result("DIVERGENT", "PLAN_EXECUTION_MISMATCH");
    return result("VERIFIED", "EXECUTOR_RECORDS_AGREE");
  } catch {
    return result("DIVERGENT", "INVALID_EVIDENCE_FORMAT");
  }
}
export async function reconcile(user: Identity, db: D1Database, id: string) {
  return span("workflow.reconcile", async () => {
    const e = await readEvidence(user, db, id),
      w = e.w;
    const none: Conclusion = {
      conclusion: "CANNOT_PROVE",
      reason: "WORKFLOW_UNAVAILABLE",
      scope: "bounded-read-execution",
      receiptCount: 0,
      partial: false,
    };
    if (!w) return { ...none, events: [] };
    let result = await checkExecution(w, e.auth, e.run, e.receipts);
    if (
      e.events.some(
        (v, i) =>
          v.version < 0 ||
          v.version > w.version ||
          (v.version === 0 && v.previous_state !== null) ||
          (i > 0 &&
            v.version === e.events[i - 1].version + 1 &&
            v.previous_state !== e.events[i - 1].new_state),
      ) ||
      (e.events.at(-1)?.version === w.version && e.events.at(-1)?.new_state !== w.state)
    )
      result = { ...result, conclusion: "DIVERGENT", reason: "TRANSITION_HISTORY_MISMATCH" };
    else if (e.events.length !== w.version + 1 && result.conclusion !== "DIVERGENT")
      result = { ...result, conclusion: "CANNOT_PROVE", reason: "MISSING_TRANSITION_HISTORY" };
    else if (result.conclusion === "VERIFIED") {
      if (!e.outcome)
        result = { ...result, conclusion: "CANNOT_PROVE", reason: "MISSING_PERSISTED_OUTCOME" };
      else if (
        e.outcome.authorization_id !== w.authorization_id ||
        e.outcome.run_id !== w.run_id ||
        e.outcome.receipt_count !== e.receipts.length ||
        e.outcome.observed_at < e.run!.completed_at! ||
        e.outcome.manifest_hash !== (await manifest(e.run!, e.receipts))
      )
        result = { ...result, conclusion: "DIVERGENT", reason: "OUTCOME_MANIFEST_MISMATCH" };
      else if (w.state !== "COMPLETED")
        result = { ...result, conclusion: "DIVERGENT", reason: "OUTCOME_STATE_MISMATCH" };
    }
    return { ...result, events: e.events };
  });
}
