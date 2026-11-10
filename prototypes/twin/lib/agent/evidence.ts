/**
 * Evidence ledger and citation verification.
 *
 * The runtime — not the model — assigns citation keys (E1, E2, ...) to evidence returned by
 * tools. The final answer may only cite keys present in the ledger. Sources returned to the
 * client are always taken from the ledger, never from model text, so a model cannot fabricate
 * a source or a tool result that the client will display as evidence.
 */
import type { EvidenceItem } from "./tool-registry";

export type CitedEvidence = EvidenceItem & Readonly<{ citation: string }>;

export type EvidenceLedger = Readonly<{
  /** Add items, deduplicated by sourceId. Returns the cited form of each input item. */
  add(items: readonly EvidenceItem[]): CitedEvidence[];
  all(): readonly CitedEvidence[];
  get(citation: string): CitedEvidence | undefined;
}>;

/** Maximum evidence items the ledger accepts per run (5 executions x 5 results). */
export const MAX_LEDGER_ITEMS = 25;

export function createEvidenceLedger(): EvidenceLedger {
  const bySource = new Map<string, CitedEvidence>();
  const byCitation = new Map<string, CitedEvidence>();
  return Object.freeze({
    add(items: readonly EvidenceItem[]): CitedEvidence[] {
      const out: CitedEvidence[] = [];
      for (const item of items) {
        const existing = bySource.get(item.sourceId);
        if (existing) {
          out.push(existing);
          continue;
        }
        if (bySource.size >= MAX_LEDGER_ITEMS) break;
        const cited: CitedEvidence = Object.freeze({ ...item, citation: `E${bySource.size + 1}` });
        bySource.set(item.sourceId, cited);
        byCitation.set(cited.citation, cited);
        out.push(cited);
      }
      return out;
    },
    all: () => [...bySource.values()],
    get: (citation: string) => byCitation.get(citation),
  });
}

/** Bracket group grammar shared by extraction and neutralization (single source of truth). */
const BRACKET_GROUP = /\[([^\[\]\n]{1,80})\]/g;
const CITATION_TOKEN = /^E\d{1,4}$/;
const isCitationGroup = (inner: string) =>
  inner.split(/[\s,;]+/).some((t) => CITATION_TOKEN.test(t));

/**
 * Neutralize citation syntax inside UNTRUSTED content before it is shown to the model, so a
 * stored document cannot smuggle "[E1]" (spoofing a valid citation) or "[E9]" (forcing a
 * grounding rejection) into a model answer that quotes it. Exactly the groups that
 * extractCitations would count are rewritten from "[...]" to "(...)".
 */
export function neutralizeCitationSyntax(text: string): string {
  return text.replace(BRACKET_GROUP, (whole, inner: string) =>
    isCitationGroup(inner) ? `(${inner})` : whole,
  );
}

/**
 * Extract citation claims. Accepts "[E1]", "[E1, E2]", "[E1][E3]". Any token of the form
 * E<digits> inside square brackets counts as a claim, so "[E99]" is detected even when it
 * is not in the ledger.
 */
export function extractCitations(text: string): string[] {
  const claims: string[] = [];
  for (const match of text.matchAll(BRACKET_GROUP)) {
    for (const token of match[1].split(/[\s,;]+/)) {
      if (CITATION_TOKEN.test(token)) claims.push(token);
    }
  }
  return [...new Set(claims)];
}

export type GroundingCheck =
  | Readonly<{ kind: "cited"; cited: readonly CitedEvidence[] }>
  | Readonly<{ kind: "fabricated" }>
  | Readonly<{ kind: "uncited" }>;

/** Verify citations against the ledger. One unknown key invalidates the whole answer. */
export function verifyCitations(text: string, ledger: EvidenceLedger): GroundingCheck {
  const claims = extractCitations(text);
  const cited: CitedEvidence[] = [];
  for (const claim of claims) {
    const item = ledger.get(claim);
    if (!item) return { kind: "fabricated" };
    cited.push(item);
  }
  return cited.length ? { kind: "cited", cited } : { kind: "uncited" };
}

// A conservative literal check, NOT an entailment model. Keep dates/times, signs,
// decimal/group separators, currencies and common magnitude suffixes together:
// the separate digits in 2026-12-01 must not license 2026-01-12 or INR 20 million.
const CURRENCY = "USD|INR|EUR|GBP|JPY|AUD|CAD|CHF|CNY|SGD|AED";
const MAGNITUDE = "thousand|million|billion|trillion|lakh|crore|percent|bps|kg|mg|km|cm|mm|ml|k|m|b";
const NUMERIC_LITERAL = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(?:[+\-−]\s*)?(?:(?:${CURRENCY})\s*|[$€£₹¥]\s*)?(?:[+\-−]\s*)?\p{Nd}+(?:[.,:/Tt+\-]\p{Nd}+)*(?:[eE][+\-]?\p{Nd}+)?(?:\s*(?:${MAGNITUDE}|${CURRENCY})(?![\p{L}\p{N}_])|\s*[%‰]|[zZ](?![\p{L}\p{N}_]))?`,
  "giu",
);

function numericLiterals(text: string): string[] {
  // Normalize display variants, not values: no arithmetic, unit/currency conversion,
  // rounding, locale-dependent comma interpretation or inference from timestamps.
  const normalized = text.normalize("NFKC").replace(/\p{Cf}/gu, "");
  return [...normalized.matchAll(NUMERIC_LITERAL)].map((match) =>
    match[0].replace(/\s+/gu, "").replace(/−/g, "-").toLowerCase(),
  );
}

/**
 * Reject novel numeric literals in model prose even when its citation IDs are real.
 * Only cited excerpts can support a value — not labels, metadata, the question or
 * uncited retrieved material. A match does NOT prove the number's relation, units
 * outside the recognized grammar, spelled-out quantities or nonnumeric claims.
 * Unsupported representations safely use the existing evidence-only fallback.
 */
export function hasSupportedNumericLiterals(text: string, cited: readonly CitedEvidence[]): boolean {
  // Remove only citation tokens, not the rest of a mixed bracket group. In
  // "[E1, INR 900]", INR 900 remains a claim requiring evidence.
  const prose = text.replace(BRACKET_GROUP, (whole, inner: string) =>
    `[${inner.split(/([\s,;]+)/).map((token) => CITATION_TOKEN.test(token) ? " " : token).join("")}]`,
  );
  const supported = new Set(cited.flatMap((item) => numericLiterals(item.excerpt)));
  return numericLiterals(prose).every((literal) => supported.has(literal));
}
