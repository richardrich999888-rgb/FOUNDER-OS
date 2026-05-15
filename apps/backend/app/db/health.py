from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def check_database(session: AsyncSession) -> dict[str, str | bool | None]:
    await session.execute(text("SELECT 1"))

    vector_result = await session.execute(
        text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
    )
    vector_enabled = bool(vector_result.scalar())

    migration_result = await session.execute(
        text("SELECT to_regclass('public.alembic_version')::text")
    )
    has_alembic_table = migration_result.scalar() is not None

    revision: str | None = None
    if has_alembic_table:
        revision_result = await session.execute(text("SELECT version_num FROM alembic_version"))
        revision = revision_result.scalar()

    return {
        "database": "ok",
        "pgvector_enabled": vector_enabled,
        "alembic_table": has_alembic_table,
        "alembic_revision": revision,
    }
