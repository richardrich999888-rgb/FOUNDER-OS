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


class RetrievalEvaluationCreate(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    result_count: int = Field(ge=0, le=50)
    top_memory_ids: list[UUID] = Field(default_factory=list, max_length=10)
    user_rating: str | None = Field(default=None, pattern="^(found_it|close|missed)$")
