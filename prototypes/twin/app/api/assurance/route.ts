import { env } from "cloudflare:workers";
import { z } from "zod";
import { identity, json, fail } from "@/lib/twin/server";
import { assertOrigin } from "@/lib/twin/core";
import { intelligenceDb } from "@/lib/intelligence/store";
import { AssuranceError } from "@/lib/assurance/model";
import { assuranceView, command } from "@/lib/assurance/service";
import { withDiagnostics } from "@/lib/assurance/telemetry";
export const dynamic = "force-dynamic";
function failure(e: unknown) {
  if (e instanceof z.ZodError) return json({ error: "Invalid workflow or arguments." }, 400);
  if (e instanceof AssuranceError)
    return json(
      {
        error: "This workflow could not safely proceed. Refresh and review its current status.",
        code: e.code,
      },
      {
        INVALID: 400,
        NOT_FOUND: 404,
        CONFLICT: 409,
        DENIED: 403,
        UNAVAILABLE: 503,
        EXPIRED: 409,
        LIMIT: 429,
        CHECKPOINT_INVALID: 409,
      }[e.code],
    );
  return fail(e);
}
export async function GET(request: Request) {
  return withDiagnostics(
    request,
    env as unknown as Record<string, string | undefined>,
    async () => {
      try {
        return json(await assuranceView(await identity(), intelligenceDb()));
      } catch (e) {
        return failure(e);
      }
    },
  );
}
export async function POST(request: Request) {
  return withDiagnostics(
    request,
    env as unknown as Record<string, string | undefined>,
    async () => {
      try {
        assertOrigin(request.headers.get("origin"), request.url);
        const user = await identity(),
          raw = await request.text();
        if (raw.length > 12_000) return json({ error: "Input is too large." }, 413);
        let input: unknown;
        try {
          input = JSON.parse(raw);
        } catch {
          return json({ error: "Invalid request." }, 400);
        }
        return json(
          await command(
            user,
            input,
            intelligenceDb(),
            env as unknown as Record<string, string | undefined>,
            request.signal,
          ),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );
}
