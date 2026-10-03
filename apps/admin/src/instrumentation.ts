import type { Instrumentation } from "next";

// Server-side error monitoring. Entirely inactive until SENTRY_DSN is set in the
// environment (Vercel), so local dev, CI and E2E runs never send anything.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only; performance tracing is opt-in later because it costs quota.
    tracesSampleRate: 0,
    // Never attach IPs / cookies / request bodies automatically.
    sendDefaultPii: false,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
