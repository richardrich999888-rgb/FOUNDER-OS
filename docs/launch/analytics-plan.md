# Privacy-Safe Analytics Plan

Use PostHog for privacy-safe product analytics, but configure it conservatively.

## Principles

- Track behavior, not reflection content.
- Do not record session replays during alpha.
- Do not capture text inputs.
- Do not send raw search queries.
- Use event names that describe product actions.
- Keep analytics opt-out possible.

## Recommended Events

| Event                      | Why it matters             |
| -------------------------- | -------------------------- |
| `signup_completed`         | activation                 |
| `reflection_created`       | core behavior              |
| `voice_reflection_created` | friction reduction         |
| `memory_search_used`       | killer feature usage       |
| `weekly_insight_opened`    | synthesis value            |
| `weekly_insight_rated`     | insight quality            |
| `export_requested`         | trust and control          |
| `account_deletion_started` | trust failure or lifecycle |

## Properties Allowed

Allowed:

- app version
- platform
- account age bucket
- reflection count bucket
- result count
- rating choice

Not allowed:

- reflection body
- transcript
- prompt
- AI response
- raw query
- health data payload

## Alpha Dashboard

Track:

- active users by week
- reflection recurrence
- retrieval usage
- weekly insight open rate
- weekly insight usefulness rating
- account deletions

Do not optimize onboarding conversion before the insight loop works.
