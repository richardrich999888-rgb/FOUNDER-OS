import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";

export class SecurityError extends Error {
  constructor(public readonly code: "AUTH" | "AUTH_CONFIG" | "DENIED") {
    super(code);
  }
}

export type AuthEnvironment = {
  TWIN_AUTH_PROVIDER?: string;
  TWIN_AUTH_ISSUER?: string;
  TWIN_AUTH_AUDIENCE?: string;
  TWIN_AUTH_ACCOUNT_LINKS?: string;
};

// Only deployment configuration may choose the issuer and audience. Never use
// unverified claims, request URLs, jku, x5u, or a client-selected JWKS endpoint.
export function createTokenVerifier(env: AuthEnvironment, transport?: typeof fetch) {
  const issuer = env.TWIN_AUTH_ISSUER;
  const audience = env.TWIN_AUTH_AUDIENCE;
  if (
    env.TWIN_AUTH_PROVIDER !== "cloudflare-access" ||
    !issuer ||
    !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer) ||
    !audience ||
    !/^[a-f0-9]{64}$/.test(audience)
  ) {
    throw new SecurityError("AUTH_CONFIG");
  }
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 300_000,
    ...(transport ? { [customFetch]: transport } : {}),
  });
  return async (token: string | null) => {
    if (
      !token ||
      token.length > 16_384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    ) {
      throw new SecurityError("AUTH");
    }
    try {
      const { payload, protectedHeader } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        algorithms: ["RS256"],
        typ: "JWT",
        clockTolerance: 0,
        requiredClaims: ["iss", "aud", "sub", "exp", "iat", "nbf", "type"],
      });
      const now = Math.floor(Date.now() / 1000);
      if (
        payload.type !== "app" ||
        typeof payload.sub !== "string" ||
        !payload.sub.trim() ||
        payload.sub.length > 512 ||
        /[\u0000-\u001f]/.test(payload.sub) ||
        typeof payload.iat !== "number" ||
        !Number.isFinite(payload.iat) ||
        payload.iat > now ||
        typeof payload.exp !== "number" ||
        !Number.isFinite(payload.exp) ||
        payload.exp <= payload.iat ||
        typeof protectedHeader.kid !== "string" ||
        !protectedHeader.kid ||
        protectedHeader.jku ||
        protectedHeader.x5u ||
        protectedHeader.jwk
      ) {
        throw new SecurityError("AUTH");
      }
      // Deliberately discard email, name, roles, permissions and custom claims.
      return Object.freeze({ issuer, subject: payload.sub, expiresAt: payload.exp * 1000 });
    } catch {
      // Never expose JOSE diagnostics, claims, headers, or credentials to logs.
      throw new SecurityError("AUTH");
    }
  };
}
