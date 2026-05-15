# EAS Android Build and Submit

## Build Profiles

Ballast uses:

- `preview`: Play-compatible AAB for internal or closed alpha.
- `production`: Play-compatible AAB for future public production.

Both generate `.aab` files through:

```json
"android": {
  "buildType": "app-bundle",
  "autoIncrement": "versionCode"
}
```

## Preview Build

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile preview
```

## Production Build

```bash
cd apps/mobile
npx eas-cli build --platform android --profile production
```

If running in CI, set `EXPO_TOKEN` instead of using `eas login`.

## Credentials

EAS manages Android signing credentials. On first build, let EAS generate and store the keystore unless you already have one.

Do not commit keystores or service account JSON files.

## First Manual Upload

For the first Google Play release, manually upload the `.aab` in Play Console. This confirms the app, package name, signing, and tracks are configured.

## Future EAS Submit

After the first upload:

1. Create a Google Cloud service account.
2. Grant Play Console access.
3. Download JSON key.
4. Store it outside the repo.
5. Configure EAS Submit.

Submit command:

```bash
cd apps/mobile
npx eas-cli submit --platform android --profile preview
```

The current submit profile targets the `internal` track and creates a draft release.

## Current Local Blocker

The local build command was attempted and stopped before build creation because EAS requires Expo authentication:

```text
An Expo user account is required to proceed.
Either log in with eas login or set the EXPO_TOKEN environment variable.
```

After `npx eas-cli login` or setting `EXPO_TOKEN`, rerun:

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

## Official References

- EAS Build docs: `https://docs.expo.dev/deploy/build-project/`
- EAS build profile docs: `https://docs.expo.dev/build/eas-json/`
- Expo Android app signing security: `https://docs.expo.dev/app-signing/security/`
