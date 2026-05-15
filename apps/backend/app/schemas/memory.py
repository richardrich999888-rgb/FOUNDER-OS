from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MemorySearchResponseItem(BaseModel):
    id: UUID
    source_reflection_id: UUID | None
    content: str
    similarity: float
    created_at: datetime


class MemorySearchResponse(BaseModel):
    query: str = Field(exclude=True)
    items: list[MemorySearchResponseItem]
