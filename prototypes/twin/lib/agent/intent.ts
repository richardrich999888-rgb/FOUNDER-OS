/**
 * Deterministic personal-reference detection.
 *
 * Returns true when a message refers to the signed-in user's own facts, plans or statements
 * (possessive first person, first-person questions, "remember", "about me"). Used by the runtime
 * to ENFORCE a memory lookup before the model may answer. It is a heuristic:
 *  - a false negative leaves tool selection to the model (previous behaviour);
 *  - a false positive costs one extra read-only, receipted search, and if nothing is found the
 *    request ends in the runtime abstention (e.g. "Draft an email to my investor" with no
 *    investor memories). That trade-off is deliberate: abstaining beats an unverified answer.
 * Bare "me"/"I" in imperatives ("Help me write…") is intentionally NOT a trigger.
 */
const PERSONAL_REFERENCE =
  /\b(my|mine|myself)\b|\b(am|do|did|have|was|should|can|could|will|would)\s+i\b|\bi\s+(am|have|had|was|want|need|prefer|like|said|told|mentioned|remember|planned|plan)\b|\bremember\b|\babout me\b/i;

export function requiresPersonalLookup(message: string): boolean {
  return PERSONAL_REFERENCE.test(message);
}
