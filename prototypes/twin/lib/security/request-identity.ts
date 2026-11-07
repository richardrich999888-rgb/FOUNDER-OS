import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { createIdentityAdapter } from "./identity";
import { type AuthEnvironment, SecurityError } from "./verify-token";
import { audit } from "./audit";

let cached: { key: string; adapter: ReturnType<typeof createIdentityAdapter> } | undefined;

export async function requestIdentity() {
  const vars = env as AuthEnvironment;
  const config = {
    TWIN_AUTH_PROVIDER: vars.TWIN_AUTH_PROVIDER,
    TWIN_AUTH_ISSUER: vars.TWIN_AUTH_ISSUER,
    TWIN_AUTH_AUDIENCE: vars.TWIN_AUTH_AUDIENCE,
    TWIN_AUTH_ACCOUNT_LINKS: vars.TWIN_AUTH_ACCOUNT_LINKS,
  };
  const key = JSON.stringify(config);
  let adapter: ReturnType<typeof createIdentityAdapter>;
  try {
    if (!cached || cached.key !== key) cached = { key, adapter: createIdentityAdapter(config) };
    adapter = cached.adapter;
  } catch {
    audit("authenticate", false);
    throw new SecurityError("AUTH_CONFIG");
  }
  // Only verifier/JWKS configuration is shared; never cache a request identity.
  return adapter(await headers());
}
