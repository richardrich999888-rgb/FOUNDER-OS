import { requestIdentity } from "@/lib/security/request-identity";
import { SecurityError } from "@/lib/security/verify-token";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/";
const SIGN_OUT_PATH = "/cdn-cgi/access/logout";
const CALLBACK_PATH = "/callback";

// Compatibility helper for template callers. Plain Sites headers are no longer
// an authentication source; only the configured verified adapter can mint IDs.
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  try {
    const identity = await requestIdentity();
    return { userId: identity.userId, displayName: "Twin user", email: "", fullName: null };
  } catch (error) {
    if (error instanceof SecurityError && error.code === "AUTH") return null;
    throw error;
  }
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return safeReturnTo;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return pathname === SIGN_IN_PATH || pathname === SIGN_OUT_PATH || pathname === CALLBACK_PATH;
}
