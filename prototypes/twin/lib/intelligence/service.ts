import { z } from "zod";
import type { Identity } from "../security/identity";
import { authorize } from "../security/authorize";
import {
  contentSchema,
  type Content,
  type Snapshot,
  type RecordNode,
  type Dependency,
  IntelligenceError,
  normalize,
  references,
  restricted,
  validateContent,
  recordText,
} from "./model";
import { extractCandidates, validateExtraction, type Candidate } from "./extraction";
import { readSnapshot, commitMutation } from "./store";
import { eligibleRecords, retrieveContext } from "./retrieval";

const id = z.string().uuid();
const epoch = z.number().int().min(0);
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("capture"),
      epoch,
      text: z.string().trim().min(1).max(16000),
      label: z.string().trim().min(1).max(160),
      privacy: z.enum(["private", "restricted"]).default("private"),
      extraction: z.unknown().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("propose"),
      epoch,
      text: z.string().trim().min(1).max(16000),
      label: z.string().trim().min(1).max(160),
      content: contentSchema,
      quote: z.string().min(1).max(2000),
      privacy: z.enum(["private", "restricted"]).default("private"),
    })
    .strict(),
  z
    .object({
      action: z.literal("confirm"),
      epoch,
      id,
      supersedes: z.array(id).max(20).default([]),
    })
    .strict(),
  z
    .object({
      action: z.literal("transition"),
      epoch,
      id,
      status: z.enum(["active", "completed", "cancelled"]),
      nextAction: z.string().max(1000).optional(),
      completionEvidenceId: id.optional(),
    })
    .strict(),
  z
    .object({ action: z.literal("forget"), epoch, id, confirmation: z.literal("FORGET EVIDENCE") })
    .strict(),
  z.object({ action: z.literal("learn"), epoch, workflowKey: z.string().min(1).max(160) }).strict(),
  z.object({ action: z.literal("activate"), epoch, id }).strict(),
  z
    .object({
      action: z.literal("importLegacy"),
      epoch,
      kind: z.enum(["memory", "document", "task"]),
      id,
    })
    .strict(),
]);
function node(
  s: Snapshot,
  content: Content,
  sourceId: string,
  id = crypto.randomUUID(),
  quote = "",
  privacy: "private" | "restricted" = "private",
): RecordNode {
  const now = new Date().toISOString();
  return {
    id,
    owner: s.owner,
    generation: s.generation,
    kind: content.kind,
    sourceId,
    content,
    quote,
    createdAt: now,
    updatedAt: now,
    confirmation: "proposed",
    validity: "valid",
    validFrom: now,
    validTo: null,
    privacy,
    version: 0,
  };
}
function changed(r: RecordNode, patch: Partial<RecordNode>): RecordNode {
  return { ...r, ...patch, updatedAt: new Date().toISOString(), version: r.version + 1 };
}
function find(s: Snapshot, id: string) {
  const r = s.records.find((r) => r.id === id && r.validity === "valid" && r.content);
  if (!r) throw new IntelligenceError("NOT_FOUND");
  return r;
}
function closure(s: Snapshot, ids: string[]) {
  const result = new Set(ids);
  let count = -1;
  while (count !== result.size) {
    count = result.size;
    for (const d of s.dependencies) if (result.has(d.ancestorId)) result.add(d.recordId);
  }
  return result;
}
function validateRefs(s: Snapshot, c: Content) {
  for (const id of references(c)) {
    const target = find(s, id);
    if (target.confirmation !== "confirmed") throw new IntelligenceError("PROVENANCE");
  }
}
export function consolidation(s: Snapshot, candidate: RecordNode) {
  const active = eligibleRecords(s),
    c = candidate.content;
  const duplicates = active
    .filter(
      (r) =>
        r.id !== candidate.id &&
        r.kind !== "outcome" &&
        r.kind === candidate.kind &&
        normalize(recordText(r)) === normalize(recordText(candidate)),
    )
    .map((r) => r.id);
  const conflicts =
    c?.kind === "fact"
      ? active
          .filter(
            (r) =>
              r.id !== candidate.id &&
              r.content?.kind === "fact" &&
              r.content.factType === c.factType &&
              r.content.key === c.key &&
              r.content.subjectId === c.subjectId &&
              normalize(r.content.value ?? r.content.text) !== normalize(c.value ?? c.text),
          )
          .map((r) => r.id)
      : [];
  return { duplicates, conflicts };
}
function capture(
  s: Snapshot,
  text: string,
  label: string,
  candidates: Candidate[],
  privacy: "private" | "restricted",
  origin: "user" | "feedback" = "user",
) {
  const sourceId = crypto.randomUUID();
  const source = node(
    s,
    {
      kind: "source",
      text,
      label,
      origin,
      legacyId: null,
      legacyKind: null,
      legacyFingerprint: null,
    },
    sourceId,
    sourceId,
    "",
    restricted(text) ? "restricted" : privacy,
  );
  const records = [source];
  const dependencies: Dependency[] = [];
  for (const candidate of candidates) {
    validateContent(candidate.content);
    validateRefs(s, candidate.content);
    if (!text.includes(candidate.quote)) throw new IntelligenceError("PROVENANCE");
    const r = node(s, candidate.content, sourceId, undefined, candidate.quote, source.privacy);
    records.push(r);
    if (origin === "feedback" && candidate.content.kind === "procedure")
      dependencies.push(
        ...references(candidate.content).map((ancestorId) => ({ recordId: sourceId, ancestorId })),
      );
    dependencies.push(
      { recordId: r.id, ancestorId: sourceId },
      ...references(candidate.content).map((ancestorId) => ({ recordId: r.id, ancestorId })),
    );
  }
  return { records, dependencies };
}

export async function mutateIntelligence(user: Identity, input: unknown, db?: D1Database) {
  authorize(user, "intelligence.write", user?.userId);
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new IntelligenceError("INVALID");
  const command = parsed.data;
  const s = await readSnapshot(user, db);
  if (command.epoch !== s.epoch) throw new IntelligenceError("CONFLICT");
  let upsert: RecordNode[] = [],
    dependencies: Dependency[] = [],
    legacy: Snapshot["legacy"] | undefined;
  let issues: string[] = [];
  if (command.action === "capture" || command.action === "propose") {
    let candidates: Candidate[];
    if (command.action === "capture")
      candidates =
        command.extraction === undefined
          ? extractCandidates(command.text, eligibleRecords(s))
          : validateExtraction(command.extraction, command.text);
    else {
      const c = command.content;
      if (
        ["source", "revision"].includes(c.kind) ||
        (c.kind === "procedure" && c.status !== "candidate") ||
        (c.kind === "commitment" && c.status !== "proposed")
      )
        throw new IntelligenceError("DENIED");
      if (
        c.kind === "outcome" &&
        s.records.some((r) => r.content?.kind === "outcome" && r.content.runId === c.runId)
      )
        throw new IntelligenceError("CONFLICT");
      candidates = [{ content: c, quote: command.quote, issues: [] }];
    }
    if (!candidates.length) throw new IntelligenceError("INVALID");
    const captured = capture(
      s,
      command.text,
      command.label,
      candidates,
      command.privacy,
      command.action === "propose" && command.content.kind === "outcome" ? "feedback" : "user",
    );
    upsert = captured.records;
    dependencies = captured.dependencies;
    issues = candidates.flatMap((c) => c.issues);
  } else if (command.action === "confirm") {
    const r = find(s, command.id);
    if (r.kind === "source" || r.kind === "revision" || r.confirmation === "confirmed")
      throw new IntelligenceError("INVALID");
    const { duplicates, conflicts } = consolidation(s, r);
    if (duplicates.length) throw new IntelligenceError("CONFLICT");
    if ([...new Set(command.supersedes)].sort().join() !== conflicts.sort().join())
      throw new IntelligenceError("CONFLICT");
    validateRefs(s, r.content!);
    const source = find(s, r.sourceId);
    if (source.content?.kind !== "source" || !source.content.text.includes(r.quote))
      throw new IntelligenceError("PROVENANCE");
    const content = structuredClone(r.content!);
    if (content.kind === "commitment") {
      content.status = "confirmed";
      for (const [field, name, type] of [
        ["personId", content.personName, "person"],
        ["projectId", content.projectName, "project"],
      ] as const) {
        if (!content[field] && name) {
          const matches = eligibleRecords(s).filter(
            (x) =>
              x.content?.kind === "entity" &&
              x.content.entityType === type &&
              [x.content.name, ...x.content.aliases].some((v) => normalize(v) === normalize(name)),
          );
          if (matches.length === 1) content[field] = matches[0].id;
        }
      }
    }
    upsert = [
      changed(source, { confirmation: "confirmed" }),
      changed(r, { confirmation: "confirmed", content }),
    ];
    dependencies.push(...references(content).map((ancestorId) => ({ recordId: r.id, ancestorId })));
    if (conflicts.length) {
      const invalid = closure(s, conflicts);
      for (const old of s.records)
        if (invalid.has(old.id))
          upsert.push(
            changed(old, {
              validity: conflicts.includes(old.id) ? "superseded" : "invalid",
              validTo: new Date().toISOString(),
            }),
          );
      const rev = node(
        s,
        {
          kind: "revision",
          previousIds: conflicts,
          nextId: r.id,
          reason: "User approved fact supersession",
        },
        source.id,
        undefined,
        r.quote,
        r.privacy,
      );
      rev.confirmation = "confirmed";
      upsert.push(rev);
      dependencies.push(
        { recordId: rev.id, ancestorId: source.id },
        { recordId: rev.id, ancestorId: r.id },
      );
    }
  } else if (command.action === "transition") {
    const r = find(s, command.id);
    if (r.confirmation !== "confirmed" || r.content?.kind !== "commitment")
      throw new IntelligenceError("DENIED");
    const c = structuredClone(r.content);
    if (
      !["confirmed", "active"].includes(c.status) ||
      (command.status === "active" && c.status !== "confirmed")
    )
      throw new IntelligenceError("INVALID");
    if (command.status === "completed") {
      if (!command.completionEvidenceId) throw new IntelligenceError("PROVENANCE");
      const evidence = find(s, command.completionEvidenceId);
      if (
        evidence.confirmation !== "confirmed" ||
        evidence.content?.kind !== "outcome" ||
        !evidence.content.success
      )
        throw new IntelligenceError("PROVENANCE");
      c.completionEvidenceId = evidence.id;
      dependencies.push({ recordId: r.id, ancestorId: evidence.id });
    }
    c.status = command.status;
    if (command.nextAction !== undefined) c.nextAction = command.nextAction;
    upsert = [changed(r, { content: c })];
  } else if (command.action === "activate") {
    const r = find(s, command.id);
    if (
      r.confirmation !== "confirmed" ||
      r.content?.kind !== "procedure" ||
      r.content.status !== "candidate" ||
      !eligibleRecords(s).some((e) => e.id === r.id)
    )
      throw new IntelligenceError("DENIED");
    upsert = [changed(r, { content: { ...r.content, status: "active" } })];
  } else if (command.action === "forget") {
    const r = s.records.find((x) => x.id === command.id && x.validity !== "deleted");
    if (!r) throw new IntelligenceError("NOT_FOUND");
    const source = s.records.find((x) => x.id === r.sourceId);
    if (!source) throw new IntelligenceError("PROVENANCE");
    const affected = closure(s, [
      source.id,
      ...s.records.filter((x) => x.sourceId === source.id).map((x) => x.id),
    ]);
    upsert = s.records
      .filter((x) => affected.has(x.id))
      .map((x) =>
        changed(x, {
          content: null,
          quote: "",
          validity: "deleted",
          validTo: new Date().toISOString(),
        }),
      );
    if (source.content?.kind === "source" && source.content.origin === "legacy") {
      legacy = structuredClone(s.legacy);
      const { legacyId, legacyKind } = source.content;
      if (legacyKind === "memory")
        legacy.memories = legacy.memories.filter((m) => m.id !== legacyId);
      if (legacyKind === "document")
        legacy.documents = legacy.documents.filter((d) => d.id !== legacyId);
      if (legacyKind === "task") legacy.tasks = legacy.tasks.filter((t) => t.id !== legacyId);
    }
  } else if (command.action === "learn") {
    const outcomes = eligibleRecords(s).filter(
      (r) =>
        r.content?.kind === "outcome" &&
        r.content.success &&
        r.content.workflowKey === command.workflowKey,
    );
    const groups = new Map<string, RecordNode[]>();
    for (const r of outcomes) {
      const c = r.content as Extract<Content, { kind: "outcome" }>;
      const key = JSON.stringify(c.steps.map(normalize));
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const repeated = [...groups.values()].find(
      (group) =>
        new Set(group.map((r) => (r.content as Extract<Content, { kind: "outcome" }>).runId))
          .size >= 3,
    );
    if (!repeated) throw new IntelligenceError("PROVENANCE");
    if (
      s.records.some(
        (r) =>
          r.validity === "valid" &&
          r.content?.kind === "procedure" &&
          r.content.workflowKey === command.workflowKey,
      )
    )
      throw new IntelligenceError("CONFLICT");
    const sample = repeated[0].content as Extract<Content, { kind: "outcome" }>;
    const steps = sample.steps;
    const text = `Procedure: ${command.workflowKey} | ${steps.join(" > ")}`;
    const captured = capture(
      s,
      text,
      "Confirmed workflow feedback",
      [
        {
          content: {
            kind: "procedure",
            title: command.workflowKey,
            workflowKey: command.workflowKey,
            steps,
            basisIds: repeated.slice(0, 20).map((r) => r.id),
            status: "candidate",
          },
          quote: text,
          issues: [],
        },
      ],
      "private",
      "feedback",
    );
    upsert = captured.records;
    dependencies = captured.dependencies;
  } else if (command.action === "importLegacy") {
    const item = (
      command.kind === "memory"
        ? s.legacy.memories
        : command.kind === "document"
          ? s.legacy.documents
          : s.legacy.tasks
    ).find((r) => r.id === command.id);
    if (!item) throw new IntelligenceError("NOT_FOUND");
    if (
      s.records.some(
        (r) =>
          r.validity === "valid" && r.content?.kind === "source" && r.content.legacyId === item.id,
      )
    )
      throw new IntelligenceError("CONFLICT");
    const text = "text" in item ? item.text : item.title;
    if (text.length > 16000) throw new IntelligenceError("LIMIT");
    const candidates = extractCandidates(text, eligibleRecords(s));
    if (!candidates.length && text.length > 2000) throw new IntelligenceError("LIMIT");
    if (!candidates.length)
      candidates.push({
        content: {
          kind: "fact",
          factType: "context",
          text,
          key: `legacy:${item.id}`,
          subjectId: null,
          value: null,
          rationale: null,
        },
        quote: text.slice(0, 2000),
        issues: [],
      });
    const captured = capture(s, text, `Imported ${command.kind}`, candidates, "private");
    upsert = captured.records;
    dependencies = captured.dependencies;
    const source = upsert[0];
    source.content = {
      ...(source.content as Extract<Content, { kind: "source" }>),
      origin: "legacy",
      legacyId: item.id,
      legacyKind: command.kind,
      legacyFingerprint: null,
    };
    // Explicit import still proposes records; prior unconfirmed suggestions never become truth.
  }
  await commitMutation(user, s, { upsert, dependencies, legacy }, db);
  return {
    snapshot: await readSnapshot(user, db),
    ids: upsert.filter((r) => !s.records.some((x) => x.id === r.id)).map((r) => r.id),
    issues,
  };
}

export async function searchIntelligence(user: Identity, query: unknown, db?: D1Database) {
  return retrieveContext(await readSnapshot(user, db), query);
}
export function followUpDraft(record: RecordNode) {
  const c = record.content;
  if (c?.kind !== "commitment" || !["confirmed", "active"].includes(c.status))
    throw new IntelligenceError("INVALID");
  return {
    text: `${c.personName ? `Hi ${c.personName}, ` : ""}following up on: ${c.text}${c.nextAction ? ` Next step: ${c.nextAction}` : ""}`,
    sent: false as const,
  };
}

export function compatibleState(s: Snapshot) {
  const state = structuredClone(s.legacy);
  // Legacy evidence remains available while its import is only proposed. Once
  // reviewed, suppress lines covered by graph proposals so stale originals cannot
  // override corrections; preserve unrelated legacy passages verbatim.
  const residual = (item: { id: string; text: string }) => {
    const sources = s.records.filter(
      (r) =>
        r.confirmation === "confirmed" &&
        r.content?.kind === "source" &&
        r.content.origin === "legacy" &&
        r.content.legacyId === item.id,
    );
    const quotes = s.records
      .filter(
        (r) =>
          sources.some((source) => source.id === r.sourceId) &&
          r.kind !== "source" &&
          r.kind !== "revision" &&
          r.quote,
      )
      .map((r) => r.quote);
    return item.text
      .split("\n")
      .filter(
        (line) => !quotes.some((quote) => quote.includes(line.trim()) || line.includes(quote)),
      )
      .join("\n")
      .trim();
  };
  state.memories = state.memories
    .filter((m) => !restricted(m.text))
    .map((m) => ({ ...m, text: residual(m) }))
    .filter((m) => m.text);
  state.documents = state.documents
    .filter((d) => !restricted(d.text))
    .map((d) => ({ ...d, text: residual(d) }))
    .filter((d) => d.text);
  const sourceById = new Map(s.records.map((r) => [r.id, r]));
  for (const r of eligibleRecords(s))
    if (r.content?.kind === "fact")
      state.memories.push({
        id: r.id,
        text: recordText(r),
        category: r.content.factType,
        source:
          sourceById.get(r.sourceId)?.content?.kind === "source"
            ? (sourceById.get(r.sourceId)!.content as Extract<Content, { kind: "source" }>).label
            : "Confirmed evidence",
        status: "confirmed",
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
  return state;
}
