from functools import lru_cache

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import settings
from app.core.errors import ApiError

security = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _jwks_cache_key() -> str:
    return str(settings.clerk_jwks_url or "")


async def _fetch_jwks() -> dict:
    if not settings.clerk_jwks_url:
        raise ApiError("auth_not_configured", "Clerk JWKS URL is not configured", 500)

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(str(settings.clerk_jwks_url))
        response.raise_for_status()
        return response.json()


async def verify_clerk_jwt(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None:
        raise ApiError("unauthorized", "Missing bearer token", 401)

    try:
        jwks = await _fetch_jwks()
        payload = jwt.decode(
            credentials.credentials,
            jwks,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer or None,
            options={"verify_aud": False},
        )
    except (JWTError, httpx.HTTPError) as exc:
        raise ApiError("unauthorized", "Invalid authentication token", 401) from exc

    request.state.user_id = payload.get("sub")
    return payload
