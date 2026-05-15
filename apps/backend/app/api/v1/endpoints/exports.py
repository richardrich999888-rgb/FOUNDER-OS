from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.post("")
async def create_export(_: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"status": "queued"}
