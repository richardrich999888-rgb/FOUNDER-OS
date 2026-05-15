from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reflection import Reflection
from app.models.weekly_insight import WeeklyInsight
from app.schemas.weekly_insight import WeeklyInsightRead
from app.services.ai.openai_client import synthesize_weekly_reflections
from app.services.security.encryption import decrypt_text, encrypt_text


async def create_weekly_insight(
    session: AsyncSession,
    user_id: UUID,
    week_start: date | None,
    max_reflections: int,
) -> WeeklyInsightRead:
    resolved_week_start = week_start or _current_week_start()
    result = await session.execute(
        select(Reflection)
        .where(Reflection.user_id == user_id)
        .order_by(desc(Reflection.created_at))
        .limit(max_reflections)
    )
    reflections = list(result.scalars())
    decrypted = [decrypt_text(reflection.body_encrypted) for reflection in reversed(reflections)]
    summary = await synthesize_weekly_reflections(decrypted)
    source_reflection_ids = [reflection.id for reflection in reflections]

    insight = WeeklyInsight(
        user_id=user_id,
        week_start=resolved_week_start,
        summary_encrypted=encrypt_text(summary),
        themes=[],
        source_reflection_ids=source_reflection_ids,
    )
    session.add(insight)
    await session.commit()
    await session.refresh(insight)

    return WeeklyInsightRead(
        id=insight.id,
        week_start=insight.week_start,
        summary=summary,
        themes=insight.themes,
        source_reflection_ids=insight.source_reflection_ids,
        created_at=insight.created_at,
    )


def _current_week_start() -> date:
    today = datetime.now(UTC).date()
    return today - timedelta(days=today.weekday())
