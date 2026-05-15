from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.reflection import (
    ReflectionCreate,
    ReflectionFeedbackCreate,
    ReflectionList,
    ReflectionRead,
)
from app.services.analytics.service import create_reflection_feedback
from app.services.auth.clerk import verify_clerk_jwt
from app.services.reflections.service import create_reflection, list_reflections
from app.services.users.repository import get_or_create_user_from_clerk

router = APIRouter()


@router.post("", response_model=ReflectionRead)
async def create_reflection_endpoint(
    payload: ReflectionCreate,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> ReflectionRead:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    return await create_reflection(session, user, payload)


@router.get("", response_model=ReflectionList)
async def list_reflections_endpoint(
    limit: int = 50,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> ReflectionList:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    items = await list_reflections(session, user.id, limit=min(limit, 100))
    return ReflectionList(items=items)


@router.post("/{reflection_id}/feedback", status_code=204)
async def submit_reflection_feedback(
    reflection_id: UUID,
    payload: ReflectionFeedbackCreate,
    auth_payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> None:
    user = await get_or_create_user_from_clerk(session, auth_payload)
    await create_reflection_feedback(session, user.id, reflection_id, payload)
