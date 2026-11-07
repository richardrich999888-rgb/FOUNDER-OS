import { authorize } from "./authorize";
import { isVerifiedIdentity, type Identity } from "./identity";
import { SecurityError } from "./verify-token";
import { audit } from "./audit";
import type { State } from "../twin/core";

export type MemoryTool = "memory.list" | "memory.read" | "memory.search";
const readTools = new Set<string>(["memory.list", "memory.read", "memory.search"]);
declare const grantBrand: unique symbol;
export type ToolGrant = Readonly<{ [grantBrand]: true }>;
const grants = new WeakMap<
  object,
  { principal: Identity; tools: ReadonlySet<string>; expiresAt: number }
>();

// Trusted application policy calls this after an explicit user-authorized
// workflow. It is not exposed over HTTP or registered as an agent tool.
export function grantMemoryTools(principal: Identity, tools: readonly MemoryTool[]): ToolGrant {
  authorize(principal, "tools.delegate", principal?.userId);
  if (!tools.length || tools.some((tool) => !readTools.has(tool))) {
    audit("tools.delegate", false);
    throw new SecurityError("DENIED");
  }
  const grant = Object.freeze({}) as ToolGrant;
  grants.set(grant, {
    principal,
    tools: new Set(tools),
    expiresAt: Math.min(principal.expiresAt, Date.now() + 60_000),
  });
  return grant;
}

// All input is data. Neither arguments nor document text can select an owner,
// modify a grant, or cause a write/external action. Grants cannot be serialized.
export async function runMemoryTool(
  grant: ToolGrant,
  tool: string,
  args: unknown,
  load: (principal: Identity) => Promise<{ state: State } | null>,
) {
  const permission = typeof grant === "object" && grant !== null ? grants.get(grant) : undefined;
  const allowed =
    !!permission &&
    isVerifiedIdentity(permission.principal) &&
    permission.expiresAt > Date.now() &&
    readTools.has(tool) &&
    permission.tools.has(tool);
  if (!allowed || !permission || !args || typeof args !== "object" || Array.isArray(args)) {
    audit(tool, false);
    throw new SecurityError("DENIED");
  }
  const input = args as Record<string, unknown>;
  const key = tool === "memory.read" ? "id" : tool === "memory.search" ? "query" : null;
  if (
    Object.keys(input).some((k) => k !== key) ||
    (key &&
      (typeof input[key] !== "string" ||
        !(input[key] as string).trim() ||
        (input[key] as string).length > 500))
  ) {
    audit(tool, false);
    throw new SecurityError("DENIED");
  }
  audit(tool, true);
  const account = await load(permission.principal);
  // Recheck across awaits before disclosing any result.
  if (!isVerifiedIdentity(permission.principal) || permission.expiresAt <= Date.now()) {
    audit(tool, false);
    throw new SecurityError("DENIED");
  }
  const memories = (account?.state.memories ?? []).filter((m) => m.status === "confirmed");
  const selected =
    tool === "memory.read"
      ? memories.filter((m) => m.id === input.id)
      : tool === "memory.search"
        ? memories.filter((m) =>
            m.text.toLowerCase().includes((input.query as string).toLowerCase()),
          )
        : memories;
  return structuredClone(selected.slice(0, 50));
}
