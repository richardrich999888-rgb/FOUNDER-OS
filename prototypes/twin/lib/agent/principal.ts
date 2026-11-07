/**
 * Verified principal port.
 *
 * The agent runtime never accepts a user identifier from the model, the request body or
 * retrieved content. Identity enters ONLY through `createVerifiedPrincipal`, which the
 * composition root calls with the identity produced by the platform authentication boundary
 * (`getChatGPTUser()` — Sites edge-injected headers). When P0-001 lands, only the caller of
 * this function changes.
 */
export type Scope = 'memory:read';

declare const principalBrand: unique symbol;

export type VerifiedPrincipal = Readonly<{
  userId: string;
  authMethod: 'platform-session';
  /** Frozen array: a frozen Set would still permit .add(). */
  scopes: readonly Scope[];
  readonly [principalBrand]: true;
}>;

/** Identity as asserted by the authentication boundary. */
export type AuthenticatedIdentity = Readonly<{ userId: string }>;

/** Server-side grants derived from persisted account state (never from the model). */
export type AccountGrants = Readonly<{ aiContextConsent: boolean }>;

const USER_ID_PATTERN = /^[A-Za-z0-9._:@|-]{1,256}$/;

/**
 * Mint a principal. Fails closed on a malformed identifier. Scopes are deny-by-default:
 * `memory:read` is granted only when the user has consented to AI context sharing,
 * because the tool's output is forwarded to the model provider.
 */
export function createVerifiedPrincipal(identity: AuthenticatedIdentity, grants: AccountGrants): VerifiedPrincipal {
  if (typeof identity.userId !== 'string' || !USER_ID_PATTERN.test(identity.userId)) {
    throw new Error('AUTH');
  }
  const scopes: Scope[] = [];
  if (grants.aiContextConsent === true) scopes.push('memory:read');
  return Object.freeze({
    userId: identity.userId,
    authMethod: 'platform-session',
    scopes: Object.freeze(scopes),
  }) as VerifiedPrincipal;
}

/** True only for an explicit grant of `scope`. */
export function hasScope(principal: VerifiedPrincipal, scope: Scope): boolean {
  return principal.scopes.includes(scope);
}
