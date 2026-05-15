from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.get("")
async def list_reflections(_: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"items": []}
