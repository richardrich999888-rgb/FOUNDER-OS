"use client";
import { useEffect, useState } from "react";
import type { RecordNode } from "@/lib/intelligence/model";

type ReviewRecord = RecordNode & { consolidation?: { duplicates: string[]; conflicts: string[] } };
type Review = { epoch: number; records: ReviewRecord[] };
async function request<T = Review>(payload?: Record<string, unknown>) {
  const response = await fetch(
    "/api/intelligence",
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : { cache: "no-store" },
  );
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Could not load memory.");
  return data;
}
export default function IntelligencePanel({
  onChange,
  legacyItems,
}: {
  onChange: () => void;
  legacyItems: { id: string; kind: string; label: string }[];
}) {
  const [review, setReview] = useState<Review>({ epoch: 0, records: [] }),
    [text, setText] = useState(""),
    [label, setLabel] = useState("My note"),
    [query, setQuery] = useState(""),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [asFact, setAsFact] = useState(false),
    [privateOnly, setPrivateOnly] = useState(false);
  const [workflow, setWorkflow] = useState(""),
    [steps, setSteps] = useState(""),
    [feedback, setFeedback] = useState(""),
    [manualSteps, setManualSteps] = useState(5);
  async function refresh() {
    try {
      setReview(await request());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load memory.");
    }
  }
  useEffect(() => {
    let active = true;
    request()
      .then((data) => {
        if (active) setReview(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load memory.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ issues?: string[] }>({ ...payload, epoch: review.epoch });
      setAnswer("");
      onChange();
      await refresh();
      if (result.issues?.length)
        setError("Review needed: " + result.issues.join(", ").replaceAll("_", " "));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  const sourceLabel = (r: ReviewRecord) => {
    const c = review.records.find((x) => x.id === r.sourceId)?.content;
    return c?.kind === "source" ? c.label : "Evidence removed";
  };
  return (
    <section
      className="memory-intelligence"
      aria-label="Persistent intelligence"
      style={{
        marginTop: 32,
        padding: 24,
        border: "1px solid var(--border, #ddd)",
        borderRadius: 16,
      }}
    >
      <h2>Remember what matters.</h2>
      <p>
        Review new knowledge, track promises, and keep useful routines. Nothing sends messages or
        acts on your accounts.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <details>
        <summary>Bring existing notes into reviewed memory</summary>
        <p>
          Choose one existing note. Its original stays saved. Review extracted knowledge before it
          becomes current graph evidence.
        </p>
        <select
          aria-label="Existing note to review"
          value=""
          disabled={busy}
          onChange={(e) => {
            const item = legacyItems.find((x) => x.id === e.target.value);
            if (item) void run({ action: "importLegacy", kind: item.kind, id: item.id });
          }}
        >
          <option value="">Choose an existing note</option>
          {legacyItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.kind}: {item.label}
            </option>
          ))}
        </select>
      </details>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const payload = asFact
            ? {
                action: "propose",
                text,
                label,
                quote: text,
                content: {
                  kind: "fact",
                  factType: "context",
                  text,
                  key: "context:" + label,
                  subjectId: null,
                  value: null,
                  rationale: null,
                },
                privacy: privateOnly ? "restricted" : "private",
              }
            : { action: "capture", text, label, privacy: privateOnly ? "restricted" : "private" };
          if (await run(payload)) setText("");
        }}
      >
        <label className="field-label">
          Source name
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            maxLength={160}
          />
        </label>
        <label className="field-label">
          What should Twin remember?
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={asFact ? 2000 : 16000}
            rows={4}
            placeholder={"Person: Maya Rao\nProject: Cedar\nI prefer Monday meetings."}
          />
        </label>
        <label>
          <input type="checkbox" checked={asFact} onChange={(e) => setAsFact(e.target.checked)} />{" "}
          Propose this as a contextual fact
        </label>
        <br />
        <label>
          <input
            type="checkbox"
            checked={privateOnly}
            onChange={(e) => setPrivateOnly(e.target.checked)}
          />{" "}
          Keep out of assistant context
        </label>
        <p>
          <button className="small-primary" disabled={busy}>
            Prepare for review
          </button>
        </p>
        <details>
          <summary>Writing promises and preferences</summary>
          <p>Use one item per line. For example: “I now prefer Thursday meetings.”</p>
          <p>
            I will send the pitch deck to Maya Rao for Project Cedar by 2026-11-12T17:00:00+05:30
            [Asia/Kolkata]. Next: Review the deck.
          </p>
          <p>
            Relative dates remain unresolved. Confirm an exact timestamp and timezone before relying
            on a deadline.
          </p>
        </details>
      </form>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const r = await request<{ results: { text: string; sourceLabel: string }[] }>({
              action: "search",
              query: { query },
            });
            setAnswer(
              r.results.length
                ? r.results
                    .map(
                      (x: { text: string; sourceLabel: string }) =>
                        `${x.text}\nSource: ${x.sourceLabel}`,
                    )
                    .join("\n\n")
                : "No confirmed evidence found.",
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not search.");
          }
        }}
      >
        <label className="field-label">
          Ask your memory
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={500}
            placeholder="Which commitments are overdue?"
          />
        </label>
        <button className="text-button">Search confirmed knowledge</button>
      </form>
      {answer && <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p>}
      <div>
        {review.records
          .filter((r) => r.kind !== "source" && r.kind !== "revision" && r.validity !== "deleted")
          .map((r) => {
            const c = r.content;
            if (!c) return null;
            return (
              <article key={r.id} style={{ borderTop: "1px solid #ddd", padding: "16px 0" }}>
                <strong>
                  {c.kind === "entity"
                    ? c.name
                    : c.kind === "procedure"
                      ? c.title
                      : c.kind === "outcome"
                        ? c.feedback
                        : "text" in c
                          ? c.text
                          : c.kind}
                </strong>
                <p>
                  {r.confirmation} · {r.validity} · {r.kind} · Source: {sourceLabel(r)}
                  {r.privacy === "restricted" ? " · Excluded from assistant context" : ""}
                </p>
                <details>
                  <summary>Evidence</summary>
                  <p>{r.quote}</p>
                </details>
                {c.kind === "commitment" && (
                  <p>
                    {c.status} ·{" "}
                    {c.deadline ? `${c.deadline} (${c.timezone})` : "No resolved deadline"}
                    {c.nextAction ? ` · Next: ${c.nextAction}` : ""}
                  </p>
                )}
                {c.kind === "procedure" && (
                  <ol>
                    {c.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
                {r.validity === "valid" && r.confirmation === "proposed" && (
                  <>
                    <p>
                      {r.consolidation?.conflicts.length
                        ? "This conflicts with a current preference. Approval will supersede the earlier fact."
                        : ""}
                      {r.consolidation?.duplicates.length
                        ? "This duplicates a confirmed record."
                        : ""}
                    </p>
                    <button
                      className="small-primary"
                      disabled={busy || !!r.consolidation?.duplicates.length}
                      onClick={() =>
                        run({
                          action: "confirm",
                          id: r.id,
                          supersedes: r.consolidation?.conflicts ?? [],
                        })
                      }
                    >
                      {r.consolidation?.conflicts.length
                        ? "Approve replacement"
                        : "Confirm after review"}
                    </button>
                  </>
                )}
                {r.validity === "valid" &&
                  r.confirmation === "confirmed" &&
                  c.kind === "commitment" &&
                  c.status === "confirmed" && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => run({ action: "transition", id: r.id, status: "active" })}
                    >
                      Make active
                    </button>
                  )}
                {r.validity === "valid" &&
                  r.confirmation === "confirmed" &&
                  c.kind === "commitment" &&
                  ["confirmed", "active"].includes(c.status) && (
                    <>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            setAnswer(
                              (await request<{ text: string }>({ action: "draft", id: r.id }))
                                .text + "\n\nDraft only — not sent.",
                            );
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Could not draft.");
                          }
                        }}
                      >
                        Draft follow-up
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => run({ action: "transition", id: r.id, status: "cancelled" })}
                      >
                        Cancel commitment
                      </button>
                      <label className="field-label">
                        Complete with reviewed outcome
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value)
                              void run({
                                action: "transition",
                                id: r.id,
                                status: "completed",
                                completionEvidenceId: e.target.value,
                              });
                          }}
                        >
                          <option value="">Choose completion evidence</option>
                          {review.records
                            .filter(
                              (x) =>
                                x.validity === "valid" &&
                                x.confirmation === "confirmed" &&
                                x.content?.kind === "outcome" &&
                                x.content.success,
                            )
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.content?.kind === "outcome" ? x.content.feedback : ""}
                              </option>
                            ))}
                        </select>
                      </label>
                    </>
                  )}
                {r.validity === "valid" &&
                  r.confirmation === "confirmed" &&
                  c.kind === "procedure" &&
                  c.status === "candidate" && (
                    <button
                      className="small-primary"
                      disabled={busy}
                      onClick={() => run({ action: "activate", id: r.id })}
                    >
                      Approve reusable checklist
                    </button>
                  )}
                {r.validity === "valid" &&
                  r.confirmation === "confirmed" &&
                  c.kind === "procedure" &&
                  c.status === "active" && (
                    <button
                      className="text-button"
                      onClick={() =>
                        setAnswer(
                          `Checklist for review:\n${c.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n\nNo steps have been executed.`,
                        )
                      }
                    >
                      Use checklist
                    </button>
                  )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Forget this evidence and every record derived from it? This also removes the original legacy item if imported.",
                      )
                    )
                      void run({ action: "forget", id: r.id, confirmation: "FORGET EVIDENCE" });
                  }}
                >
                  Forget evidence and derived records
                </button>
              </article>
            );
          })}
      </div>
      <details>
        <summary>Learn from a completed workflow</summary>
        <p>
          Record your own observed outcome. Three reviewed successes with the same steps can propose
          a checklist. This does not verify an external action.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await run({
              action: "propose",
              text: feedback,
              label: "My workflow feedback",
              quote: feedback,
              privacy: "private",
              content: {
                kind: "outcome",
                workflowKey: workflow,
                runId: crypto.randomUUID(),
                steps: steps
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                manualSteps,
                success: true,
                feedback,
                verification: "user-attested",
              },
            });
          }}
        >
          <label className="field-label">
            Workflow name
            <input
              required
              value={workflow}
              maxLength={160}
              onChange={(e) => setWorkflow(e.target.value)}
            />
          </label>
          <label className="field-label">
            Successful steps, one per line
            <textarea required value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} />
          </label>
          <label className="field-label">
            Manual steps taken
            <input
              type="number"
              min={1}
              max={100}
              value={manualSteps}
              onChange={(e) => setManualSteps(Number(e.target.value))}
            />
          </label>
          <label className="field-label">
            What happened?
            <textarea
              required
              value={feedback}
              maxLength={2000}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>
          <button className="small-primary" disabled={busy}>
            Record outcome for review
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy || !workflow}
            onClick={() => run({ action: "learn", workflowKey: workflow })}
          >
            Propose a reusable checklist
          </button>
        </form>
      </details>
    </section>
  );
}
