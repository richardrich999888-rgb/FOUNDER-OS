from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.startup_checks import run_startup_database_checks
from app.middleware.request_context import RequestContextMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_startup_database_checks()
    yield


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title="Ballast API",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    register_error_handlers(app)
    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
