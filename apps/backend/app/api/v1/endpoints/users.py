from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auth.clerk import verify_clerk_jwt
from app.services.users.repository import get_or_create_user_from_clerk

router = APIRouter()


@router.get("/me")
async def get_current_user(payload: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"id": payload.get("sub")}


@router.delete("/me", status_code=204)
async def delete_current_user(
    payload: dict = Depends(verify_clerk_jwt),
    session: AsyncSession = Depends(get_db),
) -> None:
    user = await get_or_create_user_from_clerk(session, payload)
    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()
