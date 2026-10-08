// The offline notice at the top of the Overview: dismissing it (one click) is remembered in a cookie, and while the device stays
// offline it comes back every 3 hours until the problem is resolved. Pure helpers, so the rules are tested.

export const OFFLINE_NOTICE_REPEAT_MS = 3 * 60 * 60 * 1000;

export const noticeCookieName = (deviceId: string): string => `offline_notice_${deviceId}`;

/** When the notice was dismissed (epoch ms), from a `document.cookie` string; null when there is no such cookie or it is not a time. */
export function dismissedAtFromCookies(cookies: string, name: string): number | null {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const n = Number(rest.join("="));
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return null;
}

/** How long until the notice is due again: 0 = show it now (never dismissed, or 3 hours have passed). */
export function msUntilReshow(dismissedAt: number | null, now: number, repeatMs: number = OFFLINE_NOTICE_REPEAT_MS): number {
  if (dismissedAt === null) return 0;
  return Math.max(0, dismissedAt + repeatMs - now);
}

/** The cookie that records a dismissal: it expires on its own when the notice is due again. */
export function dismissalCookie(deviceId: string, now: number, repeatMs: number = OFFLINE_NOTICE_REPEAT_MS): string {
  return `${noticeCookieName(deviceId)}=${now}; path=/; max-age=${Math.ceil(repeatMs / 1000)}; samesite=lax`;
}

/** The cookie string that removes the record (the device is back). */
export function clearedCookie(deviceId: string): string {
  return `${noticeCookieName(deviceId)}=; path=/; max-age=0; samesite=lax`;
}
