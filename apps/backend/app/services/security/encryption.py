from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.errors import ApiError


def generate_field_encryption_key() -> str:
    return Fernet.generate_key().decode("utf-8")


def _fernet() -> Fernet:
    if not settings.field_encryption_key:
        raise ApiError(
            "encryption_not_configured",
            "FIELD_ENCRYPTION_KEY is required before storing private content",
            500,
        )

    try:
        return Fernet(settings.field_encryption_key.encode("utf-8"))
    except ValueError as exc:
        raise ApiError("invalid_encryption_key", "FIELD_ENCRYPTION_KEY is invalid", 500) from exc


def encrypt_text(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ApiError(
            "decrypt_failed",
            "Stored private content could not be decrypted",
            500,
        ) from exc
