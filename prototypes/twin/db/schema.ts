import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('twin_accounts', { userId: text('user_id').primaryKey(), state: text('state').notNull(), version: integer('version').notNull().default(0) });
export const aiRequests = sqliteTable('twin_ai_requests', { id: text('id').primaryKey(), userId: text('user_id').notNull(), createdAt: integer('created_at').notNull() }, t => [index('ai_user_time').on(t.userId, t.createdAt)]);
/**
 * Agent execution receipts (P0-002). One row per tool-call attempt, including denied and
 * failed attempts. Contains no prompt text, memory text, arguments or credentials.
 */
export const agentExecutionReceipts = sqliteTable('agent_execution_receipts', {
  executionId: text('execution_id').primaryKey(),
  requestId: text('request_id').notNull(),
  userId: text('user_id').notNull(),
  callIndex: integer('call_index').notNull(),
  toolId: text('tool_id').notNull(),
  initiator: text('initiator', { enum: ['model', 'runtime'] }).notNull().default('model'),
  authorization: text('authorization', { enum: ['allow', 'deny'] }).notNull(),
  status: text('status', { enum: ['started', 'succeeded', 'failed', 'timed_out', 'denied'] }).notNull(),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  durationMs: integer('duration_ms'),
  errorCode: text('error_code'),
  sourceIds: text('source_ids').notNull().default('[]'),
}, t => [uniqueIndex('agent_receipt_request_call').on(t.requestId, t.callIndex), index('agent_receipt_user_time').on(t.userId, t.startedAt)]);
/** Run-level record (one per Live AI request) so runs without tool calls are also auditable. */
export const agentRuns = sqliteTable('agent_runs', {
  requestId: text('request_id').primaryKey(),
  userId: text('user_id').notNull(),
  status: text('status', { enum: ['running', 'completed', 'failed'] }).notNull(),
  answerSource: text('answer_source'),
  iterations: integer('iterations').notNull().default(0),
  toolExecutions: integer('tool_executions').notNull().default(0),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  durationMs: integer('duration_ms'),
  errorCode: text('error_code'),
}, t => [index('agent_run_user_time').on(t.userId, t.startedAt)]);
