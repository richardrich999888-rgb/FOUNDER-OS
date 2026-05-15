import { env } from "@/src/config/env";
import * as Sentry from "@sentry/react-native";

export function initCrashReporting() {
  if (!env.featureCrashReporting || !env.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.alphaDistribution,
    tracesSampleRate: env.alphaDistribution === "production" ? 0.1 : 0.25,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }
      return event;
    },
  });
}
