from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WeeklyInsightCreate(BaseModel):
    week_start: date | None = None
    max_reflections: int = Field(default=25, ge=3, le=100)


class WeeklyInsightRead(BaseModel):
    id: UUID
    week_start: date
    summary: str
    themes: list[str]
    source_reflection_ids: list[UUID]
    created_at: datetime


class AiOutputQualityTagCreate(BaseModel):
    output_type: str = Field(max_length=64)
    output_id: UUID | None = None
    rating: str = Field(pattern="^(useful|somewhat|not_useful)$")
    tags: list[str] = Field(default_factory=list, max_length=8)
