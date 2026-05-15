from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.health import check_database
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
async def database_health(session: AsyncSession = Depends(get_db)) -> dict[str, str | bool | None]:
    return await check_database(session)
