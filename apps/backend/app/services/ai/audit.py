from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_output_audit import AiOutputAudit


async def audit_ai_output(
    session: AsyncSession,
    user_id: UUID | None,
    output_type: str,
    provider: str,
    model: str,
    status: str,
    source_count: int,
    prompt_text: str = "",
    output_text: str = "",
    error_code: str | None = None,
) -> None:
    audit = AiOutputAudit(
        user_id=user_id,
        output_type=output_type,
        provider=provider,
        model=model,
        status=status,
        source_count=source_count,
        prompt_token_estimate=_estimate_tokens(prompt_text),
        output_token_estimate=_estimate_tokens(output_text),
        error_code=error_code,
    )
    session.add(audit)


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4) if text else 0
