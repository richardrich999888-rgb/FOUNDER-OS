from app.services.security import encryption


def test_encrypt_decrypt_roundtrip(monkeypatch):
    key = encryption.generate_field_encryption_key()
    monkeypatch.setattr(encryption.settings, "field_encryption_key", key)

    encrypted = encryption.encrypt_text("private founder reflection")

    assert encrypted != "private founder reflection"
    assert encryption.decrypt_text(encrypted) == "private founder reflection"
