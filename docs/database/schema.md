# Database Schema

The first migration creates:

- `users`: internal user record linked to Clerk.
- `reflections`: encrypted reflection text and mood/source metadata.
- `sessions`: Clerk session tracking for account/device visibility.
- `wearable_data`: future wearable metrics and raw provider payloads.
- `ai_memories`: encrypted memory text plus pgvector embeddings.
- `weekly_insights`: encrypted weekly synthesis output.
- `exports`: user data export jobs.
- `notification_preferences`: reminder and notification settings.

Reflection content, AI memory content, and weekly insight summaries are modeled as encrypted fields. The encryption implementation should be added before storing production user content.
