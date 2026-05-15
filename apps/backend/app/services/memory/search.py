from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_memory import AiMemory
from app.schemas.memory import MemorySearchResponseItem
from app.services.ai.openai_client import embed_text
from app.services.security.encryption import decrypt_text


async def search_memories(
    session: AsyncSession,
    user_id: UUID,
    query: str,
    limit: int = 8,
) -> list[MemorySearchResponseItem]:
    embedding = await embed_text(query)
    distance = AiMemory.embedding.cosine_distance(embedding)
    result = await session.execute(
        select(AiMemory, distance.label("distance"))
        .where(AiMemory.user_id == user_id)
        .order_by(distance)
        .limit(limit)
    )

    items: list[MemorySearchResponseItem] = []
    for memory, raw_distance in result.all():
        distance_value = float(raw_distance or 0)
        items.append(
            MemorySearchResponseItem(
                id=memory.id,
                source_reflection_id=memory.source_reflection_id,
                content=decrypt_text(memory.content_encrypted),
                similarity=max(0.0, 1.0 - distance_value),
                created_at=memory.created_at,
            )
        )

    return items
