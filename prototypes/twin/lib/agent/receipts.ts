/**
 * Execution receipts: port, pure builders and the D1 adapter.
 *
 * Write-ahead protocol (enforced by executor.ts):
 *   allowed call : begin(status=started) -> execute -> complete(final status)
 *   denied call  : recordDenied(status=denied)
 * If `begin` fails the tool is NOT executed. If `complete` fails the tool result is discarded
 * and the run terminates with RECEIPT_WRITE_FAILED. A receipt failure therefore can never
 * turn an unaudited or unauthorized action into a successful one.
 *
 * Receipts never contain prompts, arguments, memory text, model output or credentials.
 */
import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { agentExecutionReceipts, agentRuns } from '@/db/schema';
import { ReceiptWriteError, sanitizeErrorCode, type ErrorCode } from './errors';

export type ExecutionStatus = 'started' | 'succeeded' | 'failed' | 'timed_out' | 'denied';
export type AuthorizationDecision = 'allow' | 'deny';
export type RunStatus = 'running' | 'completed' | 'failed';
export type AnswerSource = 'model' | 'runtime_abstention' | 'runtime_evidence_fallback';

/** Sentinel stored instead of a model-supplied name that is not in the registry. */
export const UNREGISTERED_TOOL_ID = 'unregistered';

export type CallInitiator = 'model' | 'runtime';

export type ReceiptStart = Readonly<{
  executionId: string;
  requestId: string;
  userId: string;
  callIndex: number;
  toolId: string;
  /** 'runtime' marks a lookup the runtime enforced, not one the model selected. */
  initiator: CallInitiator;
  startedAt: number;
}>;

export type ReceiptCompletion = Readonly<{
  status: Exclude<ExecutionStatus, 'started' | 'denied'>;
  completedAt: number;
  errorCode: ErrorCode | null;
  sourceIds: readonly string[];
}>;

export type DeniedReceipt = ReceiptStart & Readonly<{ errorCode: ErrorCode; completedAt: number }>;

export type RunStart = Readonly<{ requestId: string; userId: string; startedAt: number }>;

export type RunCompletion = Readonly<{
  requestId: string;
  userId: string;
  status: Exclude<RunStatus, 'running'>;
  answerSource: AnswerSource | null;
  iterations: number;
  toolExecutions: number;
  inputTokens: number | null;
  outputTokens: number | null;
  completedAt: number;
  startedAt: number;
  errorCode: ErrorCode | null;
}>;

/** Persistence port. Every method throws ReceiptWriteError on any failure. */
export type ReceiptStore = Readonly<{
  begin(receipt: ReceiptStart): Promise<void>;
  complete(executionId: string, completion: ReceiptCompletion): Promise<void>;
  recordDenied(receipt: DeniedReceipt): Promise<void>;
  startRun(run: RunStart): Promise<void>;
  finishRun(run: RunCompletion): Promise<void>;
}>;

const SOURCE_ID_PATTERN = /^(memory|document):[A-Za-z0-9-]{1,64}(#\d{1,6})?$/;
const MAX_SOURCE_IDS = 20;

/**
 * Keep only well-formed opaque source identifiers (bounded count). Anything else — e.g. a
 * label or excerpt accidentally passed in — is dropped rather than persisted.
 */
export function sanitizeSourceIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === 'string' && SOURCE_ID_PATTERN.test(id)))].slice(0, MAX_SOURCE_IDS);
}

/** Non-negative integer duration; clock skew collapses to 0. */
export function durationBetween(startedAt: number, completedAt: number): number {
  return Math.max(0, Math.trunc(completedAt - startedAt));
}

type Db = DrizzleD1Database<Record<string, unknown>>;

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    // The underlying error may contain SQL or bound values; it is intentionally discarded.
    throw new ReceiptWriteError();
  }
}

/** D1-backed receipt store. */
export function createD1ReceiptStore(db: Db): ReceiptStore {
  return Object.freeze({
    begin: (r: ReceiptStart) =>
      guarded(async () => {
        await db.insert(agentExecutionReceipts).values({
          ...r,
          authorization: 'allow',
          status: 'started',
          sourceIds: '[]',
        });
      }),
    complete: (executionId: string, c: ReceiptCompletion) =>
      guarded(async () => {
        const [row] = await db
          .select({ startedAt: agentExecutionReceipts.startedAt })
          .from(agentExecutionReceipts)
          .where(eq(agentExecutionReceipts.executionId, executionId));
        if (!row) throw new Error('missing receipt');
        // Only a `started` receipt may transition; a second completion is rejected.
        const updated = await db
          .update(agentExecutionReceipts)
          .set({
            status: c.status,
            completedAt: c.completedAt,
            durationMs: durationBetween(row.startedAt, c.completedAt),
            errorCode: c.errorCode === null ? null : sanitizeErrorCode(c.errorCode),
            sourceIds: JSON.stringify(sanitizeSourceIds(c.sourceIds)),
          })
          .where(and(eq(agentExecutionReceipts.executionId, executionId), eq(agentExecutionReceipts.status, 'started')))
          .returning({ id: agentExecutionReceipts.executionId });
        if (updated.length !== 1) throw new Error('receipt transition rejected');
      }),
    recordDenied: (r: DeniedReceipt) =>
      guarded(async () => {
        await db.insert(agentExecutionReceipts).values({
          executionId: r.executionId,
          requestId: r.requestId,
          userId: r.userId,
          callIndex: r.callIndex,
          toolId: r.toolId,
          initiator: r.initiator,
          authorization: 'deny',
          status: 'denied',
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          durationMs: durationBetween(r.startedAt, r.completedAt),
          errorCode: sanitizeErrorCode(r.errorCode),
          sourceIds: '[]',
        });
      }),
    startRun: (r: RunStart) =>
      guarded(async () => {
        await db.insert(agentRuns).values({ ...r, status: 'running' });
      }),
    finishRun: (r: RunCompletion) =>
      guarded(async () => {
        const updated = await db
          .update(agentRuns)
          .set({
            status: r.status,
            answerSource: r.answerSource,
            iterations: r.iterations,
            toolExecutions: r.toolExecutions,
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            completedAt: r.completedAt,
            durationMs: durationBetween(r.startedAt, r.completedAt),
            errorCode: r.errorCode === null ? null : sanitizeErrorCode(r.errorCode),
          })
          .where(and(eq(agentRuns.requestId, r.requestId), eq(agentRuns.userId, r.userId), eq(agentRuns.status, 'running')))
          .returning({ id: agentRuns.requestId });
        if (updated.length !== 1) throw new Error('run transition rejected');
      }),
  });
}
