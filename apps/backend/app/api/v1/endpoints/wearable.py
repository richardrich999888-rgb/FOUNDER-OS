from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.post("/events")
async def ingest_wearable_event(_: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"status": "accepted"}
