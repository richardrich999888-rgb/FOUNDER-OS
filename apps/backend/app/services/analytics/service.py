from hashlib import sha256
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_output_quality_tag import AiOutputQualityTag
from app.models.analytics_event import AnalyticsEvent
from app.models.reflection_feedback import ReflectionFeedback
from app.models.retrieval_evaluation import RetrievalEvaluation
from app.schemas.analytics import AnalyticsEventCreate, AnalyticsEventRead, RetentionSummary
from app.schemas.memory import RetrievalEvaluationCreate
from app.schemas.reflection import ReflectionFeedbackCreate
from app.schemas.weekly_insight import AiOutputQualityTagCreate
from app.services.security.encryption import encrypt_text


async def track_event(
    session: AsyncSession,
    user_id: UUID | None,
    payload: AnalyticsEventCreate,
) -> AnalyticsEventRead:
    event = AnalyticsEvent(
        user_id=user_id,
        event_name=payload.event_name,
        platform=payload.platform,
        properties=payload.properties,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return AnalyticsEventRead(
        id=event.id,
        event_name=event.event_name,
        platform=event.platform,
        properties=event.properties,
        created_at=event.created_at,
    )


async def create_reflection_feedback(
    session: AsyncSession,
    user_id: UUID,
    reflection_id: UUID,
    payload: ReflectionFeedbackCreate,
) -> None:
    feedback = ReflectionFeedback(
        user_id=user_id,
        reflection_id=reflection_id,
        usefulness=payload.usefulness,
        felt_generic=payload.felt_generic,
        felt_invasive=payload.felt_invasive,
        note_encrypted=encrypt_text(payload.note) if payload.note else None,
    )
    session.add(feedback)
    await session.commit()


async def create_retrieval_evaluation(
    session: AsyncSession,
    user_id: UUID,
    payload: RetrievalEvaluationCreate,
) -> None:
    evaluation = RetrievalEvaluation(
        user_id=user_id,
        query_hash=_hash_query(payload.query),
        result_count=payload.result_count,
        top_memory_ids=payload.top_memory_ids,
        user_rating=payload.user_rating,
    )
    session.add(evaluation)
    await session.commit()


async def create_ai_output_quality_tag(
    session: AsyncSession,
    user_id: UUID,
    payload: AiOutputQualityTagCreate,
) -> None:
    tag = AiOutputQualityTag(
        user_id=user_id,
        output_type=payload.output_type,
        output_id=payload.output_id,
        rating=payload.rating,
        tags=payload.tags,
    )
    session.add(tag)
    await session.commit()


async def get_retention_summary(session: AsyncSession, user_id: UUID) -> RetentionSummary:
    event_names = [
        "reflection_created",
        "memory_search_used",
        "weekly_insight_opened",
        "weekly_insight_rated",
    ]
    result = await session.execute(
        select(AnalyticsEvent.event_name, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.user_id == user_id)
        .where(AnalyticsEvent.event_name.in_(event_names))
        .group_by(AnalyticsEvent.event_name)
    )
    counts = dict(result.all())
    return RetentionSummary(
        reflection_created=counts.get("reflection_created", 0),
        memory_search_used=counts.get("memory_search_used", 0),
        weekly_insight_opened=counts.get("weekly_insight_opened", 0),
        weekly_insight_rated=counts.get("weekly_insight_rated", 0),
    )


def _hash_query(query: str) -> str:
    return sha256(query.strip().lower().encode("utf-8")).hexdigest()
