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
    created_at: datetime
