import { z } from "zod";
import { intelligenceTools } from "../agent/intelligence-tools";

export const states = [
  "PROPOSED",
  "AWAITING_APPROVAL",
  "AUTHORIZED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
] as const;
export type WorkflowState = (typeof states)[number];
export const reasons = [
  "CREATED",
  "REVIEW_REQUESTED",
  "USER_AUTHORIZED",
  "STARTED",
  "READ_COMPLETED",
  "EXECUTION_FAILED",
  "TIMEOUT",
  "PARTIAL_EXECUTION",
  "CANCELLED_BY_USER",
  "AUTHORIZATION_REVOKED",
  "AUTHORIZATION_EXPIRED",
  "WORKFLOW_EXPIRED",
  "RECONCILIATION_REQUIRED",
  "SUPERSEDED_INTENTION",
  "CHECKPOINT_INVALID",
  "RETRY_REQUESTED",
] as const;
export type Reason = (typeof reasons)[number];
export const planSchema = z.discriminatedUnion("mode", [
  z
    .object({ mode: z.literal("local"), tool: z.enum(intelligenceTools), args: z.unknown() })
    .strict(),
  z.object({ mode: z.literal("model"), message: z.string().trim().min(1).max(4000) }).strict(),
]);
export type Plan = z.infer<typeof planSchema>;
const id = z.string().uuid();
const ref = z
  .string()
  .regex(/^(intelligence:[a-f0-9-]{36}|task:[A-Za-z0-9-]{1,100}|workflow:[a-f0-9-]{36})$/);
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("propose"),
      idempotencyKey: id,
      intent: z.string().trim().min(1).max(500),
      plan: planSchema,
      sourceRefs: z.array(ref).max(10).default([]),
      dependencies: z.array(id).max(10).default([]),
      deadlineAt: z.number().int().positive(),
      priority: z.number().int().min(0).max(3).default(1),
      projectImportance: z.number().int().min(0).max(3).default(0),
    })
    .strict(),
  z
    .object({
      action: z.enum([
        "review",
        "approve",
        "execute",
        "cancel",
        "resume",
        "reconcile",
        "supersede",
      ]),
      id,
      version: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("priority"),
      sourceRef: ref,
      priority: z.number().int().min(0).max(3),
      projectImportance: z.number().int().min(0).max(3),
    })
    .strict(),
]);
export type Workflow = {
  owner: string;
  generation: string;
  id: string;
  idempotency_key: string;
  intent: string;
  plan: string;
  plan_hash: string;
  source_refs: string;
  dependencies: string;
  priority: number;
  project_importance: number;
  state: WorkflowState;
  version: number;
  created_at: number;
  updated_at: number;
  deadline_at: number;
  authorization_id: string | null;
  run_id: string | null;
  lease_until: number | null;
  attempts: number;
  reason: Reason;
  actor: "user" | "runtime" | "reconciler" | "system";
  correlation_id: string;
  checkpoint_hash: string;
};
export class AssuranceError extends Error {
  constructor(
    public code:
      | "INVALID"
      | "NOT_FOUND"
      | "CONFLICT"
      | "DENIED"
      | "UNAVAILABLE"
      | "EXPIRED"
      | "LIMIT"
      | "CHECKPOINT_INVALID",
  ) {
    super(code);
  }
}
export async function digest(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
// Consistency checksum, not a signature or proof against a database administrator.
export function checkpoint(
  w: Pick<
    Workflow,
    "id" | "generation" | "plan_hash" | "source_refs" | "dependencies" | "deadline_at"
  >,
) {
  return digest([1, w.id, w.generation, w.plan_hash, w.source_refs, w.dependencies, w.deadline_at]);
}
export const terminal = (s: WorkflowState) => s === "COMPLETED" || s === "CANCELLED";
