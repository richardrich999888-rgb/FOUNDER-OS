from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.get("/me")
async def get_current_user(payload: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"id": payload.get("sub")}
