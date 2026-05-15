from openai import AsyncOpenAI

from app.core.config import settings
from app.core.errors import ApiError

EMBEDDING_MODEL = "text-embedding-3-small"
SYNTHESIS_MODEL = "gpt-4o-mini"


def _client() -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise ApiError("ai_not_configured", "OPENAI_API_KEY is required for alpha AI features", 500)
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_text(text: str) -> list[float]:
    response = await _client().embeddings.create(model=EMBEDDING_MODEL, input=text)
    return response.data[0].embedding


async def synthesize_weekly_reflections(reflections: list[str]) -> str:
    if not reflections:
        raise ApiError("not_enough_reflections", "At least one reflection is required", 400)

    prompt = "\n\n".join(
        f"Reflection {index + 1}:\n{reflection}" for index, reflection in enumerate(reflections)
    )

    response = await _client().chat.completions.create(
        model=SYNTHESIS_MODEL,
        temperature=0.4,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are Ballast, a restrained cognitive observability system for founders. "
                    "You are not a therapist. Do not diagnose, moralize, flatter, or use wellness "
                    "cliches. Identify specific patterns from the supplied reflections only. "
                    "Use calm, precise language. If evidence is thin, say so."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create a weekly insight from these reflections. Include: "
                    "1) observed pattern, 2) tension or recurring tradeoff, "
                    "3) one useful question for next week. When naming a pattern, cite the "
                    "reflection numbers that support it, for example [R2, R5]. Keep it under "
                    "220 words.\n\n"
                    f"{prompt}"
                ),
            },
        ],
    )

    return response.choices[0].message.content or ""
