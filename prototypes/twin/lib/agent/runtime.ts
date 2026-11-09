/**
 * JARVIS agent runtime: a bounded, model-directed tool loop over the Responses API port.
 *
 * Loop (iteration = one model call):
 *   for i in 1..maxIterations
 *     model.respond(tool_choice = i < max ? auto : none)   bounded by the remaining deadline
 *     no tool calls  -> finalize(answer)
 *     i == max       -> refuse the calls (denied receipts), degrade
 *     otherwise      -> execute each call via executor, append observations, continue
 *
 * Termination is guaranteed: at most maxIterations model calls and maxToolExecutions executions,
 * at most maxDeniedCallsPerRun denials, and every await (model, tool, receipt write) is bounded:
 *   work deadline  = start + totalDeadlineMs - auditReserveMs   (model + tool calls)
 *   audit deadline = start + totalDeadlineMs                    (receipt/run writes)
 * There is no separate backstop timer, so the reported error code is deterministic.
 *
 * Answer policy (finalize/degrade), applied in code after the model returns:
 *   - model attempted an unregistered
 *     tool during this run (taint)    -> runtime evidence fallback / abstention (no model text)
 *   - evidence + valid citations      -> model answer, sources = cited ledger items
 *   - evidence + fabricated/uncited   -> runtime evidence fallback (no model text)
 *   - tool attempted, no evidence     -> runtime abstention (no model text)
 *   - no tool attempted               -> model answer, no sources ("not_required")
 *   - receipt failure anywhere        -> failed, no answer, no sources (fail closed)
 */
import { runBounded, type Clock } from "./deadline";
import { AgentError, ReceiptWriteError, codeOf, type ErrorCode } from "./errors";
import {
  createEvidenceLedger,
  verifyCitations,
  type CitedEvidence,
  type EvidenceLedger,
} from "./evidence";
import {
  boundedReceiptWrite,
  createExecutionBudget,
  executeToolCall,
  refuseToolCall,
  type CallOutcome,
  type ExecutionBudget,
  type ExecutorContext,
} from "./executor";
import {
  ABSTENTION_TEXT,
  AGENT_INSTRUCTIONS,
  evidenceFallbackText,
  renderObservation,
} from "./instructions";
import type { RuntimeLimits } from "./limits";
import type { ConversationItem, ModelPort, ModelTurn } from "./model-port";
import { isVerifiedPrincipal, type VerifiedPrincipal } from "./principal";
import type { AnswerSource, ReceiptStore } from "./receipts";
import type { ToolRegistry } from "./tool-registry";

export type AgentDependencies = Readonly<{
  model: ModelPort;
  registry: ToolRegistry;
  receipts: ReceiptStore;
  clock: Clock;
  newId: () => string;
  limits: RuntimeLimits;
  /** Mandatory current identity, generation, epoch and destination consent gate. */
  validateContext: () => Promise<void>;
  evidenceOnly?: boolean;
  requireEvidence?: boolean;
  /** Server-selected first read. Does not bypass executor authorization. */
  initialTool?: string;
}>;

export type AgentRunInput = Readonly<{
  principal: VerifiedPrincipal;
  requestId: string;
  message: string;
}>;

export type Grounding = "cited" | "no_evidence" | "not_required" | "evidence_fallback" | "none";

export type ReceiptSummary = Readonly<{
  executionId: string;
  tool: string;
  authorization: CallOutcome["authorization"];
  status: CallOutcome["status"];
  errorCode: ErrorCode | null;
}>;

export type AgentRunResult = Readonly<{
  status: "completed" | "failed";
  /** For completed runs: the reason a runtime fallback replaced model text (else null). */
  errorCode: ErrorCode | null;
  answer: string | null;
  answerSource: AnswerSource | null;
  grounding: Grounding;
  sources: readonly CitedEvidence[];
  iterations: number;
  toolExecutions: number;
  receipts: readonly ReceiptSummary[];
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
}>;

/** Mutable state for exactly one run. */
type RunState = {
  iterations: number;
  usage: { inputTokens: number; outputTokens: number } | null;
  readonly items: ConversationItem[];
  readonly outcomes: CallOutcome[];
  readonly ledger: EvidenceLedger;
  readonly budget: ExecutionBudget;
};

type Verdict = Pick<
  AgentRunResult,
  "status" | "errorCode" | "answer" | "answerSource" | "grounding" | "sources"
>;

function failed(code: ErrorCode): Verdict {
  return {
    status: "failed",
    errorCode: code,
    answer: null,
    answerSource: null,
    grounding: "none",
    sources: [],
  };
}

/** Degrade without model text: evidence fallback, abstention, or failure. */
function degrade(state: RunState, code: ErrorCode | null): Verdict {
  if (state.outcomes.length && state.outcomes.every((o) => o.status !== "succeeded"))
    return failed(state.outcomes[0].errorCode ?? "TOOL_FAILED");
  const evidence = state.ledger.all();
  if (evidence.length) {
    return {
      status: "completed",
      errorCode: code,
      answer: evidenceFallbackText(evidence),
      answerSource: "runtime_evidence_fallback",
      grounding: "evidence_fallback",
      sources: evidence,
    };
  }
  if (state.outcomes.length) {
    return {
      status: "completed",
      errorCode: code,
      answer: ABSTENTION_TEXT,
      answerSource: "runtime_abstention",
      grounding: "no_evidence",
      sources: [],
    };
  }
  return failed(code ?? "MODEL_EMPTY_RESPONSE");
}

/** Apply the answer policy to the model's final text. */
function finalize(
  state: RunState,
  turn: ModelTurn,
  limits: RuntimeLimits,
  requireEvidence = false,
): Verdict {
  if (state.outcomes.length && state.outcomes.every((o) => o.status !== "succeeded"))
    return failed(state.outcomes[0].errorCode ?? "TOOL_FAILED");
  const text = turn.text.trim();
  if (!text) return degrade(state, "MODEL_EMPTY_RESPONSE");
  if (text.length > limits.maxAnswerChars) return degrade(state, "MODEL_MALFORMED_RESPONSE");
  // Taint: an attempt to call a tool outside the registry indicates the model was steered by
  // injected content or is hallucinating capabilities; its prose (which may falsely claim the
  // action happened) is not shown. Verified evidence, if any, still is.
  if (state.outcomes.some((o) => o.errorCode === "UNKNOWN_TOOL"))
    return degrade(state, "MODEL_POLICY_VIOLATION");
  const hasEvidence = state.ledger.all().length > 0;
  const check = verifyCitations(text, state.ledger);
  if (check.kind === "fabricated") return degrade(state, "GROUNDING_FABRICATED_CITATION");
  if (hasEvidence) {
    if (check.kind === "uncited") return degrade(state, "GROUNDING_CITATION_MISSING");
    return {
      status: "completed",
      errorCode: null,
      answer: text,
      answerSource: "model",
      grounding: "cited",
      sources: check.cited,
    };
  }
  // No evidence. If any tool call was attempted, the request concerned personal data that we
  // could not verify: abstain deterministically rather than return unverifiable model prose.
  if (state.outcomes.length || requireEvidence)
    return {
      status: "completed",
      errorCode: null,
      answer: ABSTENTION_TEXT,
      answerSource: "runtime_abstention",
      grounding: "no_evidence",
      sources: [],
    };
  return {
    status: "completed",
    errorCode: null,
    answer: text,
    answerSource: "model",
    grounding: "not_required",
    sources: [],
  };
}

function addUsage(state: RunState, turn: ModelTurn): void {
  if (!turn.usage) return;
  const prev = state.usage ?? { inputTokens: 0, outputTokens: 0 };
  state.usage = {
    inputTokens: prev.inputTokens + turn.usage.inputTokens,
    outputTokens: prev.outputTokens + turn.usage.outputTokens,
  };
}

/** Execute (or refuse) every call in one model turn and append observations to the transcript. */
async function processToolCalls(
  state: RunState,
  turn: ModelTurn,
  ctx: ExecutorContext,
  refuseWith: ErrorCode | null,
): Promise<void> {
  for (const call of turn.toolCalls) {
    state.items.push({
      type: "tool_call",
      callId: call.callId,
      name: call.name,
      argumentsJson: call.argumentsJson,
    });
  }
  for (const call of turn.toolCalls) {
    if (state.budget.deniedCount >= ctx.limits.maxDeniedCallsPerRun)
      throw new AgentError("TOOL_LIMIT_EXCEEDED");
    const outcome = refuseWith
      ? await refuseToolCall(call, refuseWith, ctx, state.budget)
      : await executeToolCall(call, ctx, state.budget);
    state.outcomes.push(outcome);
    const cited = state.ledger.add(outcome.evidence);
    state.items.push({
      type: "tool_result",
      callId: call.callId,
      output: renderObservation(outcome, cited),
    });
  }
}

async function loop(
  deps: AgentDependencies,
  state: RunState,
  ctx: ExecutorContext,
): Promise<Verdict> {
  const { limits } = deps;
  for (let iteration = 1; iteration <= limits.maxIterations; iteration += 1) {
    const finalIteration = iteration === limits.maxIterations;
    const remaining = ctx.deadlineAt - deps.clock.now();
    if (remaining <= 0) return degrade(state, "DEADLINE_EXCEEDED");
    state.iterations = iteration;
    await runBounded(() => deps.validateContext(), remaining, ctx.runSignal, "DEADLINE_EXCEEDED");
    const turn = await runBounded(
      (signal) =>
        deps.model.respond(
          {
            instructions: AGENT_INSTRUCTIONS,
            items: [...state.items],
            tools: deps.registry.specs(),
            toolChoice: finalIteration ? "none"
              : state.outcomes.length === 0 && deps.initialTool ? { name: deps.initialTool }
              : deps.requireEvidence && state.outcomes.length === 0 ? "required" : "auto",
            maxOutputTokens: limits.maxOutputTokens,
          },
          signal,
        ),
      ctx.deadlineAt - deps.clock.now(),
      ctx.runSignal,
      "MODEL_TIMEOUT",
    );
    await runBounded(
      () => deps.validateContext(),
      ctx.deadlineAt - deps.clock.now(),
      ctx.runSignal,
      "DEADLINE_EXCEEDED",
    );
    addUsage(state, turn);
    if (turn.toolCalls.length === 0) {
      if (deps.evidenceOnly) {
        const unsuccessful = state.outcomes.find((outcome) => outcome.status !== "succeeded");
        if (unsuccessful || !state.outcomes.length)
          return failed(unsuccessful?.errorCode ?? "TOOL_FAILED");
        return degrade(state, null);
      }
      return finalize(state, turn, limits, deps.requireEvidence);
    }
    if (finalIteration) {
      await processToolCalls(state, turn, ctx, "ITERATION_LIMIT_EXCEEDED");
      return degrade(state, "ITERATION_LIMIT_EXCEEDED");
    }
    await processToolCalls(state, turn, ctx, null);
  }
  // Unreachable: the final iteration always returns. Kept as a fail-closed guard.
  return degrade(state, "ITERATION_LIMIT_EXCEEDED");
}

/** Run the agent for one request. Never throws; all failures are returned as sanitized codes. */
export async function runAgent(
  input: AgentRunInput,
  deps: AgentDependencies,
): Promise<AgentRunResult> {
  const startedAt = deps.clock.now();
  const auditDeadlineAt = startedAt + deps.limits.totalDeadlineMs;
  const deadlineAt = auditDeadlineAt - deps.limits.auditReserveMs;
  const state: RunState = {
    iterations: 0,
    usage: null,
    items: [{ type: "user_message", text: input.message }],
    outcomes: [],
    ledger: createEvidenceLedger(),
    budget: createExecutionBudget(),
  };
  const summarize = (verdict: Verdict): AgentRunResult => ({
    ...verdict,
    iterations: state.iterations,
    toolExecutions: state.budget.executionsUsed,
    receipts: state.outcomes.map((o) => ({
      executionId: o.executionId,
      tool: o.toolId,
      authorization: o.authorization,
      status: o.status,
      errorCode: o.errorCode,
    })),
    usage: state.usage,
  });
  const audit = (write: () => Promise<void>) =>
    boundedReceiptWrite(deps.clock, auditDeadlineAt, write);

  if (!isVerifiedPrincipal(input.principal)) return summarize(failed("AUTHORIZATION_REVOKED"));
  try {
    await audit(deps.validateContext);
  } catch {
    return summarize(failed("AUTHORIZATION_REVOKED"));
  }
  try {
    await audit(() =>
      deps.receipts.startRun({
        requestId: input.requestId,
        userId: input.principal.userId,
        startedAt,
      }),
    );
  } catch {
    return summarize(failed("RECEIPT_WRITE_FAILED"));
  }

  // Aborted when the run ends so any straggling cooperative work (fetch, D1) is cancelled.
  const controller = new AbortController();
  const ctx: ExecutorContext = {
    principal: input.principal,
    requestId: input.requestId,
    registry: deps.registry,
    receipts: deps.receipts,
    clock: deps.clock,
    newId: deps.newId,
    limits: deps.limits,
    deadlineAt,
    auditDeadlineAt,
    runSignal: controller.signal,
    validateContext: deps.validateContext,
  };
  let verdict: Verdict;
  try {
    verdict = await loop(deps, state, ctx);
  } catch (error) {
    // Receipt failure: discard everything (fail closed). Other errors: degrade conservatively.
    verdict =
      error instanceof ReceiptWriteError
        ? failed("RECEIPT_WRITE_FAILED")
        : degradeOnError(state, codeOf(error));
  } finally {
    controller.abort();
  }

  try {
    await audit(deps.validateContext);
  } catch {
    verdict = failed("AUTHORIZATION_REVOKED");
  }
  try {
    await audit(() =>
      deps.receipts.finishRun({
        requestId: input.requestId,
        userId: input.principal.userId,
        status: verdict.status,
        answerSource: verdict.answerSource,
        iterations: state.iterations,
        toolExecutions: state.budget.executionsUsed,
        inputTokens: state.usage?.inputTokens ?? null,
        outputTokens: state.usage?.outputTokens ?? null,
        startedAt,
        completedAt: deps.clock.now(),
        errorCode: verdict.errorCode,
      }),
    );
  } catch {
    return summarize(failed("RECEIPT_WRITE_FAILED"));
  }
  try {
    await audit(deps.validateContext);
  } catch {
    return summarize(failed("AUTHORIZATION_REVOKED"));
  }
  return summarize(verdict);
}

/**
 * Provider failures are reported as failures (the client must know the model was unavailable);
 * any evidence already gathered is not turned into a model-free answer in that case.
 */
function degradeOnError(state: RunState, code: ErrorCode): Verdict {
  if (code === "AUTHORIZATION_REVOKED") return failed(code);
  if (
    code === "MODEL_TIMEOUT" ||
    code === "MODEL_UNAVAILABLE" ||
    code === "MODEL_MALFORMED_RESPONSE" ||
    code === "DEADLINE_EXCEEDED"
  )
    return failed(code);
  return degrade(state, code);
}
