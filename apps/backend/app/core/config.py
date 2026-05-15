from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AnyHttpUrl, Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/ballast")
    database_ssl: bool | None = None
    database_pool_size: int = 5
    database_max_overflow: int = 5
    database_pool_timeout: int = 30
    database_pool_recycle: int = 1800
    run_startup_database_checks: bool = True
    clerk_issuer: str = ""
    clerk_jwks_url: AnyHttpUrl | None = None
    clerk_secret_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    voice_storage_bucket: str = ""
    log_level: str = "INFO"
    field_encryption_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081"]

    @computed_field
    @property
    def normalized_database_url(self) -> str:
        return normalize_database_url(self.database_url)

    @computed_field
    @property
    def should_use_database_ssl(self) -> bool:
        if self.database_ssl is not None:
            return self.database_ssl
        return self.environment in {"production", "preview", "staging"}


def normalize_database_url(value: str) -> str:
    """Accept Railway/Vercel-style Postgres URLs and adapt them for SQLAlchemy asyncio."""
    if value.startswith("postgres://"):
        value = value.replace("postgres://", "postgresql+asyncpg://", 1)
    elif value.startswith("postgresql://"):
        value = value.replace("postgresql://", "postgresql+asyncpg://", 1)

    if not value.startswith("postgresql+asyncpg://"):
        return value

    split = urlsplit(value)
    query = dict(parse_qsl(split.query, keep_blank_values=True))
    # asyncpg receives SSL via connect_args, not URL query parameters.
    query.pop("sslmode", None)
    query.pop("ssl", None)
    return urlunsplit((split.scheme, split.netloc, split.path, urlencode(query), split.fragment))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
