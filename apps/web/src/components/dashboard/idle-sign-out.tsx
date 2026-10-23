"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { effectiveWarnSeconds, idleExpired, policyActive, sessionExpired, warningSecondsLeft, type SessionPolicy } from "@/lib/session-policy";
import { idleSignOut } from "@/app/dashboard/settings/actions";

const ACTIVITY = "wt:last-activity";
const ALIVE = "wt:alive";
const SESSION_START = "wt:session-start:";
const TAB = "wt:tab";
const WRITE_EVERY_MS = 15_000;
const HEARTBEAT_EVERY_MS = 5_000;
/** a browser whose tabs all closed leaves a heartbeat older than this */
const CLOSED_AFTER_MS = 20_000;

const MESSAGES = {
  idle: "You were signed out because you were away for a while. Please sign in again.",
  limit: "You were signed out because your session reached the time limit you set. Please sign in again.",
  closed: "You were signed out because the browser was closed. Please sign in again.",
} as const;

const getNumber = (store: Storage | undefined, key: string): number | null => {
  try {
    const v = Number(store?.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const setItem = (store: Storage | undefined, key: string, value: string) => {
  try {
    store?.setItem(key, value);
  } catch {
    /* private mode: the clock simply cannot be shared between tabs */
  }
};
const local = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};
const tabStore = (): Storage | undefined => {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
};

/** The id of this browser's session (the `session_id` inside the sign-in token), so a new sign-in starts a new session clock. */
async function currentSessionId(): Promise<string> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { session_id?: unknown };
      if (typeof payload.session_id === "string") return payload.session_id;
    }
  } catch {
    /* fall through */
  }
  return "unknown";
}

/**
 * Mounted once in the dashboard layout. Signs this browser out the way the person chose in Application Settings > Security:
 *  - after it has been idle for their time (activity is the last touch, key press, click or scroll in any tab of this browser, kept in
 *    localStorage so several tabs share one clock), with an optional "still there?" warning before it happens;
 *  - when the session has lasted its most time, whatever the activity (the clock starts when this browser's session is first seen here);
 *  - when the browser is closed: every tab heartbeats into localStorage, and a tab that opens with no heartbeat for a few seconds, in a session
 *    that was already running, means the browser was closed in between.
 * Idle and time-limit sign-outs cover this device or every device, as chosen; closing the browser only ever signs out that browser. This is a
 * convenience on top of the sign-in, checked in the browser while the app is open: it cannot sign out a browser that stays closed.
 */
export function IdleSignOut({ policy }: { policy: SessionPolicy }) {
  const router = useRouter();
  const [warn, setWarn] = React.useState<number | null>(null);
  const { idleMinutes, scope, warnSeconds, maxSessionMinutes, signOutOnClose } = policy;
  const active = policyActive(policy);
  const leave = React.useRef<(reason: keyof typeof MESSAGES) => void>(() => undefined);

  React.useEffect(() => {
    if (!active) return;
    let leaving = false;
    let lastWrite = 0;
    let sessionStart: number | null = null;
    let stopped = false;

    leave.current = (reason) => {
      if (leaving) return;
      leaving = true;
      setWarn(null);
      void idleSignOut(reason === "closed" ? "device" : scope, reason)
        .catch(() => undefined)
        .then(() => router.replace(`/login?error=${encodeURIComponent(MESSAGES[reason])}`));
    };

    const check = () => {
      if (leaving) return;
      const now = Date.now();
      if (idleMinutes !== null && idleExpired(getNumber(local(), ACTIVITY), now, idleMinutes)) return leave.current("idle");
      if (sessionExpired(sessionStart, now, maxSessionMinutes)) return leave.current("limit");
      setWarn(warningSecondsLeft(getNumber(local(), ACTIVITY), now, idleMinutes, warnSeconds));
    };

    const touch = () => {
      const now = Date.now();
      if (leaving || now - lastWrite < WRITE_EVERY_MS) return;
      lastWrite = now;
      setItem(local(), ACTIVITY, String(now));
    };

    const heartbeat = () => setItem(local(), ALIVE, String(Date.now()));

    // The session clock and the closed-browser check need to know which session this is. Everything else starts at once.
    void (async () => {
      if (maxSessionMinutes !== null || signOutOnClose) {
        const key = SESSION_START + (await currentSessionId());
        if (stopped) return;
        const store = local();
        const known = getNumber(store, key);
        const fresh = known === null;
        sessionStart = known ?? Date.now();
        if (fresh) setItem(store, key, String(sessionStart));
        try {
          // sessions that ended are forgotten
          for (let i = (store?.length ?? 0) - 1; i >= 0; i--) {
            const k = store?.key(i);
            if (k && k.startsWith(SESSION_START) && k !== key) store?.removeItem(k);
          }
        } catch {
          /* nothing to clean */
        }
        if (signOutOnClose) {
          const firstTab = !tabStore()?.getItem(TAB);
          const lastAlive = getNumber(store, ALIVE);
          setItem(tabStore(), TAB, "1");
          if (!fresh && firstTab && (lastAlive === null || Date.now() - lastAlive > CLOSED_AFTER_MS)) return leave.current("closed");
          heartbeat();
        }
      }
      if (idleMinutes !== null && idleExpired(getNumber(local(), ACTIVITY), Date.now(), idleMinutes)) return leave.current("idle");
      touch();
      check();
    })();

    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    // each second while a warning could be showing (the countdown), otherwise every half minute
    const every = effectiveWarnSeconds(warnSeconds, idleMinutes) > 0 ? 1000 : 30_000;
    const timer = window.setInterval(check, every);
    const beat = signOutOnClose ? window.setInterval(heartbeat, HEARTBEAT_EVERY_MS) : null;

    return () => {
      stopped = true;
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      if (beat !== null) window.clearInterval(beat);
    };
  }, [active, idleMinutes, scope, warnSeconds, maxSessionMinutes, signOutOnClose, router]);

  const stay = () => {
    setItem(local(), ACTIVITY, String(Date.now()));
    setWarn(null);
  };

  if (warn === null) return null;
  return (
    <AlertDialog open onOpenChange={(open) => !open && stay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Timer className="size-4" />
            Are you still there?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You have not done anything for a while, so you will be signed out in {warn} {warn === 1 ? "second" : "seconds"}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => leave.current("idle")}>Sign out now</AlertDialogCancel>
          <AlertDialogAction onClick={stay}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
