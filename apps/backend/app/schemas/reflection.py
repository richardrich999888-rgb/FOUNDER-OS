from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReflectionCreate(BaseModel):
    body: str = Field(min_length=1, max_length=12000)
    mood: str | None = Field(default=None, max_length=64)
    source: str = Field(default="text", max_length=32)


class ReflectionRead(BaseModel):
    id: UUID
    body: str
    mood: str | None
    source: str
    created_at: datetime


class ReflectionList(BaseModel):
    items: list[ReflectionRead]
