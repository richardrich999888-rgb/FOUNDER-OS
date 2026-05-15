from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

ALLOWED_EVENTS = {
    "onboarding_started",
    "onboarding_completed",
    "privacy_flow_viewed",
    "reflection_started",
    "reflection_created",
    "reflection_feedback_submitted",
    "memory_search_used",
    "memory_search_evaluated",
    "weekly_insight_opened",
    "weekly_insight_rated",
    "export_requested",
    "account_deletion_started",
}

BLOCKED_PROPERTY_KEYS = {
    "body",
    "content",
    "reflection",
    "transcript",
    "prompt",
    "response",
    "query",
    "raw_query",
    "search_query",
}


class AnalyticsEventCreate(BaseModel):
    event_name: str
    platform: str | None = Field(default=None, max_length=64)
    properties: dict = Field(default_factory=dict)

    @field_validator("event_name")
    @classmethod
    def event_must_be_allowed(cls, value: str) -> str:
        if value not in ALLOWED_EVENTS:
            raise ValueError("event_name is not in the Ballast alpha event taxonomy")
        return value

    @field_validator("properties")
    @classmethod
    def properties_must_be_privacy_safe(cls, value: dict) -> dict:
        for key in value:
            if key.lower() in BLOCKED_PROPERTY_KEYS:
                raise ValueError(f"analytics property '{key}' may contain private content")
        return value


class AnalyticsEventRead(BaseModel):
    id: UUID
    event_name: str
    platform: str | None
    properties: dict
    created_at: datetime


class RetentionSummary(BaseModel):
    reflection_created: int
    memory_search_used: int
    weekly_insight_opened: int
    weekly_insight_rated: int
