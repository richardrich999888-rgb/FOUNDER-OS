import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  foreignKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { accounts } from "./schema";
export const intelligenceHeads = sqliteTable(
  "twin_intelligence_heads",
  {
    owner: text("owner").primaryKey(),
    generation: text("generation").notNull(),
    epoch: integer("epoch").notNull().default(0),
  },
  (t) => [
    uniqueIndex("intelligence_head_generation").on(t.owner, t.generation),
    foreignKey({
      columns: [t.owner, t.generation],
      foreignColumns: [accounts.userId, accounts.generation],
    }).onDelete("cascade"),
  ],
);
export const intelligenceRecords = sqliteTable(
  "twin_intelligence_records",
  {
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    id: text("id").notNull(),
    kind: text("kind").notNull(),
    sourceId: text("source_id").notNull(),
    content: text("content"),
    quote: text("quote").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    confirmation: text("confirmation").notNull(),
    validity: text("validity").notNull(),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    privacy: text("privacy").notNull(),
    version: integer("version").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.id] }),
    uniqueIndex("intelligence_record_generation").on(t.owner, t.generation, t.id),
    index("twin_intelligence_owner_status").on(
      t.owner,
      t.validity,
      t.confirmation,
      t.kind,
      t.updatedAt,
    ),
    foreignKey({
      columns: [t.owner, t.generation],
      foreignColumns: [intelligenceHeads.owner, intelligenceHeads.generation],
    }).onDelete("cascade"),
    foreignKey({ columns: [t.owner, t.sourceId], foreignColumns: [t.owner, t.id] }),
  ],
);
export const intelligenceDependencies = sqliteTable(
  "twin_intelligence_dependencies",
  {
    owner: text("owner").notNull(),
    recordId: text("record_id").notNull(),
    ancestorId: text("ancestor_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.recordId, t.ancestorId] }),
    foreignKey({
      columns: [t.owner, t.recordId],
      foreignColumns: [intelligenceRecords.owner, intelligenceRecords.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.owner, t.ancestorId],
      foreignColumns: [intelligenceRecords.owner, intelligenceRecords.id],
    }).onDelete("cascade"),
  ],
);
export const intelligenceGuard = sqliteTable(
  "twin_intelligence_guard",
  {
    owner: text("owner").primaryKey(),
    generation: text("generation").notNull(),
    expectedEpoch: integer("expected_epoch").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.owner, t.generation],
      foreignColumns: [intelligenceHeads.owner, intelligenceHeads.generation],
    }).onDelete("cascade"),
  ],
);
export const intelligenceReceipts = sqliteTable(
  "twin_intelligence_receipts",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    generation: text("generation").notNull(),
    tool: text("tool").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
    epoch: integer("epoch").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.owner, t.generation],
      foreignColumns: [intelligenceHeads.owner, intelligenceHeads.generation],
    }).onDelete("cascade"),
  ],
);
