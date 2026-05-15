# Feedback System

Ballast feedback should measure trust and usefulness, not vanity satisfaction.

## In-App Feedback Events

Use these privacy-safe events:

- `reflection_created`
- `voice_reflection_created`
- `weekly_insight_opened`
- `weekly_insight_rated`
- `memory_search_used`
- `memory_search_result_opened`
- `account_deletion_started`
- `export_requested`

Never send:

- reflection text
- transcript text
- AI prompt text
- AI output text
- raw search queries
- personally sensitive metadata

## Weekly Insight Rating

Ask one lightweight question:

> Did this notice something useful?

Allowed answers:

- Yes
- Somewhat
- No

Optional free text can be stored only as explicit user feedback, separate from analytics, and covered by the privacy policy.

## Founder Interview Script

Use this after one week:

1. What did Ballast understand correctly?
2. What felt generic?
3. What felt invasive?
4. What would make you come back weekly?
5. Would you miss this if it disappeared?

## Feedback Review Cadence

Review feedback twice per week during alpha:

- Tuesday: classify retention blockers.
- Friday: decide fixes for the next build.

Do not add major features until the core loop earns return usage.
