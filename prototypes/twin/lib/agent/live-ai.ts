/**
 * Live AI application service: admission -> principal -> agent runtime -> HTTP presentation.
 * The route handler only parses input and composes adapters; all policy lives here and below.
 */
import type { Clock } from './deadline';
import type { ErrorCode } from './errors';
import { PRODUCTION_LIMITS, type RuntimeLimits } from './limits';
import type { AdmissionPort } from './admission';
import type { ModelPort } from './model-adapter';
import { createVerifiedPrincipal, type AuthenticatedIdentity } from './principal';
import type { ReceiptStore } from './receipts';
import { runAgent, type AgentRunResult } from './runtime';
import { createToolRegistry } from './tool-registry';
import { SEARCH_PERSONAL_MEMORY, createSearchPersonalMemoryTool, type PersonalCorpusReader } from './tools/search-personal-memory';

export type LiveAiInput = Readonly<{
  identity: AuthenticatedIdentity;
  aiContextConsent: boolean;
  message: string;
  requestId: string;
}>;

export type LiveAiDependencies = Readonly<{
  admission: AdmissionPort;
  model: ModelPort;
  corpus: PersonalCorpusReader;
  receipts: ReceiptStore;
  clock: Clock;
  newId: () => string;
  limits?: RuntimeLimits;
}>;

export type HttpOutcome = Readonly<{ status: number; body: Record<string, unknown> }>;

const MEMORY_MODE_NOTE = 'Memory mode is still available.';

/** Public-facing message per failure code. Never includes provider or internal detail. */
const FAILURE_RESPONSES: Partial<Record<ErrorCode, HttpOutcome>> = {
  MODEL_TIMEOUT: { status: 504, body: { error: `The AI provider took too long to respond. ${MEMORY_MODE_NOTE}` } },
  DEADLINE_EXCEEDED: { status: 504, body: { error: `The request ran out of time. ${MEMORY_MODE_NOTE}` } },
  MODEL_UNAVAILABLE: { status: 502, body: { error: `The AI provider could not complete this request. ${MEMORY_MODE_NOTE}` } },
  MODEL_MALFORMED_RESPONSE: { status: 502, body: { error: `The AI provider returned an unusable response. ${MEMORY_MODE_NOTE}` } },
  MODEL_EMPTY_RESPONSE: { status: 502, body: { error: 'The model returned no answer. Try a shorter request.' } },
  RECEIPT_WRITE_FAILED: { status: 503, body: { error: `Execution audit is unavailable, so no AI answer was returned. ${MEMORY_MODE_NOTE}` } },
};
const DEFAULT_FAILURE: HttpOutcome = { status: 502, body: { error: `JARVIS could not complete this request safely. ${MEMORY_MODE_NOTE}` } };

/** Execution metadata returned to the client. Contains no personal content. */
export function executionSummary(requestId: string, result: AgentRunResult): Record<string, unknown> {
  return {
    requestId,
    status: result.status,
    errorCode: result.errorCode,
    answerSource: result.answerSource,
    grounding: result.grounding,
    iterations: result.iterations,
    toolExecutions: result.toolExecutions,
    receipts: result.receipts,
  };
}

/** Map a run result to the HTTP response. Response shape stays compatible with the existing UI. */
export function presentRunResult(requestId: string, result: AgentRunResult): HttpOutcome {
  const execution = executionSummary(requestId, result);
  if (result.status === 'failed' || result.answer === null) {
    const failure = (result.errorCode && FAILURE_RESPONSES[result.errorCode]) || DEFAULT_FAILURE;
    return { status: failure.status, body: { ...failure.body, execution } };
  }
  return {
    status: 200,
    body: {
      text: result.answer,
      mode: 'ai',
      sources: result.sources.map((s) => ({ label: s.label, excerpt: s.excerpt, sourceId: s.sourceId, kind: s.kind, createdAt: s.createdAt, citation: s.citation })),
      execution,
    },
  };
}

/** Handle one Live AI request for an already-authenticated identity. */
export async function handleLiveAiRequest(input: LiveAiInput, deps: LiveAiDependencies): Promise<HttpOutcome> {
  const admission = await deps.admission.admit(input.identity.userId, input.requestId, deps.clock.now());
  if (admission === 'duplicate') return { status: 409, body: { error: 'This request was already submitted.' } };
  if (admission === 'rate_limited') {
    return { status: 429, body: { error: 'The prototype AI usage limit has been reached. Try again later or use Memory mode.' } };
  }
  const principal = createVerifiedPrincipal(input.identity, { aiContextConsent: input.aiContextConsent });
  const registry = createToolRegistry([createSearchPersonalMemoryTool(deps.corpus)]);
  const result = await runAgent(
    { principal, requestId: input.requestId, message: input.message },
    { model: deps.model, registry, receipts: deps.receipts, clock: deps.clock, newId: deps.newId, limits: deps.limits ?? PRODUCTION_LIMITS, personalLookupTool: SEARCH_PERSONAL_MEMORY },
  );
  return presentRunResult(input.requestId, result);
}
