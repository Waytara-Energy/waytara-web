// Browser-side error monitoring. NEXT_PUBLIC_SENTRY_DSN is inlined at build
// time: when it is unset this whole block is dead code and the SDK is never
// downloaded or started.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      // No session replay: it records what customers see on their dashboard.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
  });
}
