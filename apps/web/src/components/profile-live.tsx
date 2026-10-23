"use client";

import * as React from "react";

// A new profile picture or name shows everywhere at once, without a reload. The server renders the layout (the sidebar's account banner, the
// header) from what the sign-in check read before the change was saved, so on its own the page would show the old picture until the next full
// load. When a change is saved the settings announce it here, and every place that shows the picture or the name listens.

export interface LiveProfile {
  fullName?: string | null;
  avatarUrl?: string | null;
}

const EVENT = "wt:profile";
/** What was announced so far, so a component that appears later (another tab of the settings, say) starts from it. */
let latest: LiveProfile = {};

export function announceProfile(patch: LiveProfile): void {
  latest = { ...latest, ...patch };
  window.dispatchEvent(new CustomEvent<LiveProfile>(EVENT, { detail: patch }));
}

/** The name and picture to show: the announced ones when there are any, else what the server rendered. */
export function useLiveProfile(initial: { fullName: string | null; avatarUrl: string | null }): { fullName: string | null; avatarUrl: string | null } {
  const [announced, setAnnounced] = React.useState<LiveProfile>(latest);
  React.useEffect(() => {
    const on = (e: Event) => setAnnounced((p) => ({ ...p, ...(e as CustomEvent<LiveProfile>).detail }));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return {
    fullName: announced.fullName !== undefined ? announced.fullName : initial.fullName,
    avatarUrl: announced.avatarUrl !== undefined ? announced.avatarUrl : initial.avatarUrl,
  };
}
