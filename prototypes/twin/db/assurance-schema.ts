import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  unique,
  index,
  foreignKey,
  check,
} from "drizzle-orm/sqlite-core";
import { intelligenceHeads } from "./intelligence-schema";
import { agentRuns } from "./agent-schema";

// Triggers and CAS semantics remain in reviewed SQL migration 0003.
export const workflows = sqliteTable(
  "twin_workflows",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    id: text("id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    intent: text("intent").notNull(),
    plan: text("plan").notNull(),
    planHash: text("plan_hash").notNull(),
    sourceRefs: text("source_refs").notNull(),
    dependencies: text("dependencies").notNull(),
    priority: integer("priority").notNull(),
    projectImportance: integer("project_importance").notNull(),
    state: text("state").notNull(),
    version: integer("version").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deadlineAt: integer("deadline_at").notNull(),
    authorizationId: text("authorization_id"),
    runId: text("run_id"),
    leaseUntil: integer("lease_until"),
    attempts: integer("attempts").notNull().default(0),
    reason: text("reason").notNull(),
    actor: text("actor").notNull(),
    correlationId: text("correlation_id").notNull(),
    checkpointHash: text("checkpoint_hash").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.id] }),
    unique().on(t.owner, t.generation, t.id),
    unique().on(t.owner, t.generation, t.idempotencyKey),
    index("twin_workflow_activity").on(t.owner, t.updatedAt),
    foreignKey({
      columns: [t.owner, t.generation],
      foreignColumns: [intelligenceHeads.owner, intelligenceHeads.generation],
    }).onDelete("cascade"),
    check("workflow_priority", sql`${t.priority} BETWEEN 0 AND 3`),
    check("workflow_project_importance", sql`${t.projectImportance} BETWEEN 0 AND 3`),
    check("workflow_attempts", sql`${t.attempts} BETWEEN 0 AND 3`),
    check(
      "workflow_state",
      sql`${t.state} IN ('PROPOSED','AWAITING_APPROVAL','AUTHORIZED','RUNNING','COMPLETED','FAILED','CANCELLED','UNKNOWN')`,
    ),
    check("workflow_actor", sql`${t.actor} IN ('user','runtime','reconciler','system')`),
  ],
);

export const workflowAuthorizations = sqliteTable(
  "twin_workflow_authorizations",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    workflowId: text("workflow_id").notNull(),
    id: text("id").notNull(),
    epoch: integer("epoch").notNull(),
    planHash: text("plan_hash").notNull(),
    issuedAt: integer("issued_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    requiresConsent: integer("requires_consent").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.id] }),
    foreignKey({
      columns: [t.owner, t.generation, t.workflowId],
      foreignColumns: [workflows.owner, workflows.generation, workflows.id],
    }).onDelete("cascade"),
    check("workflow_requires_consent", sql`${t.requiresConsent} IN (0,1)`),
  ],
);

export const workflowEvents = sqliteTable(
  "twin_workflow_events",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    workflowId: text("workflow_id").notNull(),
    version: integer("version").notNull(),
    previousState: text("previous_state"),
    newState: text("new_state").notNull(),
    at: integer("at").notNull(),
    actor: text("actor").notNull(),
    authorizationId: text("authorization_id"),
    runId: text("run_id"),
    reason: text("reason").notNull(),
    correlationId: text("correlation_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.workflowId, t.version] }),
    foreignKey({
      columns: [t.owner, t.generation, t.workflowId],
      foreignColumns: [workflows.owner, workflows.generation, workflows.id],
    }).onDelete("cascade"),
  ],
);

export const workflowOutcomes = sqliteTable(
  "twin_workflow_outcomes",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    workflowId: text("workflow_id").notNull(),
    runId: text("run_id").notNull(),
    authorizationId: text("authorization_id").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    receiptCount: integer("receipt_count").notNull(),
    observedAt: integer("observed_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.runId] }),
    foreignKey({
      columns: [t.owner, t.generation, t.workflowId],
      foreignColumns: [workflows.owner, workflows.generation, workflows.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.runId, t.owner, t.generation],
      foreignColumns: [agentRuns.requestId, agentRuns.userId, agentRuns.generation],
    }).onDelete("cascade"),
    check("workflow_receipt_count", sql`${t.receiptCount}>0`),
  ],
);

export const workflowGuard = sqliteTable(
  "twin_workflow_guard",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    workflowId: text("workflow_id").notNull(),
    expectedVersion: integer("expected_version").notNull(),
    expectedEpoch: integer("expected_epoch").notNull(),
    validUntil: integer("valid_until").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.workflowId] }),
    foreignKey({
      columns: [t.owner, t.generation, t.workflowId],
      foreignColumns: [workflows.owner, workflows.generation, workflows.id],
    }).onDelete("cascade"),
  ],
);

export const priorityOverrides = sqliteTable(
  "twin_priority_overrides",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    sourceRef: text("source_ref").notNull(),
    priority: integer("priority").notNull(),
    projectImportance: integer("project_importance").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.sourceRef] }),
    foreignKey({
      columns: [t.owner, t.generation],
      foreignColumns: [intelligenceHeads.owner, intelligenceHeads.generation],
    }).onDelete("cascade"),
    check("override_priority", sql`${t.priority} BETWEEN 0 AND 3`),
    check("override_project_importance", sql`${t.projectImportance} BETWEEN 0 AND 3`),
  ],
);
