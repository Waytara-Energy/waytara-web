/** Sends an error that an error boundary caught to Sentry (React error
 *  boundaries swallow errors, so the SDK's global handlers never see them).
 *  A no-op — and the SDK is never loaded — unless NEXT_PUBLIC_SENTRY_DSN is set. */
export function reportError(error: Error & { digest?: string }): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureException(error, { tags: { digest: error.digest } });
  });
}
