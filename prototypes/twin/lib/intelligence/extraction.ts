import { z } from "zod";
import {
  contentSchema,
  type Content,
  type RecordNode,
  IntelligenceError,
  normalize,
  validateContent,
  validInstant,
} from "./model";
export type Candidate = { content: Content; quote: string; issues: string[] };
const outputSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            content: contentSchema,
            quote: z.string().min(1).max(2000),
            issues: z.array(z.string().max(80)).max(10),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

// Optional model output is data only. No model/network calls are made here.
// Exact source spans establish attribution, not semantic truth; review is mandatory.
export function validateExtraction(raw: unknown, source: string): Candidate[] {
  if (typeof raw === "string") {
    if (raw.length > 64000) throw new IntelligenceError("INVALID");
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new IntelligenceError("INVALID");
    }
  }
  const result = outputSchema.safeParse(raw);
  if (!result.success) throw new IntelligenceError("INVALID");
  for (const item of result.data.candidates) {
    if (
      ["source", "outcome", "revision"].includes(item.content.kind) ||
      !source.includes(item.quote)
    )
      throw new IntelligenceError("PROVENANCE");
    validateContent(item.content);
    if (item.content.kind === "procedure" && item.content.status !== "candidate")
      throw new IntelligenceError("DENIED");
    if (item.content.kind === "commitment" && item.content.status !== "proposed")
      throw new IntelligenceError("DENIED");
  }
  return result.data.candidates;
}

export function extractCandidates(source: string, entities: RecordNode[] = []): Candidate[] {
  if (!source.trim() || source.length > 16000) throw new IntelligenceError("INVALID");
  const candidates: Candidate[] = [];
  const lines = source
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length > 2000) continue;
    let content: Content | undefined;
    const issues: string[] = [];
    const entity = line.match(/^(Person|Organization|Project):\s*(.+?)\.?$/i);
    const preference = line.match(/^I (?:now )?prefer\s+(.+?)[.!]?$/i);
    const decision = line.match(/^I decided to (.+?) because (.+?)[.!]?$/i);
    const goal = line.match(/^My (goal|routine) is (.+?)[.!]?$/i);
    const promise = line.match(/^I (?:will|promise to|committed to)\s+(.+?)[.!]?$/i);
    const relationship = line.match(/^Relationship:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
    const procedure = line.match(/^Procedure:\s*(.+?)\s*\|\s*(.+)$/i);
    if (entity) {
      const entityType = entity[1].toLowerCase() as "person" | "organization" | "project";
      content = { kind: "entity", entityType, name: entity[2], aliases: [] };
      if (entityType === "person" && !entity[2].includes(" ")) issues.push("incomplete_name");
    } else if (preference) {
      const value = preference[1];
      const key = /\bmeetings?\b/i.test(value)
        ? "meeting-preference"
        : /\banswers?|responses?\b/i.test(value)
          ? "answer-preference"
          : `preference:${normalize(value).split(" ").slice(-1)[0]}`;
      content = {
        kind: "fact",
        factType: "preference",
        text: line,
        key,
        subjectId: null,
        value,
        rationale: null,
      };
    } else if (decision)
      content = {
        kind: "fact",
        factType: "decision",
        text: line,
        key: `decision:${normalize(decision[1]).slice(0, 100)}`,
        subjectId: null,
        value: decision[1],
        rationale: decision[2],
      };
    else if (goal)
      content = {
        kind: "fact",
        factType: goal[1].toLowerCase() as "goal" | "routine",
        text: line,
        key: `${goal[1].toLowerCase()}:${normalize(goal[2]).slice(0, 100)}`,
        subjectId: null,
        value: goal[2],
        rationale: null,
      };
    else if (promise) {
      const body = promise[1];
      const person =
        body.match(
          /\bto ([\p{Lu}][\p{L}'-]*(?: [\p{Lu}][\p{L}'-]*)*)(?= for | by |\. Next:|$)/u,
        )?.[1] ?? null;
      const project =
        body.match(/\bfor (?:Project )?([\p{Lu}][\p{L}\d -]*?)(?= by |\. Next:|$)/u)?.[1] ?? null;
      const due = body.match(/\bby (.+?)(?=\. Next:|$)/i)?.[1] ?? null;
      const explicit = due?.match(/^(\S+)\s+\[([^\]]+)\]$/);
      let deadline: string | null = null,
        timezone: string | null = null;
      if (explicit && validInstant(explicit[1])) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: explicit[2] }).format();
          deadline = explicit[1];
          timezone = explicit[2];
        } catch {
          issues.push("invalid_timezone");
        }
      }
      if (due && !deadline) issues.push("ambiguous_deadline");
      if (person && !person.includes(" ")) issues.push("incomplete_name");
      content = {
        kind: "commitment",
        text: line,
        personId: null,
        projectId: null,
        personName: person,
        projectName: project,
        deadline,
        timezone,
        deadlineText: due,
        nextAction: body.match(/\. Next:\s*(.+)$/i)?.[1] ?? "",
        status: "proposed",
        completionEvidenceId: null,
      };
    } else if (relationship) {
      const resolve = (name: string) =>
        entities.filter(
          (r) =>
            r.content?.kind === "entity" &&
            [r.content.name, ...r.content.aliases].some((n) => normalize(n) === normalize(name)),
        );
      const from = resolve(relationship[1]),
        to = resolve(relationship[3]);
      if (from.length === 1 && to.length === 1 && from[0].id !== to[0].id)
        content = {
          kind: "relationship",
          fromId: from[0].id,
          toId: to[0].id,
          label: relationship[2],
          text: line,
        };
    } else if (procedure) {
      const steps = procedure[2]
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);
      if (steps.length >= 2 && steps.length <= 12)
        content = {
          kind: "procedure",
          title: procedure[1],
          workflowKey: normalize(procedure[1]),
          steps,
          basisIds: [],
          status: "candidate",
        };
    }
    if (content) candidates.push({ content, quote: line, issues });
    if (candidates.length === 20) break;
  }
  return validateExtraction({ candidates }, source);
}
