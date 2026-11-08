import { z } from "zod";
import { identity, json, fail } from "@/lib/twin/server";
import { assertOrigin } from "@/lib/twin/core";
import { intelligenceDb } from "@/lib/intelligence/store";
import { runLocalIntelligence } from "@/lib/agent/local-run";
import { AgentError } from "@/lib/agent/errors";
import { env } from "cloudflare:workers";
import { runModelIntelligence } from "@/lib/agent/model-run";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers.get("origin"), request.url);
    const user = await identity(),
      raw = await request.text();
    if (raw.length > 10000) return json({ error: "Input is too large." }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
    const result =
      typeof body === "object" && body !== null && "mode" in body && body.mode === "model"
        ? await runModelIntelligence(
            user,
            body,
            intelligenceDb(),
            env as unknown as Record<string, string | undefined>,
          )
        : await runLocalIntelligence(user, body, intelligenceDb());
    return json(result.body, result.status);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid tool or arguments." }, 400);
    if (error instanceof AgentError)
      return json({ error: "Current authorization is required." }, 403);
    return fail(error);
  }
}
