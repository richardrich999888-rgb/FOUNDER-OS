/**
 * Runtime limits for the JARVIS agent loop.
 *
 * These ceilings are enforced by backend code (runtime.ts, executor.ts, model-adapter.ts).
 * They are never communicated to the model as the enforcement mechanism.
 */
export type RuntimeLimits = Readonly<{
  /** Maximum model calls (model/tool-selection iterations) per request. */
  maxIterations: number;
  /** Maximum tool executions (allowed and attempted) per request. */
  maxToolExecutions: number;
  /** Hard wall-clock budget for the whole run, in milliseconds. */
  totalDeadlineMs: number;
  /** max_output_tokens sent with every model call. */
  maxOutputTokens: number;
  /** Per-tool execution timeout, bounded further by the remaining run deadline. */
  toolTimeoutMs: number;
  /** Denied tool-call receipts written per run before the run is aborted (receipt-flood guard). */
  maxDeniedCallsPerRun: number;
  /** Maximum raw length of a model-supplied tool-arguments JSON string. */
  maxArgumentsChars: number;
  /** Maximum characters of model text accepted as a final answer. */
  maxAnswerChars: number;
  /**
   * Portion of totalDeadlineMs reserved for audit writes. Model and tool work must finish by
   * (total - reserve); receipt writes are bounded by the hard deadline (total). This keeps the
   * whole request, including the final run record, inside totalDeadlineMs.
   */
  auditReserveMs: number;
}>;

/** Production ceilings (P0-002 specification). */
export const PRODUCTION_LIMITS: RuntimeLimits = Object.freeze({
  maxIterations: 3,
  maxToolExecutions: 5,
  totalDeadlineMs: 45_000,
  maxOutputTokens: 1_200,
  toolTimeoutMs: 5_000,
  maxDeniedCallsPerRun: 10,
  maxArgumentsChars: 2_000,
  maxAnswerChars: 8_000,
  auditReserveMs: 2_000,
});

/**
 * Resolve limits from optional overrides. Overrides may only TIGHTEN production ceilings;
 * any attempt to loosen one throws, so tests and callers cannot widen the runtime envelope.
 */
export function resolveLimits(overrides: Partial<RuntimeLimits> = {}): RuntimeLimits {
  const resolved: Record<string, number> = { ...PRODUCTION_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in PRODUCTION_LIMITS)) throw new Error(`Unknown runtime limit: ${key}`);
    const ceiling = PRODUCTION_LIMITS[key as keyof RuntimeLimits];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > ceiling) {
      throw new Error(`Runtime limit ${key} must be an integer in [1, ${ceiling}]`);
    }
    resolved[key] = value;
  }
  if (resolved.auditReserveMs >= resolved.totalDeadlineMs) {
    throw new Error('Runtime limit auditReserveMs must be smaller than totalDeadlineMs');
  }
  return Object.freeze(resolved) as RuntimeLimits;
}
