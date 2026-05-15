export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  alphaDistribution: process.env.EXPO_PUBLIC_ALPHA_DISTRIBUTION ?? "development",
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
  featureAlphaFeedback: process.env.EXPO_PUBLIC_FEATURE_ALPHA_FEEDBACK !== "false",
  featureRetrievalEvaluation: process.env.EXPO_PUBLIC_FEATURE_RETRIEVAL_EVALUATION !== "false",
  featureCrashReporting: process.env.EXPO_PUBLIC_FEATURE_CRASH_REPORTING === "true",
};
