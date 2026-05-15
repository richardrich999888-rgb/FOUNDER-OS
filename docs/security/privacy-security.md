# Privacy and Security Foundation

## Current Foundation

- Clerk handles authentication, so Ballast does not store passwords.
- Backend routes use bearer token verification scaffolding.
- Logs redact auth headers, cookies, reflection text, transcripts, and content fields.
- Reflection content fields are named as encrypted storage fields.
- Production docs assume HTTPS through Vercel and Railway.

## Required Before Real Users

- Implement field-level encryption for reflection, memory, and insight text.
- Store voice uploads in private object storage with short-lived signed URLs.
- Add deletion workflows for account deletion and export deletion.
- Add data retention settings.
- Complete legal privacy review.

## Analytics Rule

Analytics should track product events, not personal reflection content. Good events are `reflection_created`, `weekly_insight_opened`, and `export_requested`. Bad events include full reflection text, transcript text, or AI prompt bodies.
