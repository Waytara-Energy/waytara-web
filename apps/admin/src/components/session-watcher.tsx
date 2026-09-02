"use client";

import { useRouter } from "next/navigation";
import { useSessionSignedOut } from "@waytara/ui/use-session-signed-out";

const SIGNED_OUT_MESSAGE = "You've been signed out. Please sign in again.";

/**
 * Mounted once in the dashboard layout. See useSessionSignedOut's own doc
 * comment for why this exists — a hard redirect rather than a toast,
 * because every client component on the page (the support chat, any
 * live-polling panel) is about to start silently failing under RLS the
 * moment the browser's own session is actually gone; staff need to
 * re-authenticate, not just be told about it.
 */
export function SessionWatcher() {
  const router = useRouter();

  useSessionSignedOut(() => {
    router.replace(`/login?error=${encodeURIComponent(SIGNED_OUT_MESSAGE)}`);
  });

  return null;
}
