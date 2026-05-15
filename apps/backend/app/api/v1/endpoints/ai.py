from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.weekly_insight import (
    AiOutputQualityTagCreate,
    WeeklyInsightCreate,
    WeeklyInsightRead,
)
from app.services.analytics.service import create_ai_output_quality_tag
from app.services.auth.clerk import verify_clerk_jwt
from app.services.users.repository import get_or_create_user_from_clerk
from app.services.weekly_insights.service import create_weekly_insight

router = APIRouter()


@router.post("/weekly-insight", response_model=WeeklyInsightRead)
async def create_weekly_insight_endpoint(
    payload: WeeklyInsightCreate,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> WeeklyInsightRead:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    return await create_weekly_insight(
        session=session,
        user_id=user.id,
        week_start=payload.week_start,
        max_reflections=payload.max_reflections,
    )


@router.post("/quality-tags", status_code=204)
async def tag_ai_output_quality(
    payload: AiOutputQualityTagCreate,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> None:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    await create_ai_output_quality_tag(session, user.id, payload)
