# Private Distribution Runbook

Use this for TestFlight and closed Play Store alpha.

## Environment Separation

Mobile uses EAS profiles:

- `development`: local/dev client.
- `preview`: private TestFlight and closed Play alpha.
- `production`: later public release.

Set EAS environment variables for preview:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-railway-api --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_replace --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_ALPHA_DISTRIBUTION --value testflight --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_FEATURE_CRASH_REPORTING --value true --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value https://replace@sentry.io/project --environment preview --visibility sensitive
```

## Backend Preview Env

Set in Railway:

- `DATABASE_URL`
- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `FIELD_ENCRYPTION_KEY`

Generate `FIELD_ENCRYPTION_KEY`:

```bash
scripts/generate-field-key.sh
```

## iOS TestFlight Build

```bash
cd apps/mobile
eas build --platform ios --profile preview --environment preview
eas submit --platform ios --profile production
```

Invite only trusted testers from App Store Connect.

## Android Closed Alpha Build

```bash
cd apps/mobile
eas build --platform android --profile preview --environment preview
```

Upload the `.aab` to a closed testing track in Play Console.

## Release Gate

Do not invite testers until:

- auth works
- reflection save works
- retrieval works
- weekly insight works
- export/delete controls are visible
- privacy policy URL is live
- tester consent language is sent
