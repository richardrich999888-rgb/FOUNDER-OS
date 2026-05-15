from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_memory import AiMemory
from app.models.reflection import Reflection
from app.models.user import User
from app.schemas.reflection import ReflectionCreate, ReflectionRead
from app.services.ai.openai_client import embed_text
from app.services.security.encryption import decrypt_text, encrypt_text


async def create_reflection(
    session: AsyncSession,
    user: User,
    payload: ReflectionCreate,
) -> ReflectionRead:
    encrypted_body = encrypt_text(payload.body)
    reflection = Reflection(
        user_id=user.id,
        body_encrypted=encrypted_body,
        mood=payload.mood,
        source=payload.source,
    )
    session.add(reflection)
    await session.flush()

    embedding = await embed_text(payload.body)
    memory = AiMemory(
        user_id=user.id,
        source_reflection_id=reflection.id,
        content_encrypted=encrypted_body,
        embedding=embedding,
    )
    session.add(memory)
    await session.commit()
    await session.refresh(reflection)

    return _to_read_model(reflection)


async def list_reflections(
    session: AsyncSession,
    user_id: UUID,
    limit: int = 50,
) -> list[ReflectionRead]:
    result = await session.execute(
        select(Reflection)
        .where(Reflection.user_id == user_id)
        .order_by(desc(Reflection.created_at))
        .limit(limit)
    )
    return [_to_read_model(reflection) for reflection in result.scalars()]


def _to_read_model(reflection: Reflection) -> ReflectionRead:
    return ReflectionRead(
        id=reflection.id,
        body=decrypt_text(reflection.body_encrypted),
        mood=reflection.mood,
        source=reflection.source,
        created_at=reflection.created_at,
    )
