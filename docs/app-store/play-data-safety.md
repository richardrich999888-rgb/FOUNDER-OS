# Google Play Data Safety Draft

This draft must match the privacy policy and real app behavior.

## Data Collected

### Personal Info

Email address through Clerk.

Purpose:

- account creation
- authentication
- support

### User Content

Reflection text, optional feedback notes, weekly insight content generated from reflections.

Purpose:

- app functionality
- semantic search
- weekly synthesis
- export/delete controls

### App Activity

Privacy-safe events:

- onboarding completed
- reflection created
- memory search used
- weekly insight opened
- usefulness ratings
- export requested
- account deletion started

Purpose:

- app functionality
- analytics
- product improvement

Not collected:

- raw search queries in analytics
- raw reflection text in analytics
- AI prompts in analytics
- AI outputs in analytics

### Diagnostics

Crash logs if Sentry is enabled.

Purpose:

- crash reporting
- app stability

### Audio

Only if voice reflection is enabled. Current alpha should keep voice disabled unless storage and transcription are production-ready.

Purpose if enabled:

- user-requested transcription
- reflection creation

## Data Sharing

Ballast uses processors:

- Clerk for authentication
- Railway for backend/database hosting
- OpenAI for AI processing
- Sentry for crash diagnostics if enabled

Do not claim data is sold or used for advertising.

## Encryption

- Data is encrypted in transit via HTTPS.
- Sensitive reflection fields are encrypted before storage.
- PostgreSQL connections use SSL in production.

## Deletion

Users can start account deletion in app settings. Deletion should remove or queue deletion for:

- account record
- reflections
- AI memories
- weekly insights
- exports
- notification preferences
- feedback notes

## Retention

Alpha retention policy:

- keep user content while account is active
- delete user content after account deletion request completes
- retain operational/security records only as legally or operationally required

## Data Safety Form Notes

Google Play has one Data Safety form per package name. Keep it consistent across internal, closed, open, and production tracks.
