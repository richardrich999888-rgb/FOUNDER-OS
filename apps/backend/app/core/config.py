from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/ballast")
    clerk_issuer: str = ""
    clerk_jwks_url: AnyHttpUrl | None = None
    clerk_secret_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    voice_storage_bucket: str = ""
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
