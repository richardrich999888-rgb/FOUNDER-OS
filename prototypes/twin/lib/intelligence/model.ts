import { z } from "zod";
export const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(2000);
const name = z.string().trim().min(1).max(160);
const ref = uuid.nullable();
export const contentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("source"),
      text: z.string().min(1).max(16000),
      label: name,
      origin: z.enum(["user", "document", "legacy", "feedback"]),
      legacyId: z.string().max(100).nullable(),
      legacyKind: z.enum(["memory", "document", "task"]).nullable(),
      legacyFingerprint: z.string().max(64).nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("entity"),
      entityType: z.enum(["person", "organization", "project"]),
      name,
      aliases: z.array(name).max(8),
    })
    .strict(),
  z
    .object({
      kind: z.literal("fact"),
      factType: z.enum(["preference", "decision", "context", "goal", "routine"]),
      text,
      key: name,
      subjectId: ref,
      value: z.string().max(500).nullable(),
      rationale: z.string().max(1500).nullable(),
    })
    .strict(),
  z
    .object({ kind: z.literal("relationship"), fromId: uuid, toId: uuid, label: name, text })
    .strict(),
  z
    .object({
      kind: z.literal("commitment"),
      text,
      personId: ref,
      projectId: ref,
      personName: name.nullable(),
      projectName: name.nullable(),
      deadline: z.string().max(64).nullable(),
      timezone: z.string().max(64).nullable(),
      deadlineText: z.string().max(200).nullable(),
      nextAction: z.string().max(1000),
      status: z.enum(["proposed", "confirmed", "active", "completed", "cancelled", "superseded"]),
      completionEvidenceId: ref,
    })
    .strict(),
  z
    .object({
      kind: z.literal("procedure"),
      title: name,
      workflowKey: name,
      steps: z.array(text).min(2).max(12),
      basisIds: z.array(uuid).max(20),
      status: z.enum(["candidate", "active", "retired"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("outcome"),
      workflowKey: name,
      runId: uuid,
      steps: z.array(text).min(2).max(12),
      manualSteps: z.number().int().min(1).max(100),
      success: z.boolean(),
      feedback: text,
      verification: z.literal("user-attested"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("revision"),
      previousIds: z.array(uuid).min(1).max(20),
      nextId: uuid,
      reason: z.string().max(500),
    })
    .strict(),
]);
export type Content = z.infer<typeof contentSchema>;
export type Kind = Content["kind"];
export type RecordNode = {
  id: string;
  owner: string;
  generation: string;
  kind: Kind;
  sourceId: string;
  content: Content | null;
  quote: string;
  createdAt: string;
  updatedAt: string;
  confirmation: "proposed" | "confirmed";
  validity: "valid" | "superseded" | "deleted" | "invalid";
  validFrom: string;
  validTo: string | null;
  privacy: "private" | "restricted";
  version: number;
};
export type Dependency = { recordId: string; ancestorId: string };
export type Snapshot = {
  owner: string;
  generation: string;
  epoch: number;
  accountVersion: number;
  legacy: import("../twin/core").State;
  records: RecordNode[];
  dependencies: Dependency[];
};
export class IntelligenceError extends Error {
  constructor(
    public code:
      | "INVALID"
      | "CONFLICT"
      | "NOT_FOUND"
      | "LIMIT"
      | "PROVENANCE"
      | "DENIED"
      | "UNAVAILABLE",
  ) {
    super(code);
  }
}
export function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function restricted(value: string) {
  return /(?:\b(?:password|api[ _-]?key|private[ _-]?key|social security|diagnosis)\b|\b\d{3}-\d{2}-\d{4}\b|\bsk-[a-zA-Z0-9_-]{12,})/i.test(
    value,
  );
}
export function validInstant(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))
    return false;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const hour = Number(value.slice(11, 13)),
    minute = Number(value.slice(14, 16)),
    second = Number(value.slice(17, 19) || 0);
  return (
    y >= 1900 &&
    y <= 2200 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= new Date(Date.UTC(y, m, 0)).getUTCDate() &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    Number.isFinite(Date.parse(value))
  );
}
export function validateContent(content: Content) {
  if (content.kind === "commitment") {
    if ((content.deadline === null) !== (content.timezone === null))
      throw new IntelligenceError("INVALID");
    if (content.deadline) {
      if (!validInstant(content.deadline)) throw new IntelligenceError("INVALID");
      try {
        new Intl.DateTimeFormat("en", { timeZone: content.timezone! }).format();
      } catch {
        throw new IntelligenceError("INVALID");
      }
    }
  }
}
export function references(content: Content): string[] {
  if (content.kind === "relationship") return [content.fromId, content.toId];
  if (content.kind === "fact") return content.subjectId ? [content.subjectId] : [];
  if (content.kind === "commitment")
    return [content.personId, content.projectId, content.completionEvidenceId].filter(
      (x): x is string => !!x,
    );
  if (content.kind === "procedure") return content.basisIds;
  if (content.kind === "revision") return [...content.previousIds, content.nextId];
  return [];
}
export function recordText(record: RecordNode): string {
  const c = record.content;
  if (!c) return "";
  switch (c.kind) {
    case "source":
      return c.text;
    case "entity":
      return [c.name, ...c.aliases].join(" ");
    case "fact":
      return [c.text, c.rationale].filter(Boolean).join(" Because: ");
    case "relationship":
      return c.text;
    case "commitment":
      return [c.text, c.personName, c.projectName, c.deadline, c.timezone, c.nextAction, c.status]
        .filter(Boolean)
        .join(" · ");
    case "procedure":
      return `${c.title}: ${c.steps.join(" → ")}`;
    case "outcome":
      return c.feedback;
    case "revision":
      return c.reason;
  }
}
