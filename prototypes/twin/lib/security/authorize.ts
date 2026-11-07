import { isVerifiedIdentity, type Identity } from "./identity";
import { SecurityError } from "./verify-token";
import { audit } from "./audit";

const ownerActions = new Set([
  "account.read",
  "initialize",
  "memory.add",
  "memory.update",
  "memory.confirm",
  "memory.delete",
  "task.add",
  "task.toggle",
  "task.delete",
  "document.add",
  "document.delete",
  "profile.update",
  "erase",
  "chat.memory",
  "chat.ai",
  "tools.delegate",
]);

export function authorize(principal: Identity, action: string, ownerId: string): void {
  const allowed =
    isVerifiedIdentity(principal) && principal.userId === ownerId && ownerActions.has(action);
  audit(action, allowed);
  if (!allowed) throw new SecurityError("DENIED");
}
