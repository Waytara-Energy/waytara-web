"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@waytara/ui/error-fallback";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Picked up by Sentry's global handler once it is configured (see
    // instrumentation-client.ts); logged here so it is never silent.
    console.error(error);
  }, [error]);

  return <ErrorFallback digest={error.digest} onRetry={retry} homeHref="/" homeLabel="Go to home" />;
}
