from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.analytics import AnalyticsEventCreate
from app.schemas.memory import MemorySearchResponse, RetrievalEvaluationCreate
from app.services.analytics.service import create_retrieval_evaluation, track_event
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
    await track_event(
        session,
        user.id,
        AnalyticsEventCreate(
            event_name="memory_search_used",
            platform="api",
            properties={"result_count": len(items)},
        ),
    )
    return MemorySearchResponse(query=q, items=items)


@router.post("/evaluate", status_code=204)
async def evaluate_retrieval(
    payload: RetrievalEvaluationCreate,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> None:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    await create_retrieval_evaluation(session, user.id, payload)
