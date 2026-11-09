import { z } from "zod";
import { type Snapshot, type RecordNode, recordText, normalize, validInstant, IntelligenceError } from "./model";
export const querySchema = z
  .object({
    query: z.string().trim().max(500).default(""),
    kind: z
      .enum(["entity", "fact", "relationship", "commitment", "procedure", "outcome"])
      .optional(),
    entityId: z.string().uuid().optional(),
    person: z.string().max(160).optional(),
    project: z.string().max(160).optional(),
    since: z.string().refine(validInstant).optional(),
    until: z.string().refine(validInstant).optional(),
    commitmentStatus: z
      .enum([
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "overdue",
        "no-deadline",
        "follow-up",
      ])
      .optional(),
    mode: z.enum(["lexical", "structured", "hybrid"]).default("hybrid"),
  })
  .strict();
export type Query = z.infer<typeof querySchema>;
const stop = new Set(
  "what which when why where who did do does i me my the a an to for in of and with is are was were have has since please tell show current now".split(
    " ",
  ),
);
const stems: Record<string, string> = {
  promised: "commitment",
  promise: "commitment",
  promises: "commitment",
  owe: "commitment",
  owed: "commitment",
  commitments: "commitment",
  prefer: "preference",
  preferences: "preference",
  meetings: "meeting",
  decided: "decision",
  decisions: "decision",
  writing: "write",
  written: "write",
  sent: "send",
  sending: "send",
  tasks: "task",
  projects: "project",
  people: "person",
  followup: "follow",
};
export function terms(s: string) {
  return [
    ...new Set(
      normalize(s)
        .split(" ")
        .filter((w) => w.length > 1 && !stop.has(w))
        .map((w) => stems[w] ?? w),
    ),
  ];
}

export function eligibleRecords(s: Snapshot, now = Date.now()): RecordNode[] {
  const map = new Map(s.records.map((r) => [r.id, r]));
  const ancestry = new Map<string, string[]>();
  for (const d of s.dependencies)
    ancestry.set(d.recordId, [...(ancestry.get(d.recordId) ?? []), d.ancestorId]);
  const memo = new Map<string, boolean>();
  const valid = (r: RecordNode, seen = new Set<string>()): boolean => {
    if (memo.has(r.id)) return memo.get(r.id)!;
    const result = check(r, seen);
    memo.set(r.id, result);
    return result;
  };
  const check = (r: RecordNode, seen: Set<string>): boolean => {
    if (seen.size > 32 || seen.has(r.id)) return false;
    if (
      r.owner !== s.owner ||
      r.generation !== s.generation ||
      r.confirmation !== "confirmed" ||
      r.validity !== "valid" ||
      r.privacy === "restricted" ||
      !r.content ||
      r.kind !== r.content.kind ||
      !validInstant(r.createdAt) || !validInstant(r.updatedAt) ||
      !validInstant(r.validFrom) ||
      (r.validTo !== null && !validInstant(r.validTo)) ||
      (r.kind !== "source" && !r.quote.trim()) ||
      Date.parse(r.validFrom) > now ||
      (r.validTo !== null && Date.parse(r.validTo) <= now)
    )
      return false;
    const next = new Set(seen).add(r.id);
    if (r.kind !== "source") {
      const source = map.get(r.sourceId);
      if (
        !source ||
        source.kind !== "source" ||
        !source.content ||
        source.content.kind !== "source" ||
        !source.content.text.includes(r.quote) ||
        !valid(source, next)
      )
        return false;
    }
    return (ancestry.get(r.id) ?? []).every((id) => {
      const ancestor = map.get(id);
      return !!ancestor && valid(ancestor, next);
    });
  };
  return s.records.filter((r) => valid(r));
}

export function retrieveContext(s: Snapshot, input: unknown, now = Date.now()) {
  const q = querySchema.parse(input),
    words = terms(q.query),
    byId = new Map(s.records.map((r) => [r.id, r]));
  const eligible = eligibleRecords(s, now),
    validIds = new Set(eligible.map((r) => r.id));
  const associated = new Set<string>(q.entityId ? [q.entityId] : []);
  // One bounded hop, and only through confirmed, temporally valid relationships.
  if (q.entityId && validIds.has(q.entityId))
    for (const r of eligible) {
      const c = r.content;
      if (c?.kind === "relationship" && (c.fromId === q.entityId || c.toId === q.entityId)) {
        associated.add(c.fromId);
        associated.add(c.toId);
      }
    }
  let requestedKind = q.kind;
  if (!requestedKind && q.mode === "hybrid") {
    if (words.some((w) => ["commitment", "overdue", "deadline", "follow"].includes(w)))
      requestedKind = "commitment";
    else if (words.includes("procedure")) requestedKind = "procedure";
  }
  const status =
    q.commitmentStatus ??
    (q.mode === "hybrid" && /\boverdue\b/i.test(q.query) ? "overdue" : undefined);
  const selected = eligible
    .filter((r) => {
      const c = r.content!;
      if (["source", "revision"].includes(c.kind)) return false;
      if (c.kind === "procedure" && c.status !== "active") return false;
      if (requestedKind && r.kind !== requestedKind) return false;
      if (q.since && Date.parse(r.updatedAt) < Date.parse(q.since)) return false;
      if (q.until && Date.parse(r.createdAt) > Date.parse(q.until)) return false;
      if (q.entityId) {
        if (!validIds.has(q.entityId)) return false;
        const refs =
          c.kind === "commitment"
            ? [c.personId, c.projectId]
            : c.kind === "fact"
              ? [c.subjectId]
              : c.kind === "relationship"
                ? [c.fromId, c.toId]
                : [r.id];
        if (!refs.some((id) => id && associated.has(id))) return false;
      }
      if (q.person) {
        if (c.kind !== "commitment") return false;
        const related = byId.get(c.personId ?? "")?.content;
        const person = c.personName ?? (related?.kind === "entity" ? related.name : "");
        if (normalize(person) !== normalize(q.person)) return false;
      }
      if (q.project) {
        if (c.kind !== "commitment") return false;
        const related = byId.get(c.projectId ?? "")?.content;
        const project = c.projectName ?? (related?.kind === "entity" ? related.name : "");
        if (normalize(project) !== normalize(q.project)) return false;
      }
      if (status) {
        if (c.kind !== "commitment") return false;
        const active = ["confirmed", "active"].includes(c.status);
        if (status === "overdue") return active && !!c.deadline && Date.parse(c.deadline) < now;
        if (status === "no-deadline") return active && !c.deadline;
        if (status === "follow-up") return active;
        return c.status === status;
      }
      return true;
    })
    .map((r) => {
      const text = recordText(r),
        recordWords = terms(
          `${text} ${r.kind} ${r.content?.kind === "fact" ? r.content.factType : ""}`,
        );
      const hits = words.filter((w) => recordWords.includes(w)).length;
      const exact = q.query && normalize(text).includes(normalize(q.query)) ? 4 : 0;
      const structured = !!(
        requestedKind ||
        q.entityId ||
        q.person ||
        q.project ||
        status ||
        q.since ||
        q.until
      );
      const score =
        hits * 3 +
        exact +
        (structured ? 2 : 0) +
        (r.content?.kind === "fact" &&
        r.content.factType === "preference" &&
        words.includes("preference")
          ? 2
          : 0);
      return {
        r,
        score,
        keep:
          q.mode === "structured"
            ? structured || hits > 0
            : words.length
              ? hits > 0 || (structured && q.mode === "hybrid")
              : structured,
      };
    })
    .filter((x) => x.keep)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.r.updatedAt.localeCompare(a.r.updatedAt) ||
        a.r.id.localeCompare(b.r.id),
    )
    .slice(0, 5);
  let budget = 16000;
  const results = selected
    .map(({ r }) => ({
      id: r.id,
      kind: r.kind,
      text: recordText(r),
      sourceId: r.sourceId,
      sourceLabel:
        byId.get(r.sourceId)?.content?.kind === "source"
          ? (
              byId.get(r.sourceId)!.content as Extract<
                NonNullable<RecordNode["content"]>,
                { kind: "source" }
              >
            ).label
          : "Evidence",
      quote: r.quote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      version: r.version,
      content: r.content,
    }))
    .filter((result) => {
      const size = JSON.stringify(result).length;
      if (size > budget) return false;
      budget -= size;
      return true;
    });
  // An eligible record that cannot fit is not missing evidence. Do not silently
  // turn the bounded-context limit into a successful empty recall.
  if (!results.length && selected.length) throw new IntelligenceError("LIMIT");
  return {
    status: results.length ? ("ok" as const) : ("no_evidence" as const),
    results,
    epoch: s.epoch,
    generation: s.generation,
  };
}
