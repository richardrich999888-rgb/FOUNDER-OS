from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.post("/weekly-insight")
async def create_weekly_insight(_: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"status": "queued"}
