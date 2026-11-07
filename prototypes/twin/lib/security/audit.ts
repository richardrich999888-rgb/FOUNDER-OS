const actions = new Set([
  "authenticate",
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
  "memory.list",
  "memory.read",
  "memory.search",
]);

// A closed schema: no arbitrary details object, principal IDs, URLs or content.
// These are authorization decisions, not claims that an operation completed.
export function audit(action: string, allowed: boolean) {
  const record = Object.freeze({
    event: "twin.authorization",
    decisionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action: actions.has(action) ? action : "unknown",
    outcome: allowed === true ? "allow" : "deny",
  });
  console.info(JSON.stringify(record));
}
