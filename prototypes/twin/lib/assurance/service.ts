import { authorize } from "../security/authorize";
import type { Identity } from "../security/identity";
import { eligibleRecords } from "../intelligence/retrieval";
import { createIntelligenceRegistry } from "../agent/intelligence-tools";
import { runLocalIntelligence } from "../agent/local-run";
import { runModelIntelligence } from "../agent/model-run";
import type { RunControls } from "../agent/run-controls";
import {
  AssuranceError,
  commandSchema,
  planSchema,
  checkpoint,
  digest,
  terminal,
  type Workflow,
} from "./model";
import { bounded, current, workflow, transition, listWorkflows, sqlNow } from "./store";
import { checkExecution, readEvidence, manifest, reconcile } from "./reconcile";
import { priorities, type PriorityOverride } from "./priorities";
import { correlationId, span } from "./telemetry";
import type { Snapshot } from "../intelligence/model";

function references(s: Snapshot, w: Workflow[]) {
  return new Set([
    ...eligibleRecords(s).map((r) => `intelligence:${r.id}`),
    ...s.legacy.tasks.map((t) => `task:${t.id}`),
    ...w.map((f) => `workflow:${f.id}`),
  ]);
}
function publicWorkflow(w: Workflow) {
  const plan = planSchema.safeParse(JSON.parse(w.plan));
  return {
    id: w.id,
    intent: w.intent,
    understood: plan.success
      ? plan.data.mode === "local"
        ? `Retrieve saved context using ${plan.data.tool.replaceAll("_", " ")}.`
        : "Ask the configured model to retrieve and explain saved context."
      : "This checkpoint needs attention.",
    plan: plan.success ? plan.data : null,
    sourceRefs: JSON.parse(w.source_refs),
    dependencies: JSON.parse(w.dependencies),
    state: w.state,
    version: w.version,
    reason: w.reason,
    attempts: w.attempts,
    deadlineAt: w.deadline_at,
    updatedAt: w.updated_at,
    permissions:
      plan.success && plan.data.mode === "model"
        ? [
            "Read saved context",
            "Share saved context with the configured inference server; optional semantic search may share up to 64 eligible records",
          ]
        : ["Read saved context locally"],
    completionScope: "A bounded context read; no message sent or external action performed.",
    mayRequestResume:
      ["FAILED", "UNKNOWN", "AUTHORIZED", "RUNNING"].includes(w.state) &&
      w.attempts < 3 &&
      Date.now() < w.deadline_at,
  };
}
async function checkpointValid(w: Workflow) {
  try {
    const plan = planSchema.parse(JSON.parse(w.plan));
    if ((await digest(plan)) !== w.plan_hash || (await checkpoint(w)) !== w.checkpoint_hash)
      throw new Error();
    return plan;
  } catch {
    throw new AssuranceError("CHECKPOINT_INVALID");
  }
}
async function requireSources(user: Identity, db: D1Database, s: Snapshot, w: Workflow) {
  const all = await listWorkflows(user, db),
    refs = references(s, all);
  if ((JSON.parse(w.source_refs) as string[]).some((ref) => !refs.has(ref)))
    throw new AssuranceError("DENIED");
  for (const id of JSON.parse(w.dependencies) as string[])
    if ((await reconcile(user, db, id)).conclusion !== "VERIFIED")
      throw new AssuranceError("DENIED");
}
export async function assuranceView(user: Identity, db: D1Database) {
  const s = await current(user, db),
    all = await listWorkflows(user, db);
  const overrides = (
    await bounded(() =>
      db
        .prepare(
          "SELECT source_ref,priority,project_importance FROM twin_priority_overrides WHERE owner=? AND generation=?",
        )
        .bind(user.userId, s.generation)
        .all<PriorityOverride>(),
    )
  ).results;
  authorize(user, "assurance.read", user.userId);
  const latest = await current(user, db);
  if (latest.generation !== s.generation || latest.epoch !== s.epoch)
    throw new AssuranceError("CONFLICT");
  return {
    workflows: all.map(publicWorkflow),
    priorities: priorities(s, all, overrides),
    evidenceBoundary:
      "Execution evidence is recorded by this Worker and D1. It is not independent proof against a compromised Worker or database administrator.",
  };
}
export async function command(
  user: Identity,
  input: unknown,
  db: D1Database,
  env: Record<string, string | undefined> = {},
  signal?: AbortSignal,
) {
  authorize(user, "assurance.write", user?.userId);
  const p = commandSchema.parse(input),
    s = await current(user, db),
    now = Date.now();
  if (p.action === "priority") {
    if (!references(s, await listWorkflows(user, db)).has(p.sourceRef))
      throw new AssuranceError("NOT_FOUND");
    await bounded(() =>
      db
        .prepare(
          `INSERT INTO twin_priority_overrides SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM twin_intelligence_heads WHERE owner=? AND generation=? AND epoch=?) AND ?>${sqlNow} ON CONFLICT(owner,source_ref) DO UPDATE SET priority=excluded.priority,project_importance=excluded.project_importance,updated_at=excluded.updated_at`,
        )
        .bind(
          user.userId,
          s.generation,
          p.sourceRef,
          p.priority,
          p.projectImportance,
          now,
          user.userId,
          s.generation,
          s.epoch,
          user.expiresAt,
        )
        .run(),
    );
    return assuranceView(user, db);
  }
  if (p.action === "propose") {
    if (p.deadlineAt <= now || p.deadlineAt > now + 7 * 86400000)
      throw new AssuranceError("INVALID");
    if (p.plan.mode === "local")
      p.plan.args = createIntelligenceRegistry(db).get(p.plan.tool)!.argsSchema.parse(p.plan.args);
    const all = await listWorkflows(user, db),
      refs = references(s, all);
    if (
      p.sourceRefs.some((r) => !refs.has(r)) ||
      p.dependencies.some((id) => !all.some((w) => w.id === id))
    )
      throw new AssuranceError("NOT_FOUND");
    // The proposal key is owner/generation scoped; a retry with a changed body is not the same proposal.
    const existing = all.find((w) => w.idempotency_key === p.idempotencyKey);
    const planHash = await digest(p.plan);
    if (existing) {
      if (
        existing.plan_hash !== planHash ||
        existing.intent !== p.intent ||
        existing.deadline_at !== p.deadlineAt ||
        existing.source_refs !== JSON.stringify(p.sourceRefs) ||
        existing.dependencies !== JSON.stringify(p.dependencies) ||
        existing.priority !== p.priority ||
        existing.project_importance !== p.projectImportance
      )
        throw new AssuranceError("CONFLICT");
      return { workflow: publicWorkflow(existing) };
    }
    if (all.length >= 100) throw new AssuranceError("LIMIT");
    const id = crypto.randomUUID(),
      sourceRefs = JSON.stringify(p.sourceRefs),
      dependencies = JSON.stringify(p.dependencies);
    const hash = await checkpoint({
      id,
      generation: s.generation,
      plan_hash: planHash,
      source_refs: sourceRefs,
      dependencies,
      deadline_at: p.deadlineAt,
    });
    try {
      const r = await bounded(() =>
        db
          .prepare(
            `INSERT INTO twin_workflows(owner,generation,id,idempotency_key,intent,plan,plan_hash,source_refs,dependencies,priority,project_importance,state,created_at,updated_at,deadline_at,reason,actor,correlation_id,checkpoint_hash) SELECT ?,?,?,?,?,?,?,?,?,?,?,'PROPOSED',?,?,?,'CREATED','user',?,? WHERE EXISTS(SELECT 1 FROM twin_intelligence_heads WHERE owner=? AND generation=? AND epoch=?) AND ?>${sqlNow} AND (SELECT COUNT(*) FROM twin_workflows WHERE owner=?)<100 RETURNING id`,
          )
          .bind(
            user.userId,
            s.generation,
            id,
            p.idempotencyKey,
            p.intent,
            JSON.stringify(p.plan),
            planHash,
            sourceRefs,
            dependencies,
            p.priority,
            p.projectImportance,
            now,
            now,
            p.deadlineAt,
            correlationId(),
            hash,
            user.userId,
            s.generation,
            s.epoch,
            user.expiresAt,
            user.userId,
          )
          .all(),
      );
      if (r.results.length !== 1) throw new AssuranceError("CONFLICT");
    } catch (e) {
      if (e instanceof AssuranceError) throw e;
      throw new AssuranceError("UNAVAILABLE");
    }
    return { workflow: publicWorkflow(await workflow(user, db, id)) };
  }
  let w = await workflow(user, db, p.id);
  if (w.version !== p.version) throw new AssuranceError("CONFLICT");
  if (p.action === "reconcile")
    return { workflow: publicWorkflow(w), evidence: await reconcile(user, db, w.id) };
  if (terminal(w.state)) throw new AssuranceError("DENIED");
  if (p.action === "cancel" || p.action === "supersede") {
    w = await span("workflow.cancel", () =>
      transition(user, db, s, w, {
        state: "CANCELLED",
        reason: p.action === "cancel" ? "CANCELLED_BY_USER" : "SUPERSEDED_INTENTION",
        actor: "user",
      }),
    );
    return { workflow: publicWorkflow(w) };
  }
  const plan = await checkpointValid(w);
  if (w.deadline_at <= now) {
    w = await transition(user, db, s, w, {
      state: "CANCELLED",
      reason: "WORKFLOW_EXPIRED",
      actor: "system",
    });
    return { workflow: publicWorkflow(w) };
  }
  if (p.action === "review") {
    if (w.state !== "PROPOSED") throw new AssuranceError("DENIED");
    w = await transition(user, db, s, w, {
      state: "AWAITING_APPROVAL",
      reason: "REVIEW_REQUESTED",
      actor: "user",
    });
  } else if (p.action === "approve") {
    if (w.state !== "AWAITING_APPROVAL" || w.attempts >= 3) throw new AssuranceError("DENIED");
    if (plan.mode === "model" && !s.legacy.aiConsent) throw new AssuranceError("DENIED");
    await requireSources(user, db, s, w);
    const id = crypto.randomUUID(),
      expires = Math.min(now + 5 * 60_000, user.expiresAt, w.deadline_at);
    w = await transition(
      user,
      db,
      s,
      w,
      { state: "AUTHORIZED", reason: "USER_AUTHORIZED", actor: "user", authorizationId: id },
      [
        db
          .prepare("INSERT INTO twin_workflow_authorizations VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(
            user.userId,
            s.generation,
            w.id,
            id,
            s.epoch,
            w.plan_hash,
            now,
            expires,
            plan.mode === "model" ? 1 : 0,
          ),
      ],
    );
  } else if (p.action === "resume") {
    return span("workflow.recover", async () => {
      // Recovery always reconciles prior receipts, even when the next operation is read-only.
      const evidence = await reconcile(user, db, w.id);
      if (w.state === "RUNNING") {
        if ((w.lease_until ?? Infinity) > now) throw new AssuranceError("CONFLICT");
        w = await transition(user, db, s, w, {
          state: "UNKNOWN",
          reason: "RECONCILIATION_REQUIRED",
          actor: "reconciler",
        });
      } else if (!["UNKNOWN", "FAILED", "AUTHORIZED"].includes(w.state))
        throw new AssuranceError("DENIED");
      if (w.attempts >= 3 || evidence.conclusion === "DIVERGENT")
        throw new AssuranceError("DENIED");
      w = await transition(user, db, await current(user, db), w, {
        state: "AWAITING_APPROVAL",
        reason: "RETRY_REQUESTED",
        actor: "user",
        authorizationId: null,
      });
      return { workflow: publicWorkflow(w), evidence };
    });
  } else if (p.action === "execute") {
    if (w.state !== "AUTHORIZED" || w.attempts >= 3) throw new AssuranceError("DENIED");
    const e = await readEvidence(user, db, w.id);
    if (!e.auth || e.auth.epoch !== s.epoch || e.auth.expires_at <= now) {
      w = await transition(user, db, s, w, {
        state: "AWAITING_APPROVAL",
        reason: "AUTHORIZATION_EXPIRED",
        actor: "system",
        authorizationId: null,
      });
      return { workflow: publicWorkflow(w) };
    }
    await requireSources(user, db, s, w);
    const requestId = crypto.randomUUID(),
      lease = Math.min(now + 45_000, e.auth.expires_at, w.deadline_at, user.expiresAt);
    if (lease - now < 2500) throw new AssuranceError("EXPIRED");
    w = await transition(user, db, s, w, {
      state: "RUNNING",
      reason: "STARTED",
      actor: "runtime",
      runId: requestId,
      leaseUntil: lease,
      attempts: w.attempts + 1,
    });
    const active = w;
    const controls: RunControls = {
      deadlineAt: lease,
      signal,
      workflow: { id: w.id, version: w.version },
      validateContext: async () => {
        const live = await workflow(user, db, w.id);
        if (
          live.state !== "RUNNING" ||
          live.version !== active.version ||
          live.run_id !== requestId ||
          Date.now() >= lease
        )
          throw new AssuranceError("DENIED");
      },
    };
    try {
      // Neither model text nor the HTTP result can update workflow state. Only persisted records below can.
      const result =
        plan.mode === "local"
          ? await runLocalIntelligence(
              user,
              { requestId, tool: plan.tool, args: plan.args },
              db,
              controls,
            )
          : await runModelIntelligence(
              user,
              { mode: "model", requestId, message: plan.message },
              db,
              env,
              undefined,
              controls,
            );
      const persisted = await readEvidence(user, db, w.id);
      if (!persisted.w || persisted.w.version !== active.version || persisted.w.state !== "RUNNING")
        throw new AssuranceError("CONFLICT");
      const verification = await checkExecution(
        persisted.w,
        persisted.auth,
        persisted.run,
        persisted.receipts,
      );
      if (verification.conclusion === "VERIFIED" && result.status === 200) {
        const hash = await manifest(persisted.run!, persisted.receipts);
        w = await transition(
          user,
          db,
          await current(user, db),
          active,
          { state: "COMPLETED", reason: "READ_COMPLETED", actor: "reconciler" },
          [
            db
              .prepare("INSERT INTO twin_workflow_outcomes VALUES(?,?,?,?,?,?,?,?)")
              .bind(
                user.userId,
                s.generation,
                w.id,
                requestId,
                w.authorization_id,
                hash,
                persisted.receipts.length,
                Date.now(),
              ),
          ],
        );
        const evidence = await reconcile(user, db, w.id),
          latest = await current(user, db);
        if (
          evidence.conclusion !== "VERIFIED" ||
          latest.generation !== s.generation ||
          latest.epoch !== s.epoch
        )
          throw new AssuranceError("CONFLICT");
        return { workflow: publicWorkflow(w), evidence, result: result.body };
      }
      const timeout =
        /TIMEOUT|DEADLINE|RECEIPT_WRITE/.test(persisted.run?.error_code ?? "") ||
        !persisted.run ||
        persisted.run.status === "running";
      w = await transition(user, db, await current(user, db), active, {
        state: timeout || verification.partial ? "UNKNOWN" : "FAILED",
        reason: timeout
          ? "TIMEOUT"
          : verification.partial
            ? "PARTIAL_EXECUTION"
            : "EXECUTION_FAILED",
        actor: "runtime",
      });
    } catch {
      // Persistence may be unavailable. Do not invent a durable state or release a stale result.
      const fresh = await workflow(user, db, w.id);
      if (fresh.state === "RUNNING" && fresh.version === active.version)
        w = await transition(user, db, await current(user, db), fresh, {
          state: "UNKNOWN",
          reason: "RECONCILIATION_REQUIRED",
          actor: "runtime",
        });
      else w = fresh;
    }
  }
  return { workflow: publicWorkflow(w) };
}
