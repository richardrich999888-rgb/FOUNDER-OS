import { env } from "cloudflare:workers";
import { requestIdentity } from "@/lib/security/request-identity";
import { authorize } from "@/lib/security/authorize";
import type { Identity } from "@/lib/security/identity";
import { SecurityError } from "@/lib/security/verify-token";
import { accounts } from "@/db/schema";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import type { State } from "./core";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
export const identity = requestIdentity;
export async function load(user: Identity) {
  authorize(user, "account.read", user?.userId);
  const userId = user.userId;
  const [row] = await getDb().select().from(accounts).where(eq(accounts.userId, userId));
  return row ? { state: JSON.parse(row.state) as State, version: row.version, generation: row.generation } : null;
}
export function modelStatus() {
  const vars = env as unknown as Record<string, string | undefined>;
  return {
    configured: Boolean(vars.OPENAI_API_KEY && vars.OPENAI_MODEL),
    provider: "OpenAI",
    model: vars.OPENAI_MODEL || null,
  };
}
export function fail(error: unknown) {
  if (error instanceof SecurityError) {
    if (error.code === "AUTH_CONFIG")
      return json({ error: "Secure sign-in is not configured. Contact the app owner." }, 503);
    if (error.code === "AUTH")
      return json(
        {
          error:
            "Sign in through the configured authentication gateway to access your private twin.",
          signIn: "/",
        },
        401,
      );
    return json({ error: "This operation is not permitted." }, 403);
  }
  if (error instanceof Error && error.message === "ORIGIN")
    return json({ error: "This request must come from your Twin app." }, 403);
  return json({ error: "Your request could not be completed. Please try again." }, 500);
}
