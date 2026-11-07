import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('twin_accounts', { userId: text('user_id').primaryKey(), state: text('state').notNull(), version: integer('version').notNull().default(0), generation: text('generation').notNull().default('') }, t => [uniqueIndex('twin_account_generation').on(t.userId,t.generation)]);
export const aiRequests = sqliteTable('twin_ai_requests', { id: text('id').primaryKey(), userId: text('user_id').notNull(), createdAt: integer('created_at').notNull() }, t => [index('ai_user_time').on(t.userId, t.createdAt)]);

export * from './intelligence-schema';
