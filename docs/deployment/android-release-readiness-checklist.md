# Android Release Readiness Checklist

## App Config

- Android package: `com.ballast.app`
- Version name: `0.1.0`
- Version code: `1`, auto-incremented by EAS
- AAB build enabled
- App icon exists
- Adaptive icon exists
- Splash image exists
- No localhost URL in EAS preview/production profiles
- Expo project initialized with `npx eas-cli init`
- Expo account authenticated with `npx eas-cli login` or `EXPO_TOKEN`

## Compliance

- Privacy policy URL ready
- Support URL ready
- Data Safety draft complete
- Account deletion available in Settings
- AI disclosure wording included
- No therapy, diagnosis, treatment, or burnout prediction claims

## Functional Smoke Test

- App launches
- Google login works
- Apple login works if available on Android browser flow
- Reflection saves
- Retrieval works
- Weekly insight works
- Export request works
- Delete account flow works
- Offline states are graceful
- Sentry receives test crash/event if enabled

## Play Console

- App created
- Internal testing track created
- Closed testing track created
- Tester list added
- AAB uploaded
- Release notes added
- Data Safety completed
- Content rating completed
- App access declaration completed
