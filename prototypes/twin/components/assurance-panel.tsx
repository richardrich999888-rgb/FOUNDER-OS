"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, RefreshCw, ArrowRight, CircleAlert } from "lucide-react";
type Workflow = {
  id: string;
  intent: string;
  understood: string;
  state: string;
  version: number;
  reason: string;
  attempts: number;
  permissions: string[];
  completionScope: string;
  mayRequestResume: boolean;
  sourceRefs: string[];
  dependencies: string[];
  plan: { mode: string; tool?: string; args?: unknown; message?: string } | null;
};
type Priority = {
  sourceRef: string;
  title: string;
  deadline: string | null;
  priority: number;
  projectImportance: number;
  state: string;
  blocked: boolean;
  reasons: { text: string; sourceRef: string }[];
};
type View = {
  workflows: Workflow[];
  priorities: { items: Priority[]; context: { sourceRef: string; title: string; kind: string }[] };
};
type Evidence = {
  conclusion: string;
  reason: string;
  receiptCount: number;
  scope: string;
  events: { version: number; new_state: string; actor: string; reason: string }[];
};
const human = (s: string) => s.toLowerCase().replaceAll("_", " ");
async function loadView() {
  const r = await fetch("/api/assurance", { cache: "no-store" });
  const d = (await r.json()) as View & { error?: string };
  if (!r.ok) throw new Error(d.error || "Could not load your activity.");
  return d;
}
export default function AssurancePanel() {
  const [data, setData] = useState<View | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState("");
  const [intent, setIntent] = useState(""),
    [query, setQuery] = useState(""),
    [source, setSource] = useState(""),
    [dependency, setDependency] = useState(""),
    [evidence, setEvidence] = useState<Record<string, Evidence>>({}),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const key = useRef<string | null>(null),
    expiry = useRef(0);
  const refresh = useCallback(async () => {
    const d = await loadView();
    setData(d);
    return d;
  }, []);
  useEffect(() => {
    let live = true;
    loadView()
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function submit(body: Record<string, unknown>) {
    const r = await fetch("/api/assurance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json()) as {
      error?: string;
      workflow: Workflow;
      evidence?: Evidence;
      result?: { text?: string };
    };
    if (!r.ok) throw new Error(d.error || "Could not update this workflow.");
    return d;
  }
  async function act(w: Workflow, action: string) {
    setError("");
    setNotice("");
    setPending(w.id);
    try {
      // Read the latest version before cancellation, including while another request is running.
      if (action === "cancel") {
        const view = await refresh();
        w = view.workflows.find((x) => x.id === w.id) ?? w;
      }
      const r = await submit({ action, id: w.id, version: w.version });
      if (r.evidence) {
        const checked = r.evidence;
        setEvidence((e) => ({ ...e, [w.id]: checked }));
      }
      if (
        r.workflow?.state === "COMPLETED" &&
        r.evidence?.conclusion === "VERIFIED" &&
        r.result?.text
      ) {
        const answer = r.result.text;
        setAnswers((a) => ({ ...a, [w.id]: answer }));
      }
      setNotice(
        action === "execute"
          ? r.workflow.state === "COMPLETED"
            ? "Saved context was checked. No message was sent."
            : "This run needs attention. Review its current status."
          : action === "resume"
            ? "Review and approve again before another attempt."
            : "Workflow updated.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
      await refresh().catch(() => {});
    } finally {
      setPending("");
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending("new");
    try {
      if (!key.current) {
        key.current = crypto.randomUUID();
        expiry.current = Date.now() + 86400000;
      }
      await submit({
        action: "propose",
        idempotencyKey: key.current,
        intent,
        plan: { mode: "local", tool: "search_personal_memory", args: { query } },
        sourceRefs: source ? [source] : [],
        dependencies: dependency ? [dependency] : [],
        deadlineAt: expiry.current,
      });
      key.current = null;
      setIntent("");
      setQuery("");
      setNotice("Saved as a proposal. Review it before approving access.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setPending("");
    }
  }
  async function rank(
    item: Priority,
    priority: number,
    projectImportance = item.projectImportance,
  ) {
    setError("");
    try {
      await submit({ action: "priority", sourceRef: item.sourceRef, priority, projectImportance });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save priority.");
    }
  }
  return (
    <section className="assurance-panel" aria-label="Personal trust center">
      <div className="assurance-heading">
        <div>
          <span className="eyebrow">YOUR TRUST CENTER</span>
          <h2>Know where things stand.</h2>
          <p>Review your priorities, approve a context check, and pick up unfinished work.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => refresh().catch((e) => setError(e.message))}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="assurance-notice">
          {notice}
        </p>
      )}
      <div className="assurance-columns">
        <section>
          <h3>Today’s priorities</h3>
          {!data?.priorities.items.length && (
            <p className="subtle-foot">
              Confirmed commitments, open tasks and proposed work appear here.
            </p>
          )}
          <ol className="assurance-priorities">
            {data?.priorities.items.map((item) => (
              <li key={item.sourceRef}>
                <strong>{item.title}</strong>
                {item.blocked && <span className="assurance-status">Waiting on a dependency</span>}
                <details>
                  <summary>Why this priority?</summary>
                  {item.reasons.map((r, i) => (
                    <p key={i}>{r.text}</p>
                  ))}
                  <small>Source: {item.sourceRef}</small>
                </details>
                <label>
                  My priority{" "}
                  <select
                    aria-label={`Priority for ${item.title}`}
                    value={item.priority}
                    onChange={(e) => rank(item, Number(e.target.value))}
                  >
                    {["Low", "Normal", "High", "Highest"].map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Project importance{" "}
                  <select
                    aria-label={`Project importance for ${item.title}`}
                    value={item.projectImportance}
                    onChange={(e) => rank(item, item.priority, Number(e.target.value))}
                  >
                    {["None", "Normal", "High", "Highest"].map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ol>
          {!!data?.priorities.context.length && (
            <details>
              <summary>Goals, projects and preferences used</summary>
              {data.priorities.context.map((c) => (
                <p key={c.sourceRef}>{c.title}</p>
              ))}
            </details>
          )}
        </section>
        <section>
          <h3>Prepare your next step</h3>
          <p className="subtle-foot">
            This saves a plan to search your context. You review it before it runs.
          </p>
          <form onSubmit={create} className="assurance-form">
            <label className="field-label">
              What are you working toward?
              <input
                required
                maxLength={500}
                placeholder="Prepare an investor follow-up"
                value={intent}
                onChange={(e) => {
                  setIntent(e.target.value);
                  key.current = null;
                }}
              />
            </label>
            <label className="field-label">
              What saved context should Twin find?
              <input
                required
                maxLength={500}
                placeholder="Investor meeting notes"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  key.current = null;
                }}
              />
            </label>
            <label className="field-label">
              Supporting context (optional)
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  key.current = null;
                }}
              >
                <option value="">None selected</option>
                {[...(data?.priorities.items ?? []), ...(data?.priorities.context ?? [])].map(
                  (i) => (
                    <option key={i.sourceRef} value={i.sourceRef}>
                      {i.title.slice(0, 90)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="field-label">
              Depends on (optional)
              <select
                value={dependency}
                onChange={(e) => {
                  setDependency(e.target.value);
                  key.current = null;
                }}
              >
                <option value="">No dependency</option>
                {data?.workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.intent.slice(0, 90)}
                  </option>
                ))}
              </select>
            </label>
            <p className="subtle-foot">
              This plan expires after 24 hours. Approval lasts up to 5 minutes and is checked again
              when the run starts.
            </p>
            <button className="small-primary" disabled={pending === "new" || !data}>
              Save proposal <ArrowRight size={14} />
            </button>
          </form>
        </section>
      </div>
      <section className="assurance-workflows">
        <h3>Work in progress & history</h3>
        {!data?.workflows.length && (
          <p className="subtle-foot">Your first proposal will appear here.</p>
        )}
        {data?.workflows.map((w) => (
          <article key={w.id} className="assurance-workflow">
            <div className="assurance-workflow-title">
              <h4>{w.intent}</h4>
              <span className={`assurance-status status-${w.state.toLowerCase()}`}>
                {human(w.state)}
              </span>
            </div>
            <p>{w.understood}</p>
            <p className="subtle-foot">{w.completionScope}</p>
            {["UNKNOWN", "FAILED"].includes(w.state) && (
              <p className="assurance-attention">
                <CircleAlert size={15} />
                Needs attention: {human(w.reason)}. Completion has not been verified.
              </p>
            )}
            <details>
              <summary>Review understanding and permissions</summary>
              <p>
                {w.plan?.mode === "model"
                  ? w.plan.message
                  : `Search: ${(w.plan?.args as { query?: string })?.query ?? "Selected read operation"}`}
              </p>
              <ul>
                {w.permissions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {w.sourceRefs.length > 0 && <p>Supporting references: {w.sourceRefs.join(", ")}</p>}
              <p>Attempt {w.attempts} of at most 3. A new attempt requires your approval.</p>
            </details>
            <div className="assurance-actions">
              {w.state === "PROPOSED" && (
                <button
                  className="small-primary"
                  disabled={!!pending}
                  onClick={() => act(w, "review")}
                >
                  Review proposal
                </button>
              )}
              {w.state === "AWAITING_APPROVAL" && (
                <button
                  className="small-primary"
                  disabled={!!pending}
                  onClick={() => act(w, "approve")}
                >
                  Approve this context check
                </button>
              )}
              {w.state === "AUTHORIZED" && (
                <button
                  className="small-primary"
                  disabled={!!pending}
                  onClick={() => act(w, "execute")}
                >
                  Run approved check
                </button>
              )}
              {w.mayRequestResume && (
                <button
                  className="secondary-button"
                  disabled={!!pending}
                  onClick={() => act(w, "resume")}
                >
                  Review for resume
                </button>
              )}
              {!["COMPLETED", "CANCELLED"].includes(w.state) && (
                <button className="text-button" onClick={() => act(w, "cancel")}>
                  Cancel
                </button>
              )}
              <button
                className="text-button"
                disabled={!!pending}
                onClick={() => act(w, "reconcile")}
              >
                <ShieldCheck size={14} />
                Check evidence
              </button>
            </div>
            {answers[w.id] && (
              <div className="assurance-evidence">
                <strong>Saved context found</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{answers[w.id]}</p>
              </div>
            )}
            {evidence[w.id] && (
              <div className="assurance-evidence">
                <strong>{human(evidence[w.id].conclusion)}</strong>
                <p>
                  {human(evidence[w.id].reason)} · {evidence[w.id].receiptCount} execution records.
                </p>
                <details>
                  <summary>Execution history</summary>
                  <ol>
                    {evidence[w.id].events.map((e) => (
                      <li key={e.version}>
                        {human(e.new_state)} · {e.actor} · {human(e.reason)}
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            )}
          </article>
        ))}
      </section>
      <p className="subtle-foot">
        Verification checks this app’s execution records. It does not certify that an outside action
        happened or that a model’s words are true.
      </p>
    </section>
  );
}
