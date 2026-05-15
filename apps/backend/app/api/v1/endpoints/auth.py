from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.get("/session")
async def session(payload: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"user_id": payload.get("sub"), "provider": "clerk"}
