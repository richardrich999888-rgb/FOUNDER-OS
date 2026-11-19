/**
 * Tool-call executor.
 *
 * Pipeline for every model-requested call (no step may be skipped or reordered):
 *   1. protocol checks   — unique call id, bounded argument size
 *   2. registry lookup   — unknown tools are denied (deny-by-default)
 *   3. schema validation — JSON.parse + strict Zod schema
 *   4. authorization     — authorizeToolCall (scope, budget, deadline)
 *   5. receipt begin     — write-ahead; on failure the tool does NOT run
 *   6. bounded execution — min(tool timeout, remaining run budget)
 *   7. result validation — tool's own Zod result schema
 *   8. receipt complete  — on failure the result is discarded and the run aborts
 * Denied calls produce a `denied` receipt. ReceiptWriteError always propagates to the runtime.
 */
import { authorizeToolCall } from './authorization';
import { runBounded, type Clock } from './deadline';
import { AgentError, ReceiptWriteError, codeOf, type ErrorCode } from './errors';
import type { RuntimeLimits } from './limits';
import type { ModelToolCall } from './model-adapter';
import type { VerifiedPrincipal } from './principal';
import { UNREGISTERED_TOOL_ID, type AuthorizationDecision, type ExecutionStatus, type ReceiptStore } from './receipts';
import type { EvidenceItem, ToolRegistry } from './tool-registry';

export type ExecutorContext = Readonly<{
  principal: VerifiedPrincipal;
  requestId: string;
  registry: ToolRegistry;
  receipts: ReceiptStore;
  clock: Clock;
  newId: () => string;
  limits: RuntimeLimits;
  /** Model/tool work must finish by this instant (= start + total - auditReserve). */
  deadlineAt: number;
  /** Hard deadline (= start + total). Bounds receipt writes. */
  auditDeadlineAt: number;
  runSignal: AbortSignal;
}>;

const NEVER_ABORTED: AbortSignal = new AbortController().signal;

/**
 * Bound a receipt write by the hard deadline. Any failure — including a hung D1 call — is
 * normalized to ReceiptWriteError, which always terminates the run (fail closed).
 */
export async function boundedReceiptWrite(clock: Clock, auditDeadlineAt: number, write: () => Promise<void>): Promise<void> {
  try {
    await runBounded(() => write(), auditDeadlineAt - clock.now(), NEVER_ABORTED, 'RECEIPT_WRITE_FAILED');
  } catch {
    throw new ReceiptWriteError();
  }
}

/** Mutable per-run accounting, owned by a single run (never shared across requests). */
export type ExecutionBudget = {
  executionsUsed: number;
  deniedCount: number;
  nextCallIndex: number;
  readonly seenCallIds: Set<string>;
};

export function createExecutionBudget(): ExecutionBudget {
  return { executionsUsed: 0, deniedCount: 0, nextCallIndex: 0, seenCallIds: new Set() };
}

export type CallOutcome = Readonly<{
  callId: string;
  initiator: 'model' | 'runtime';
  executionId: string;
  toolId: string;
  authorization: AuthorizationDecision;
  status: Exclude<ExecutionStatus, 'started'>;
  errorCode: ErrorCode | null;
  resultStatus: 'ok' | 'no_evidence' | null;
  evidence: readonly EvidenceItem[];
}>;

type Denial = Readonly<{ toolId: string; code: ErrorCode }>;

/** Steps 1–3: everything decidable without authorization. Returns parsed args or a denial. */
function validateCall(call: ModelToolCall, ctx: ExecutorContext, budget: ExecutionBudget): { tool: NonNullable<ReturnType<ToolRegistry['get']>>; args: unknown } | Denial {
  const tool = ctx.registry.get(call.name);
  const toolId = tool ? tool.name : UNREGISTERED_TOOL_ID;
  if (budget.seenCallIds.has(call.callId)) return { toolId, code: 'DUPLICATE_CALL_ID' };
  budget.seenCallIds.add(call.callId);
  if (!tool) return { toolId, code: 'UNKNOWN_TOOL' };
  if (call.argumentsJson.length > ctx.limits.maxArgumentsChars) return { toolId, code: 'ARGUMENTS_TOO_LARGE' };
  let raw: unknown;
  try {
    raw = JSON.parse(call.argumentsJson);
  } catch {
    return { toolId, code: 'INVALID_ARGUMENTS_JSON' };
  }
  const parsed = tool.argsSchema.safeParse(raw);
  if (!parsed.success) return { toolId, code: 'INVALID_ARGUMENTS' };
  return { tool, args: parsed.data };
}

/** Persist a denial and return its outcome. Throws ReceiptWriteError if persistence fails. */
async function deny(call: ModelToolCall, denial: Denial, ctx: ExecutorContext, budget: ExecutionBudget, callIndex: number): Promise<CallOutcome> {
  budget.deniedCount += 1;
  const executionId = ctx.newId();
  const now = ctx.clock.now();
  await boundedReceiptWrite(ctx.clock, ctx.auditDeadlineAt, () => ctx.receipts.recordDenied({
    executionId,
    requestId: ctx.requestId,
    userId: ctx.principal.userId,
    callIndex,
    toolId: denial.toolId,
    initiator: call.initiator ?? 'model',
    startedAt: now,
    completedAt: now,
    errorCode: denial.code,
  }));
  return { callId: call.callId, initiator: call.initiator ?? 'model', executionId, toolId: denial.toolId, authorization: 'deny', status: 'denied', errorCode: denial.code, resultStatus: null, evidence: [] };
}

/** Record a call the runtime refuses without evaluating it (e.g. iteration limit reached). */
export async function refuseToolCall(call: ModelToolCall, code: ErrorCode, ctx: ExecutorContext, budget: ExecutionBudget): Promise<CallOutcome> {
  const tool = ctx.registry.get(call.name);
  const callIndex = budget.nextCallIndex++;
  return deny(call, { toolId: tool ? tool.name : UNREGISTERED_TOOL_ID, code }, ctx, budget, callIndex);
}

/** Execute one model-requested tool call through the full pipeline. */
export async function executeToolCall(call: ModelToolCall, ctx: ExecutorContext, budget: ExecutionBudget): Promise<CallOutcome> {
  const callIndex = budget.nextCallIndex++;
  const validated = validateCall(call, ctx, budget);
  if ('code' in validated) return deny(call, validated, ctx, budget, callIndex);
  const { tool, args } = validated;

  const decision = authorizeToolCall({
    principal: ctx.principal,
    tool,
    executionsUsed: budget.executionsUsed,
    maxExecutions: ctx.limits.maxToolExecutions,
    now: ctx.clock.now(),
    deadlineAt: ctx.deadlineAt,
  });
  if (decision.decision === 'deny') return deny(call, { toolId: tool.name, code: decision.code }, ctx, budget, callIndex);

  // Budget is consumed at authorization time, so a failing or timing-out tool still counts.
  budget.executionsUsed += 1;
  const executionId = ctx.newId();
  await boundedReceiptWrite(ctx.clock, ctx.auditDeadlineAt, () =>
    ctx.receipts.begin({ executionId, requestId: ctx.requestId, userId: ctx.principal.userId, callIndex, toolId: tool.name, initiator: call.initiator ?? 'model', startedAt: ctx.clock.now() }),
  );

  let status: CallOutcome['status'] = 'succeeded';
  let errorCode: ErrorCode | null = null;
  let resultStatus: CallOutcome['resultStatus'] = null;
  let evidence: readonly EvidenceItem[] = [];
  try {
    const timeoutMs = Math.min(ctx.limits.toolTimeoutMs, ctx.deadlineAt - ctx.clock.now());
    const raw = await runBounded((signal) => tool.execute(args, { principal: ctx.principal, signal }), timeoutMs, ctx.runSignal, 'TOOL_TIMEOUT');
    const checked = tool.resultSchema.safeParse(raw);
    if (!checked.success) throw new AgentError('TOOL_RESULT_INVALID');
    const summary = tool.summarize(checked.data);
    resultStatus = summary.status;
    evidence = summary.evidence;
  } catch (error) {
    if (error instanceof ReceiptWriteError) throw error;
    errorCode = codeOf(error, 'TOOL_FAILED');
    if (errorCode === 'INTERNAL_ERROR') errorCode = 'TOOL_FAILED';
    status = errorCode === 'TOOL_TIMEOUT' || errorCode === 'DEADLINE_EXCEEDED' ? 'timed_out' : 'failed';
  }

  await boundedReceiptWrite(ctx.clock, ctx.auditDeadlineAt, () =>
    ctx.receipts.complete(executionId, { status, completedAt: ctx.clock.now(), errorCode, sourceIds: evidence.map((e) => e.sourceId) }),
  );
  return { callId: call.callId, initiator: call.initiator ?? 'model', executionId, toolId: tool.name, authorization: 'allow', status, errorCode, resultStatus, evidence };
}
