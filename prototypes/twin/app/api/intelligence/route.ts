import { z } from "zod";
import { identity, json, fail } from "@/lib/twin/server";
import { assertOrigin } from "@/lib/twin/core";
import { eligibleRecords } from "@/lib/intelligence/retrieval";
import { readSnapshot } from "@/lib/intelligence/store";
import {
  mutateIntelligence,
  searchIntelligence,
  consolidation,
  followUpDraft,
} from "@/lib/intelligence/service";
import { IntelligenceError } from "@/lib/intelligence/model";
export const dynamic = "force-dynamic";
function errorResponse(error: unknown) {
  if (error instanceof IntelligenceError)
    return json(
      {
        error: {
          INVALID: "Please review the fields and evidence.",
          CONFLICT:
            "Your memory changed, duplicates an existing record, or needs explicit conflict review. Refresh and review.",
          NOT_FOUND: "Record or account not found.",
          LIMIT: "This private alpha storage limit has been reached.",
          PROVENANCE: "Confirmed supporting evidence is required.",
          DENIED: "This operation is not permitted.",
          UNAVAILABLE: "Memory storage is unavailable. No result was returned.",
        }[error.code],
      },
      {
        INVALID: 400,
        CONFLICT: 409,
        NOT_FOUND: 404,
        LIMIT: 413,
        PROVENANCE: 422,
        DENIED: 403,
        UNAVAILABLE: 503,
      }[error.code],
    );
  if (error instanceof z.ZodError) return json({ error: "Invalid query." }, 400);
  return fail(error);
}
export async function GET() {
  try {
    const user = await identity(),
      s = await readSnapshot(user);
    return json({
      epoch: s.epoch,
      records: s.records.map((r) => ({
        ...r,
        owner: undefined,
        generation: undefined,
        consolidation: r.confirmation === "proposed" ? consolidation(s, r) : undefined,
      })),
      runtimeIntegration: "blocked-p0-002-review",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers.get("origin"), request.url);
    const user = await identity();
    const raw = await request.text();
    if (raw.length > 70000) return json({ error: "Input is too large." }, 413);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new IntelligenceError("INVALID");
    }
    const envelope = z.object({ action: z.string() }).passthrough().parse(input);
    if (envelope.action === "search") {
      const parsed = z
        .object({ action: z.literal("search"), query: z.unknown() })
        .strict()
        .parse(input);
      return json(await searchIntelligence(user, parsed.query));
    }
    if (envelope.action === "draft") {
      const parsed = z
        .object({ action: z.literal("draft"), id: z.string().uuid() })
        .strict()
        .parse(input);
      const s = await readSnapshot(user),
        r = eligibleRecords(s).find((r) => r.id === parsed.id);
      if (!r) throw new IntelligenceError("NOT_FOUND");
      return json(followUpDraft(r));
    }
    const result = await mutateIntelligence(user, input);
    return json({ epoch: result.snapshot.epoch, ids: result.ids, issues: result.issues });
  } catch (error) {
    return errorResponse(error);
  }
}
