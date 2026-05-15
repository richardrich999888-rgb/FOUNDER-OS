import structlog

from app.core.config import settings
from app.db.health import check_database
from app.db.session import AsyncSessionLocal

logger = structlog.get_logger(__name__)


async def run_startup_database_checks() -> None:
    if not settings.run_startup_database_checks:
        return

    async with AsyncSessionLocal() as session:
        result = await check_database(session)

    if result["database"] != "ok":
        raise RuntimeError("Database startup check failed")
    if not result["pgvector_enabled"]:
        raise RuntimeError("pgvector extension is not enabled")
    if not result["alembic_table"]:
        raise RuntimeError("Alembic migration table is missing")

    logger.info(
        "database_startup_check_passed",
        pgvector_enabled=result["pgvector_enabled"],
        alembic_revision=result["alembic_revision"],
    )
