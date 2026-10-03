"use client";

import { Button } from "./button";

/** Shared body for every `error.tsx` / `not-found.tsx` in both apps, so a
 *  failure looks the same everywhere and never leaks internals — only the
 *  opaque `digest` is shown (it matches the server log line), never
 *  `error.message`, which for a Server Component error is generic in
 *  production anyway but can be verbose in development. */
export function ErrorFallback({
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again, and if it keeps happening, contact support and mention the reference below.",
  digest,
  onRetry,
  homeHref = "/",
  homeLabel = "Go to home",
}: {
  title?: string;
  description?: string;
  digest?: string;
  onRetry?: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div role="alert" className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      {digest && <p className="font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      <div className="flex gap-2">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        <Button asChild variant="outline">
          <a href={homeHref}>{homeLabel}</a>
        </Button>
      </div>
    </div>
  );
}
