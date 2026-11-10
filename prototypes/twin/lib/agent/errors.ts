/**
 * Closed set of sanitized error codes. Receipts and API responses only ever carry one of these
 * values; raw exception messages (which may contain prompt text or provider detail) are dropped.
 */
export const ERROR_CODES = [
  "AUTHORIZATION_REVOKED",
  "UNKNOWN_TOOL",
  "INVALID_ARGUMENTS_JSON",
  "INVALID_ARGUMENTS",
  "ARGUMENTS_TOO_LARGE",
  "DUPLICATE_CALL_ID",
  "MISSING_SCOPE",
  "SIDE_EFFECTS_FORBIDDEN",
  "TOOL_LIMIT_EXCEEDED",
  "ITERATION_LIMIT_EXCEEDED",
  "DEADLINE_EXCEEDED",
  "TOOL_TIMEOUT",
  "TOOL_FAILED",
  "TOOL_RESULT_INVALID",
  "TOOL_RESULT_TOO_LARGE",
  "MODEL_TIMEOUT",
  "MODEL_UNAVAILABLE",
  "MODEL_MALFORMED_RESPONSE",
  "MODEL_INCOMPLETE_RESPONSE",
  "MODEL_EMPTY_RESPONSE",
  "GROUNDING_FABRICATED_CITATION",
  "GROUNDING_CITATION_MISSING",
  "GROUNDING_UNSUPPORTED_NUMBER",
  "MODEL_POLICY_VIOLATION",
  "RECEIPT_WRITE_FAILED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(ERROR_CODES);

/** Map any value to an allow-listed error code; unknown values collapse to INTERNAL_ERROR. */
export function sanitizeErrorCode(value: unknown): ErrorCode {
  return typeof value === "string" && CODE_SET.has(value) ? (value as ErrorCode) : "INTERNAL_ERROR";
}

/** Error carrying a sanitized code. `message` is always the code itself, never external text. */
export class AgentError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.name = "AgentError";
    this.code = code;
  }
}

/** Raised when an execution receipt cannot be persisted. Always terminates the run (fail closed). */
export class ReceiptWriteError extends AgentError {
  constructor() {
    super("RECEIPT_WRITE_FAILED");
    this.name = "ReceiptWriteError";
  }
}

/** Extract a sanitized code from any thrown value. */
export function codeOf(error: unknown, fallback: ErrorCode = "INTERNAL_ERROR"): ErrorCode {
  return error instanceof AgentError ? error.code : fallback;
}
