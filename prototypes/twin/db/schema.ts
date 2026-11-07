import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('twin_accounts', { userId: text('user_id').primaryKey(), state: text('state').notNull(), version: integer('version').notNull().default(0) });
export const aiRequests = sqliteTable('twin_ai_requests', { id: text('id').primaryKey(), userId: text('user_id').notNull(), createdAt: integer('created_at').notNull() }, t => [index('ai_user_time').on(t.userId, t.createdAt)]);
