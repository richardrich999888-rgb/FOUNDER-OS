# Google Play Console Setup

This guide prepares Ballast for internal testing and closed alpha. Do not publish publicly yet.

## 1. Create Google Play Developer Account

1. Go to Google Play Console.
2. Create a developer account.
3. Complete identity and payment setup.
4. Choose organization account if Ballast has a company entity.

Screenshot placeholder:

`[Screenshot: Play Console account creation]`

## 2. Create App

1. Click **Create app**.
2. App name: `Ballast`.
3. Default language: English.
4. App or game: App.
5. Free or paid: Free for alpha.
6. Confirm declarations.

Package name must match Expo config:

```text
com.ballast.app
```

## 3. Complete Required Store Setup

Before release review, complete:

- App access
- Ads declaration
- Content rating
- Target audience
- News apps declaration
- Data Safety
- Government apps declaration if shown
- Financial features declaration if shown
- Health apps declaration if shown

For Ballast, avoid health/medical positioning. Use reflection and cognitive observability language.

## 4. Internal Testing Setup

1. Go to **Testing > Internal testing**.
2. Click **Create new release**.
3. Upload the `.aab`.
4. Add release notes:

```text
Private alpha build for trusted Ballast testers. Includes reflection capture, memory search, weekly insight review, export/delete controls, and feedback instrumentation.
```

5. Add testers by email list.
6. Save and submit for review if required.
7. Copy the opt-in link after the release is available.

Internal testing is best for the first smoke test group.

## 5. Closed Testing Setup

1. Go to **Testing > Closed testing**.
2. Create a track named `founder-alpha`.
3. Add testers by email list or Google Group.
4. Create a release using the same `.aab` or a newer one.
5. Add release notes.
6. Submit for review.
7. Share the opt-in link only with trusted testers.

Closed testing is for the broader private alpha.

## 6. Tester Invite Flow

Send:

1. Consent language.
2. Play opt-in link.
3. Install instructions.
4. One-week usage task.
5. Feedback form.

Never post the opt-in link publicly.

## 7. Release Management

For alpha:

- Keep one active internal release.
- Promote only after smoke testing.
- Keep closed alpha release notes short.
- Do not use staged rollout yet.

## 8. Troubleshooting

### Upload rejected: package name mismatch

Check:

```json
"android": {
  "package": "com.ballast.app"
}
```

### Upload rejected: versionCode already used

Increment Android `versionCode` or use EAS auto-increment.

### Data Safety incomplete

Complete the Data Safety form before review.

### Privacy policy missing

Add a public privacy policy URL. It cannot be behind login.

### App crashes on launch

Check Sentry, Play Console Android vitals, and Railway health endpoints.

## Official References

- Google Play internal/closed testing docs: `https://support.google.com/googleplay/android-developer/answer/9845334`
- Google Play Data Safety docs: `https://support.google.com/googleplay/android-developer/answer/10787469`
