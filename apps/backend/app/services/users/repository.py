from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_or_create_user_from_clerk(session: AsyncSession, payload: dict) -> User:
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise ValueError("Clerk payload missing subject")

    result = await session.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    email = payload.get("email")
    user = User(clerk_user_id=clerk_user_id, email=email)
    session.add(user)
    await session.flush()
    return user
