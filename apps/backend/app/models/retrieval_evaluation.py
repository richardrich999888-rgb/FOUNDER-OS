from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RetrievalEvaluation(Base):
    __tablename__ = "retrieval_evaluations"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    query_hash: Mapped[str] = mapped_column(String(128), index=True)
    result_count: Mapped[int] = mapped_column(Integer)
    top_memory_ids: Mapped[list[UUID]] = mapped_column(ARRAY(PgUUID(as_uuid=True)), default=list)
    user_rating: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
