"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import { ErrorFallback } from "@waytara/ui/error-fallback";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Logged so it is never silent, and reported to Sentry when a DSN is configured.
    console.error(error);
    reportError(error);
  }, [error]);

  return <ErrorFallback digest={error.digest} onRetry={retry} homeHref="/" homeLabel="Go to home" />;
}
