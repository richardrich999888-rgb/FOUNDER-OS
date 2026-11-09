/**
 * Deny-by-default authorization for a single, already schema-validated tool call.
 * Pure function: no IO, no clock reads (time is passed in), deterministic.
 *
 * Checked in order; the first failing rule determines the denial code:
 *   1. tool is read-only (defense in depth; the registry also enforces this)
 *   2. principal holds the tool's required scope
 *   3. per-request execution budget not exhausted
 *   4. run deadline not passed
 * Ownership is NOT a parameter: tools derive the data owner from the principal, so there is
 * no argument a model could change to access another user's data.
 */
import type { ErrorCode } from './errors';
import { hasScope, type VerifiedPrincipal } from './principal';
import type { AnyToolDefinition } from './tool-registry';

export type AuthorizationRequest = Readonly<{
  principal: VerifiedPrincipal;
  tool: AnyToolDefinition;
  executionsUsed: number;
  maxExecutions: number;
  now: number;
  deadlineAt: number;
}>;

export type AuthorizationResult = Readonly<{ decision: 'allow' }> | Readonly<{ decision: 'deny'; code: ErrorCode }>;

export function authorizeToolCall(request: AuthorizationRequest): AuthorizationResult {
  if (request.tool.sideEffects !== 'none') return { decision: 'deny', code: 'SIDE_EFFECTS_FORBIDDEN' };
  if (!hasScope(request.principal, request.tool.requiredScope)) return { decision: 'deny', code: 'MISSING_SCOPE' };
  if (request.executionsUsed >= request.maxExecutions) return { decision: 'deny', code: 'TOOL_LIMIT_EXCEEDED' };
  if (request.now >= request.deadlineAt) return { decision: 'deny', code: 'DEADLINE_EXCEEDED' };
  return { decision: 'allow' };
}
