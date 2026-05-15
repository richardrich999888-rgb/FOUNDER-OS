"""alpha feedback analytics

Revision ID: 0002_alpha_feedback_analytics
Revises: 0001_initial_schema
Create Date: 2026-05-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_alpha_feedback_analytics"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "weekly_insights",
        sa.Column(
            "source_reflection_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )

    op.create_table(
        "analytics_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_name", sa.String(length=128), nullable=False),
        sa.Column("platform", sa.String(length=64), nullable=True),
        sa.Column(
            "properties",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_event_name", "analytics_events", ["event_name"])

    op.create_table(
        "reflection_feedback",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reflection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reflections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("usefulness", sa.String(length=32), nullable=False),
        sa.Column("felt_generic", sa.String(length=32), nullable=True),
        sa.Column("felt_invasive", sa.String(length=32), nullable=True),
        sa.Column("note_encrypted", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_reflection_feedback_user_id", "reflection_feedback", ["user_id"])
    op.create_index(
        "ix_reflection_feedback_reflection_id",
        "reflection_feedback",
        ["reflection_id"],
    )

    op.create_table(
        "retrieval_evaluations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("query_hash", sa.String(length=128), nullable=False),
        sa.Column("result_count", sa.Integer(), nullable=False),
        sa.Column(
            "top_memory_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("user_rating", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_retrieval_evaluations_user_id", "retrieval_evaluations", ["user_id"])
    op.create_index("ix_retrieval_evaluations_query_hash", "retrieval_evaluations", ["query_hash"])

    op.create_table(
        "ai_output_quality_tags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("output_type", sa.String(length=64), nullable=False),
        sa.Column("output_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rating", sa.String(length=32), nullable=False),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ai_output_quality_tags_user_id", "ai_output_quality_tags", ["user_id"])


def downgrade() -> None:
    op.drop_table("ai_output_quality_tags")
    op.drop_table("retrieval_evaluations")
    op.drop_table("reflection_feedback")
    op.drop_table("analytics_events")
    op.drop_column("weekly_insights", "source_reflection_ids")
