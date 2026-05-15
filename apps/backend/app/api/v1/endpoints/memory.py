from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.memory import MemorySearchResponse
from app.services.auth.clerk import verify_clerk_jwt
from app.services.memory.search import search_memories
from app.services.users.repository import get_or_create_user_from_clerk

router = APIRouter()


@router.get("/search", response_model=MemorySearchResponse)
async def search_your_own_mind(
    q: str,
    limit: int = 8,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> MemorySearchResponse:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    items = await search_memories(session, user.id, q, limit=min(limit, 20))
    return MemorySearchResponse(query=q, items=items)
