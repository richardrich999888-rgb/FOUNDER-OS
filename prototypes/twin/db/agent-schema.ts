import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { intelligenceHeads } from "./intelligence-schema";
export const agentRuns = sqliteTable(
  "agent_runs",
  {
    requestId: text("request_id").primaryKey().notNull(),
    userId: text("user_id").notNull(),
    generation: text("generation").notNull(),
    epoch: integer("epoch").notNull(),
    status: text("status").notNull(),
    answerSource: text("answer_source"),
    startedAt: integer("started_at").notNull(),
    deadlineAt: integer("deadline_at").notNull(),
    completedAt: integer("completed_at"),
    durationMs: integer("duration_ms"),
    iterations: integer("iterations").notNull().default(0),
    toolExecutions: integer("tool_executions").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    errorCode: text("error_code"),
  },
  (t) => [
    uniqueIndex("agent_run_owner_generation").on(t.requestId, t.userId, t.generation),
    index("agent_run_owner_time").on(t.userId, t.startedAt),
    foreignKey({
      columns: [t.userId, t.generation],
      foreignColumns: [intelligenceHeads.owner, intelligenceHeads.generation],
    }).onDelete("cascade"),
  ],
);
export const agentExecutionReceipts = sqliteTable(
  "agent_execution_receipts",
  {
    executionId: text("execution_id").primaryKey().notNull(),
    requestId: text("request_id").notNull(),
    userId: text("user_id").notNull(),
    generation: text("generation").notNull(),
    callIndex: integer("call_index").notNull(),
    toolId: text("tool_id").notNull(),
    authorization: text("authorization").notNull(),
    status: text("status").notNull(),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    sourceIds: text("source_ids").notNull().default("[]"),
  },
  (t) => [
    uniqueIndex("agent_call_once").on(t.requestId, t.callIndex),
    foreignKey({
      columns: [t.requestId, t.userId, t.generation],
      foreignColumns: [agentRuns.requestId, agentRuns.userId, agentRuns.generation],
    }).onDelete("cascade"),
  ],
);
