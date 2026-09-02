"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";

/**
 * Calls `onSignedOut` whenever the browser's own Supabase client concludes
 * the session is gone — its background auto-refresh (`autoRefreshToken`,
 * on by default) failed, or another tab explicitly signed out. This is a
 * different failure than a stale SSR cookie, which proxy.ts/middleware
 * already catches on the next navigation (see the refresh-token fix in
 * @waytara/supabase/middleware) — this is for a long-lived tab that's still
 * sitting on /dashboard, whose client components (a live-polling chart, the
 * support chat) would otherwise just start silently failing under RLS
 * forever, with nothing telling the customer they need to sign back in.
 *
 * Shared between apps/web and apps/admin — both wrap this in their own tiny
 * client component that calls `useRouter()` itself (this package doesn't
 * depend on `next`, deliberately, matching every other file here), see
 * apps/web/src/components/session-watcher.tsx.
 */
export function useSessionSignedOut(onSignedOut: () => void) {
  // Ref so a new `onSignedOut` identity on every render doesn't tear down
  // and resubscribe the listener — only mount/unmount should do that.
  const callbackRef = React.useRef(onSignedOut);
  callbackRef.current = onSignedOut;

  React.useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") callbackRef.current();
    });
    return () => subscription.unsubscribe();
  }, []);
}
