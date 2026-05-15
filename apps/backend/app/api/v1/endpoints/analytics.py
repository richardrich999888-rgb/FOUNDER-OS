from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.analytics import AnalyticsEventCreate, AnalyticsEventRead, RetentionSummary
from app.services.analytics.service import get_retention_summary, track_event
from app.services.auth.clerk import verify_clerk_jwt
from app.services.users.repository import get_or_create_user_from_clerk

router = APIRouter()


@router.post("/events", response_model=AnalyticsEventRead)
async def create_analytics_event(
    payload: AnalyticsEventCreate,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> AnalyticsEventRead:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    return await track_event(session, user.id, payload)


@router.get("/retention-summary", response_model=RetentionSummary)
async def retention_summary(
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> RetentionSummary:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    return await get_retention_summary(session, user.id)
