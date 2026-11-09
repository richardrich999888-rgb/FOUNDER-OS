import { eligibleRecords } from "../intelligence/retrieval";
import { recordText, validInstant, type Snapshot } from "../intelligence/model";
import type { Workflow } from "./model";
export type PriorityOverride = { source_ref: string; priority: number; project_importance: number };
export type Priority = {
  sourceRef: string;
  title: string;
  deadline: string | null;
  priority: number;
  projectImportance: number;
  state: string;
  blocked: boolean;
  score: number;
  reasons: { text: string; sourceRef: string }[];
};
export function priorities(
  s: Snapshot,
  workflows: Workflow[],
  overrides: PriorityOverride[],
  now = Date.now(),
) {
  const records = eligibleRecords(s, now);
  const overrideMap = new Map(overrides.map((o) => [o.source_ref, o]));
  const items: Priority[] = [];
  const add = (
    sourceRef: string,
    title: string,
    deadline: string | null,
    state: string,
    priority = 1,
    projectImportance = 0,
    blocked = false,
  ) => {
    const override = overrideMap.get(sourceRef);
    priority = override?.priority ?? priority;
    projectImportance = override?.project_importance ?? projectImportance;
    const reasons = [
      { text: `Your priority: ${priority} of 3.`, sourceRef },
      { text: `Your project importance: ${projectImportance} of 3.`, sourceRef },
      { text: `Current status: ${state.toLowerCase().replaceAll("_", " ")}.`, sourceRef },
    ];
    let urgency = 0;
    if (deadline && validInstant(deadline)) {
      const left = Date.parse(deadline) - now;
      urgency = left < 0 ? 60 : left <= 86400000 ? 50 : left <= 7 * 86400000 ? 25 : 5;
      reasons.push({ text: `Confirmed deadline: ${deadline}.`, sourceRef });
    } else deadline = null;
    if (blocked)
      reasons.push({
        text: "Waiting for a dependency to complete; its evidence is checked before approval.",
        sourceRef,
      });
    items.push({
      sourceRef,
      title,
      deadline,
      state,
      priority,
      projectImportance,
      blocked,
      score: priority * 100 + projectImportance * 20 + urgency - (blocked ? 1000 : 0),
      reasons,
    });
  };
  for (const r of records)
    if (r.content?.kind === "commitment" && ["confirmed", "active"].includes(r.content.status))
      add(`intelligence:${r.id}`, r.content.text, r.content.deadline, r.content.status);
  for (const t of s.legacy.tasks)
    if (t.status === "open") add(`task:${t.id}`, t.title, t.due, "open");
  for (const w of workflows)
    if (!["COMPLETED", "CANCELLED"].includes(w.state)) {
      let deps: string[];
      try {
        deps = JSON.parse(w.dependencies);
      } catch {
        deps = ["invalid"];
      }
      add(
        `workflow:${w.id}`,
        w.intent,
        new Date(w.deadline_at).toISOString(),
        w.state,
        w.priority,
        w.project_importance,
        deps.some(
          (id) => !workflows.some((other) => other.id === id && other.state === "COMPLETED"),
        ),
      );
    }
  items.sort(
    (a, b) =>
      b.score - a.score ||
      (a.deadline ?? "~").localeCompare(b.deadline ?? "~") ||
      a.sourceRef.localeCompare(b.sourceRef),
  );
  const context = records
    .filter(
      (r) =>
        (r.content?.kind === "entity" && r.content.entityType === "project") ||
        (r.content?.kind === "fact" && ["goal", "preference"].includes(r.content.factType)),
    )
    .map((r) => ({
      sourceRef: `intelligence:${r.id}`,
      kind: r.content!.kind,
      title: recordText(r),
    }));
  return { items, context, ranking: "explicit-priority-v1", asOf: new Date(now).toISOString() };
}
