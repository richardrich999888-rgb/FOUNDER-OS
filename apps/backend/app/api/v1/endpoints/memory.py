from fastapi import APIRouter, Depends

from app.services.auth.clerk import verify_clerk_jwt

router = APIRouter()


@router.get("/search")
async def search_your_own_mind(q: str, _: dict = Depends(verify_clerk_jwt)) -> dict:
    return {"query": q, "items": []}
