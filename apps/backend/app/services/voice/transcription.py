from fastapi import UploadFile


async def transcribe_voice_upload(file: UploadFile) -> str:
    """Scaffold for Whisper transcription. Store securely before enabling production use."""
    await file.seek(0)
    return ""
