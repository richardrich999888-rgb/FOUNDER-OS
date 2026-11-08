import { isVerifiedIdentity, type Identity } from "../security/identity";
import { authorize } from "../security/authorize";
import { readSnapshot } from "../intelligence/store";
import { AgentError } from "./errors";
export type Scope = "memory:read";
declare const brand: unique symbol;
export type VerifiedPrincipal = Readonly<{
  userId: string;
  authMethod: "verified-jwt";
  scopes: readonly Scope[];
  [brand]: true;
}>;
type Binding = {
  identity: Identity;
  generation: string;
  epoch: number;
  destination: "local" | "provider";
  tools: ReadonlySet<string>;
};
const bindings = new WeakMap<object, Binding>();
export async function createVerifiedPrincipal(
  identity: Identity,
  tools: readonly string[],
  destination: "local" | "provider",
  db: D1Database,
): Promise<VerifiedPrincipal> {
  authorize(identity, "tools.delegate", identity?.userId);
  const snapshot = await readSnapshot(identity, db);
  if (destination === "provider" && !snapshot.legacy.aiConsent)
    throw new AgentError("AUTHORIZATION_REVOKED");
  const principal = Object.freeze({
    userId: identity.userId,
    authMethod: "verified-jwt",
    scopes: Object.freeze(["memory:read"]),
  }) as VerifiedPrincipal;
  bindings.set(principal, {
    identity,
    generation: snapshot.generation,
    epoch: snapshot.epoch,
    destination,
    tools: new Set(tools),
  });
  return principal;
}
export function isVerifiedPrincipal(p: unknown): p is VerifiedPrincipal {
  return (
    typeof p === "object" &&
    p !== null &&
    bindings.has(p) &&
    isVerifiedIdentity(bindings.get(p)!.identity)
  );
}
export function principalBinding(p: VerifiedPrincipal) {
  if (!isVerifiedPrincipal(p)) throw new AgentError("AUTHORIZATION_REVOKED");
  return bindings.get(p)!;
}
export function hasScope(p: VerifiedPrincipal, scope: Scope) {
  return isVerifiedPrincipal(p) && p.scopes.includes(scope);
}
export function permitsTool(p: VerifiedPrincipal, tool: string) {
  return isVerifiedPrincipal(p) && bindings.get(p)!.tools.has(tool);
}
export async function verifyCurrentPrincipal(p: VerifiedPrincipal, db: D1Database) {
  const binding = principalBinding(p);
  try {
    const s = await readSnapshot(binding.identity, db);
    if (
      s.generation !== binding.generation ||
      s.epoch !== binding.epoch ||
      (binding.destination === "provider" && !s.legacy.aiConsent)
    )
      throw new AgentError("AUTHORIZATION_REVOKED");
    return s;
  } catch {
    throw new AgentError("AUTHORIZATION_REVOKED");
  }
}
