from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    auth,
    exports,
    health,
    memory,
    reflections,
    users,
    voice,
    wearable,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(reflections.router, prefix="/reflections", tags=["reflections"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(wearable.router, prefix="/wearable", tags=["wearable"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
