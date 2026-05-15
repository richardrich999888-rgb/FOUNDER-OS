from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.reflection import Reflection
from app.models.user import User
from app.schemas.reflection import ReflectionCreate
from app.services.reflections import service as reflection_service
from app.services.security import encryption


@pytest.mark.asyncio
async def test_create_reflection_encrypts_and_writes_memory(monkeypatch):
    key = encryption.generate_field_encryption_key()
    monkeypatch.setattr(encryption.settings, "field_encryption_key", key)
    monkeypatch.setattr(reflection_service, "embed_text", _fake_embed_text)

    session = FakeSession()
    user = User(id=uuid4(), clerk_user_id="user_123", email="founder@example.com")
    payload = ReflectionCreate(body="I keep avoiding the hard conversation.", mood="uncertain")

    result = await reflection_service.create_reflection(session, user, payload)

    assert result.body == payload.body
    assert session.committed is True
    assert len(session.added) == 2
    reflection = session.added[0]
    memory = session.added[1]
    assert isinstance(reflection, Reflection)
    assert reflection.body_encrypted != payload.body
    assert memory.content_encrypted == reflection.body_encrypted
    assert memory.embedding == [0.1] * 1536


async def _fake_embed_text(_: str) -> list[float]:
    return [0.1] * 1536


class FakeSession:
    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, value):
        if isinstance(value, Reflection):
            value.id = uuid4()
            value.created_at = datetime.now(UTC)
        self.added.append(value)

    async def flush(self):
        return None

    async def commit(self):
        self.committed = True

    async def refresh(self, value):
        return value
