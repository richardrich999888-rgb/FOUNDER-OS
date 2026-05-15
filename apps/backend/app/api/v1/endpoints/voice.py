from fastapi import APIRouter, Depends, File, UploadFile

from app.services.auth.clerk import verify_clerk_jwt
from app.services.voice.transcription import transcribe_voice_upload

router = APIRouter()


@router.post("/upload")
async def upload_voice_reflection(
    file: UploadFile = File(...),
    _: dict = Depends(verify_clerk_jwt),
) -> dict:
    transcript = await transcribe_voice_upload(file)
    return {"status": "transcribed", "transcript": transcript}
