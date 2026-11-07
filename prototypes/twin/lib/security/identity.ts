import { createTokenVerifier, SecurityError, type AuthEnvironment } from "./verify-token";
import { audit } from "./audit";

declare const verified: unique symbol;
export type Identity = Readonly<{
  userId: string;
  expiresAt: number;
  [verified]: true;
}>;
const issued = new WeakSet<object>();

export function isVerifiedIdentity(value: unknown): value is Identity {
  return (
    typeof value === "object" &&
    value !== null &&
    issued.has(value) &&
    (value as Identity).expiresAt > Date.now()
  );
}

function accountLinks(raw: string | undefined): ReadonlyMap<string, string> {
  const links = new Map<string, string>();
  if (!raw) return links;
  try {
    if (raw.length > 100_000) throw new Error();
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > 1000) throw new Error();
    const owners = new Set<string>();
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.subject !== "string" ||
        !entry.subject.trim() ||
        entry.subject.length > 512 ||
        typeof entry.accountId !== "string" ||
        !entry.accountId.trim() ||
        entry.accountId.length > 512 ||
        /[\u0000-\u001f]/.test(entry.subject + entry.accountId) ||
        entry.accountId.startsWith("cf-access:") ||
        links.has(entry.subject) ||
        owners.has(entry.accountId)
      )
        throw new Error();
      links.set(entry.subject, entry.accountId);
      owners.add(entry.accountId);
    }
    return links;
  } catch {
    throw new SecurityError("AUTH_CONFIG");
  }
}

// Factory dependencies are server-only. There is no route to configure this
// factory, mint principals, or create account links from a request/LLM output.
export function createIdentityAdapter(env: AuthEnvironment, transport?: typeof fetch) {
  const verify = createTokenVerifier(env, transport);
  const links = accountLinks(env.TWIN_AUTH_ACCOUNT_LINKS);
  return async (headers: Pick<Headers, "get">): Promise<Identity> => {
    try {
      const claims = await verify(headers.get("Cf-Access-Jwt-Assertion"));
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify([claims.issuer, claims.subject])),
      );
      const key = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
      const principal = Object.freeze({
        userId: links.get(claims.subject) ?? `cf-access:${key}`,
        expiresAt: claims.expiresAt,
      }) as Identity;
      issued.add(principal);
      audit("authenticate", true);
      return principal;
    } catch (error) {
      audit("authenticate", false);
      throw error;
    }
  };
}
