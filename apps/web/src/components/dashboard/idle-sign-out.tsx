"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { idleExpired, type IdleScope } from "@/lib/session-policy";
import { idleSignOut } from "@/app/dashboard/settings/actions";

const KEY = "wt:last-activity";
const WRITE_EVERY_MS = 15_000;
const CHECK_EVERY_MS = 30_000;
const MESSAGE = "You were signed out because you were away for a while. Please sign in again.";

const read = (): number | null => {
  try {
    const v = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const write = (t: number) => {
  try {
    window.localStorage.setItem(KEY, String(t));
  } catch {
    /* private mode: the timer simply cannot be shared between tabs */
  }
};

/**
 * Mounted once in the dashboard layout. Signs this browser out after the idle time the person chose in Application Settings (their device
 * only, or every device, as they chose). Activity is the last touch, key press, click or scroll in any tab of this browser, kept in
 * localStorage so several tabs share one clock; coming back after the browser was closed is checked at once, before the visit counts as
 * activity. Nothing runs when the person keeps the session alive all the time. This is a convenience on top of the sign-in, checked in the
 * browser while the app is open: it cannot sign out a browser that is closed and never comes back.
 */
export function IdleSignOut({ idleMinutes, scope }: { idleMinutes: number | null; scope: IdleScope }) {
  const router = useRouter();

  React.useEffect(() => {
    if (idleMinutes === null) return;
    let leaving = false;
    let lastWrite = 0;

    const check = async () => {
      if (leaving || !idleExpired(read(), Date.now(), idleMinutes)) return;
      leaving = true;
      await idleSignOut(scope).catch(() => undefined);
      router.replace(`/login?error=${encodeURIComponent(MESSAGE)}`);
    };

    const touch = () => {
      const now = Date.now();
      if (leaving || now - lastWrite < WRITE_EVERY_MS) return;
      lastWrite = now;
      write(now);
    };

    void check().then(() => {
      if (!leaving) touch();
    });

    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [idleMinutes, scope, router]);

  return null;
}
