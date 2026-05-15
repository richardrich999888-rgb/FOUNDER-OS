from app.core.config import Settings, normalize_database_url


def test_normalize_railway_postgres_url_for_async_sqlalchemy():
    url = "postgres://user:pass@host.railway.internal:5432/railway?sslmode=require"

    normalized = normalize_database_url(url)

    assert normalized == "postgresql+asyncpg://user:pass@host.railway.internal:5432/railway"


def test_database_ssl_defaults_to_production_only():
    local = Settings(environment="development", database_ssl=None)
    production = Settings(environment="production", database_ssl=None)

    assert local.should_use_database_ssl is False
    assert production.should_use_database_ssl is True
