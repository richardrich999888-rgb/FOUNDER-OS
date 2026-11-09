import { ReceiptWriteError, sanitizeErrorCode, type ErrorCode } from "./errors";
import { principalBinding, type VerifiedPrincipal } from "./principal";
import { span } from "../assurance/telemetry";
export type ExecutionStatus = "started" | "succeeded" | "failed" | "timed_out" | "denied";
export type AuthorizationDecision = "allow" | "deny";
export type RunStatus = "running" | "completed" | "failed";
export type AnswerSource = "model" | "runtime_abstention" | "runtime_evidence_fallback";
export const UNREGISTERED_TOOL_ID = "unregistered";
export type ReceiptStart = Readonly<{
  executionId: string;
  requestId: string;
  userId: string;
  callIndex: number;
  toolId: string;
  startedAt: number;
}>;
export type ReceiptCompletion = Readonly<{
  status: Exclude<ExecutionStatus, "started" | "denied">;
  completedAt: number;
  errorCode: ErrorCode | null;
  sourceIds: readonly string[];
}>;
export type DeniedReceipt = ReceiptStart & Readonly<{ errorCode: ErrorCode; completedAt: number }>;
export type RunStart = Readonly<{ requestId: string; userId: string; startedAt: number }>;
export type RunCompletion = Readonly<{
  requestId: string;
  userId: string;
  status: Exclude<RunStatus, "running">;
  answerSource: AnswerSource | null;
  iterations: number;
  toolExecutions: number;
  inputTokens: number | null;
  outputTokens: number | null;
  completedAt: number;
  startedAt: number;
  errorCode: ErrorCode | null;
}>;
export type ReceiptStore = Readonly<{
  begin(r: ReceiptStart): Promise<void>;
  complete(id: string, c: ReceiptCompletion): Promise<void>;
  recordDenied(r: DeniedReceipt): Promise<void>;
  startRun(r: RunStart): Promise<void>;
  finishRun(r: RunCompletion): Promise<void>;
}>;
const sourcePattern =
  /^(?:(?:memory|document):[A-Za-z0-9-]{1,64}(?:#\d{1,6})?|intelligence:[a-f0-9-]{36}:v\d{1,10})$/;
export const sanitizeSourceIds = (ids: readonly string[]) =>
  [...new Set(ids.filter((id) => sourcePattern.test(id)))].slice(0, 25);
export const durationBetween = (start: number, end: number) => Math.max(0, Math.trunc(end - start));
const nowSql = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
// SQL enforces a hard wall-clock boundary even when a timed-out D1 promise ignores abort.
export function createD1ReceiptStore(
  db: D1Database,
  principal: VerifiedPrincipal,
  requestId: string,
  deadlineAt: number,
  workflow?: { id: string; version: number },
): ReceiptStore {
  const b = principalBinding(principal),
    owner = principal.userId,
    gen = b.generation,
    epoch = b.epoch;
  deadlineAt = Math.min(deadlineAt, b.identity.expiresAt);
  const live = `EXISTS(SELECT 1 FROM twin_intelligence_heads h JOIN twin_accounts a ON a.user_id=h.owner AND a.generation=h.generation WHERE h.owner=? AND h.generation=? AND h.epoch=? ${b.destination === "provider" ? "AND json_extract(a.state,'$.aiConsent')=1" : ""})${workflow ? ` AND EXISTS(SELECT 1 FROM twin_workflows w JOIN twin_workflow_authorizations a ON a.owner=w.owner AND a.id=w.authorization_id WHERE w.owner=? AND w.generation=? AND w.id=? AND w.version=? AND w.run_id=? AND w.state='RUNNING' AND w.lease_until>=${nowSql} AND a.expires_at>=${nowSql})` : ""}`;
  const liveArgs = [owner, gen, epoch, ...(workflow ? [owner,gen,workflow.id,workflow.version,requestId] : [])];
  const runLive = `EXISTS(SELECT 1 FROM agent_runs WHERE request_id=? AND user_id=? AND generation=? AND status='running' AND deadline_at>=${nowSql})`;
  const runArgs = [requestId, owner, gen];
  async function write(sql: string, args: unknown[]) {
    try {
      const r = await span("receipt.persist", () => db
        .prepare(sql)
        .bind(...args)
        .all());
      if (r.results.length !== 1) throw new Error("rejected");
    } catch {
      throw new ReceiptWriteError();
    }
  }
  function check(r: RunStart | ReceiptStart) {
    principalBinding(principal);
    if (r.userId !== owner || r.requestId !== requestId) throw new ReceiptWriteError();
  }
  async function insert(r: ReceiptStart, denied?: DeniedReceipt) {
    check(r);
    if (
      ![
        "search_personal_memory",
        "find_commitments",
        "get_person_context",
        "get_project_context",
        "retrieve_procedure",
        "unregistered",
      ].includes(r.toolId)
    )
      throw new ReceiptWriteError();
    await write(
      `INSERT INTO agent_execution_receipts(execution_id,request_id,user_id,generation,call_index,tool_id,authorization,status,started_at,completed_at,duration_ms,error_code,source_ids) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,'[]' WHERE ${runLive} AND ${live} RETURNING execution_id`,
      [
        r.executionId,
        requestId,
        owner,
        gen,
        r.callIndex,
        r.toolId,
        denied ? "deny" : "allow",
        denied ? "denied" : "started",
        r.startedAt,
        denied?.completedAt ?? null,
        denied ? durationBetween(r.startedAt, denied.completedAt) : null,
        denied ? sanitizeErrorCode(denied.errorCode) : null,
        ...runArgs,
        ...liveArgs,
      ],
    );
  }
  return Object.freeze({
    startRun: async (r) => {
      check(r);
      await write(
        `INSERT INTO agent_runs(request_id,user_id,generation,epoch,status,started_at,deadline_at) SELECT ?,?,?,?,'running',?,? WHERE ${live} AND ?>=${nowSql} RETURNING request_id`,
        [requestId, owner, gen, epoch, r.startedAt, deadlineAt, ...liveArgs, deadlineAt],
      );
    },
    begin: (r) => insert(r),
    recordDenied: (r) => insert(r, r),
    complete: async (id, c) => {
      principalBinding(principal);
      await write(
        `UPDATE agent_execution_receipts SET status=?,completed_at=?,duration_ms=MAX(0,?-started_at),error_code=?,source_ids=? WHERE execution_id=? AND request_id=? AND user_id=? AND generation=? AND status='started' AND ${runLive} AND ${live} RETURNING execution_id`,
        [
          c.status,
          c.completedAt,
          c.completedAt,
          c.errorCode ? sanitizeErrorCode(c.errorCode) : null,
          JSON.stringify(sanitizeSourceIds(c.sourceIds)),
          id,
          requestId,
          owner,
          gen,
          ...runArgs,
          ...liveArgs,
        ],
      );
    },
    finishRun: async (r) => {
      check(r);
      await write(
        `UPDATE agent_runs SET status=?,answer_source=?,iterations=?,tool_executions=?,input_tokens=?,output_tokens=?,completed_at=?,duration_ms=?,error_code=? WHERE request_id=? AND user_id=? AND generation=? AND status='running' AND deadline_at>=${nowSql} ${r.status === "completed" ? `AND ${live}` : ""} RETURNING request_id`,
        [
          r.status,
          r.answerSource,
          r.iterations,
          r.toolExecutions,
          r.inputTokens,
          r.outputTokens,
          r.completedAt,
          durationBetween(r.startedAt, r.completedAt),
          r.errorCode ? sanitizeErrorCode(r.errorCode) : null,
          requestId,
          owner,
          gen,
          ...(r.status === "completed" ? liveArgs : []),
        ],
      );
    },
  });
}
