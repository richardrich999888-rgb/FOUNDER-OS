from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReflectionFeedback(Base):
    __tablename__ = "reflection_feedback"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reflection_id: Mapped[UUID] = mapped_column(
        ForeignKey("reflections.id", ondelete="CASCADE"), index=True
    )
    usefulness: Mapped[str] = mapped_column(String(32))
    felt_generic: Mapped[str | None] = mapped_column(String(32), nullable=True)
    felt_invasive: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
